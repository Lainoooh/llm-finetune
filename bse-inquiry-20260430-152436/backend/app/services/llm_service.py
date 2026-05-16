"""
LLM service - unified interface for calling different LLM providers.
Supports model routing based on database configuration.
"""

import asyncio
import json
import logging
import os
import re
import time
from typing import Dict, List, Optional, Tuple

import httpx

from app.models.model import ModelRepo

logger = logging.getLogger(__name__)

# Global default LLM parameters
LLM_DEFAULTS = {
    "max_new_tokens": 2048,
    "temperature": 0.7,
    "top_p": 0.8,
}

# Keys that are merged from model.config into the API payload
_LLM_PARAM_KEYS = {"max_new_tokens", "temperature", "top_p"}

# ---------------------------------------------------------------------------
# Shared httpx client (connection pooling) — lazy-initialised
# ---------------------------------------------------------------------------

_shared_client: Optional[httpx.AsyncClient] = None


async def get_shared_client() -> httpx.AsyncClient:
    """Return the shared httpx client, creating it on first call."""
    global _shared_client
    if _shared_client is None:
        _shared_client = httpx.AsyncClient(
            timeout=httpx.Timeout(600.0, connect=10.0),
            limits=httpx.Limits(max_connections=20, max_keepalive_connections=10),
            trust_env=False,
        )
        logger.info("Shared httpx client created")
    return _shared_client


async def close_shared_client() -> None:
    """Close the shared httpx client (called on app shutdown)."""
    global _shared_client
    if _shared_client is not None:
        await _shared_client.aclose()
        _shared_client = None
        logger.info("Shared httpx client closed")


# ---------------------------------------------------------------------------
# LLM request concurrency limiter (per-model with global fallback)
# ---------------------------------------------------------------------------

_global_concurrency = int(os.environ.get("LLM_MAX_CONCURRENT_REQUESTS", "5"))
_llm_request_semaphore = asyncio.Semaphore(_global_concurrency)

# Per-model semaphore cache: model_id -> Semaphore
_model_semaphores: Dict[int, asyncio.Semaphore] = {}


def _get_model_semaphore(model: dict) -> asyncio.Semaphore:
    """Get or create a semaphore for the given model.
    Priority: model.concurrency > LLM_MAX_CONCURRENT_REQUESTS env var.
    """
    model_id = model.get("id")
    concurrency = model.get("concurrency")
    if concurrency and concurrency > 0 and model_id:
        if model_id not in _model_semaphores:
            _model_semaphores[model_id] = asyncio.Semaphore(concurrency)
        return _model_semaphores[model_id]
    return _llm_request_semaphore


def strip_think_blocks(content: str) -> str:
    """Remove <think>...</think> CoT reasoning blocks, keep everything else."""
    return re.sub(r'<think>.*?</think>', '', content, flags=re.DOTALL).strip()


def parse_llm_content(content: str, strict: bool = False) -> str:
    """
    Parse LLM response content:
    - Strip <think>...</think> reasoning blocks (Qwen3 CoT)
    - If content starts with 【xxx】 marker, return only the part after it
    - Also strip leading colons after the marker (e.g. 【xxx】：xxx)
    - If no 【】 marker, return the full content
    - If strict=True, additionally strip trailing punctuation (。！？；，、.!?;,)
      to extract only the core text
    """
    content = strip_think_blocks(content)
    if not content:
        return ""
    match = re.match(r'^【[^】]+】[：:]*\s*(.*)', content, re.DOTALL)
    if match:
        content = match.group(1).strip()
    else:
        content = content.strip()
    if strict:
        content = content.rstrip('。！？；，、.!?;,')
    return content


# BERTScore 本地模型路径（避免每次从 HuggingFace 下载）
# 优先使用 /data/models/ 下的本地模型，回退到 HF 缓存中的标准模型名
BERT_MODEL_PATH = os.environ.get("BERT_MODEL_PATH", "/data/models/bert-base-chinese")

# 检测本地模型目录是否存在，决定使用本地路径还是 HF 缓存名称
_USE_LOCAL_BERT = os.path.isdir(BERT_MODEL_PATH) and os.path.exists(
    os.path.join(BERT_MODEL_PATH, "config.json")
)


def _compute_bert_f1_scores_sync(
    predictions: List[str],
    references: List[str],
) -> List[float]:
    """
    (Synchronous) Compute BERTScore F1 between predictions and references.
    Uses local bert-base-chinese model, returns scores on 0-100 scale.
    Called via run_in_executor to avoid blocking the asyncio event loop.
    """
    os.environ['HF_HUB_OFFLINE'] = '1'  # 禁止联网下载模型

    from bert_score import score as bert_score

    if not predictions or not references:
        return []

    # 本地路径需要显式指定 num_layers 和关闭 rescale
    # 标准模型名可自动查找 baseline
    if _USE_LOCAL_BERT:
        P, R, F1 = bert_score(
            predictions, references,
            lang='zh',
            model_type=BERT_MODEL_PATH,
            num_layers=8,
            rescale_with_baseline=False,
            verbose=False,
            device='cpu',
        )
    else:
        P, R, F1 = bert_score(
            predictions, references,
            lang='zh',
            model_type='bert-base-chinese',
            rescale_with_baseline=True,
            verbose=False,
            device='cpu',
        )
    f1_arr = F1.cpu().numpy()
    return [float(f1_arr[i] * 100) for i in range(len(f1_arr))]


async def compute_bert_f1_scores(
    predictions: List[str],
    references: List[str],
) -> List[float]:
    """
    Async wrapper: run BERTScore in a thread pool to avoid blocking the event loop.
    """
    if not predictions or not references:
        return []
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(
        None, _compute_bert_f1_scores_sync, predictions, references
    )


def _build_payload(model: dict, messages: List[dict],
                    extra_body: Optional[Dict] = None,
                    stream: bool = False) -> dict:
    """Build API payload with 3-layer parameter merging.

    Priority (low -> high): LLM_DEFAULTS < model.config < extra_body
    Only keys in _LLM_PARAM_KEYS are merged from model.config;
    extra_body is merged as-is (supports arbitrary keys like chat_template_kwargs).
    """
    params = dict(LLM_DEFAULTS)
    # Layer 2: per-model config (whitelisted keys only)
    model_cfg = model.get("config") or {}
    for k in _LLM_PARAM_KEYS:
        if k in model_cfg:
            params[k] = model_cfg[k]
    # Layer 3: per-call overrides (arbitrary keys)
    if extra_body:
        params.update(extra_body)
    payload = {
        "model": model["model_name"],
        "messages": messages,
        **params,
    }
    if stream:
        payload["stream"] = True
    return payload


class LLMService:
    """
    Unified LLM service that routes calls to different providers
    based on model configuration in the database.
    """

    async def chat(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        model_id: Optional[int] = None,
        purpose: Optional[str] = None,
        extra_body: Optional[Dict] = None,
        use_stream: bool = False,
    ) -> str:
        """
        Generic chat endpoint. Calls the LLM and returns parsed content.
        extra_body: per-call parameter overrides (e.g. chat_template_kwargs).
        use_stream: use streaming API to avoid timeout on long generations.
        """
        model = self._get_model_config(model_id=model_id, purpose=purpose)
        if not model:
            raise RuntimeError("No available model configuration")

        if system_prompt is None:
            system_prompt = model.get("config", {}).get("prompt", "")

        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        if use_stream:
            content = await self._call_api_stream(model, messages, extra_body=extra_body)
        else:
            content = await self._call_api(model, messages, extra_body=extra_body)
        return parse_llm_content(content)

    async def chat_batch(
        self,
        prompts: List[Tuple[str, Optional[str]]],
        purpose: Optional[str] = None,
        model_id: Optional[int] = None,
        on_item_complete: Optional[callable] = None,
    ) -> List[str]:
        """
        Batch chat: send multiple prompts concurrently, return parsed results.
        on_item_complete(index) is called after each individual call completes.
        """
        model = self._get_model_config(model_id=model_id, purpose=purpose)
        if not model:
            raise RuntimeError("No available model configuration")

        default_system = model.get("config", {}).get("prompt", "")

        async def call_one(index: int, user_prompt: str, sys_prompt: Optional[str]) -> str:
            sp = sys_prompt if sys_prompt is not None else default_system
            messages = []
            if sp:
                messages.append({"role": "system", "content": sp})
            messages.append({"role": "user", "content": user_prompt})
            content = await self._call_api(model, messages)
            result = parse_llm_content(content)
            if on_item_complete:
                on_item_complete(index)
            return result

        tasks = [call_one(i, up, sp) for i, (up, sp) in enumerate(prompts)]
        return await asyncio.gather(*tasks)

    async def chat_batch_raw(
        self,
        prompts: List[Tuple[str, Optional[str]]],
        purpose: Optional[str] = None,
        model_id: Optional[int] = None,
        on_item_complete: Optional[callable] = None,
    ) -> List[Optional[str]]:
        """
        Batch chat returning raw content (think blocks removed, but markers kept).
        Uses streaming internally to avoid timeout on long generations.
        Returns a list where failed items are None (successful items are str).
        on_item_complete(index) is called after each individual call completes.
        """
        model = self._get_model_config(model_id=model_id, purpose=purpose)
        if not model:
            raise RuntimeError("No available model configuration")

        default_system = model.get("config", {}).get("prompt", "")

        async def call_one(index: int, user_prompt: str, sys_prompt: Optional[str]) -> str:
            sp = sys_prompt if sys_prompt is not None else default_system
            messages = []
            if sp:
                messages.append({"role": "system", "content": sp})
            messages.append({"role": "user", "content": user_prompt})
            content = await self._call_api_stream(model, messages)
            result = strip_think_blocks(content)
            if on_item_complete:
                on_item_complete(index)
            return result

        tasks = [call_one(i, up, sp) for i, (up, sp) in enumerate(prompts)]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        processed: List[Optional[str]] = []
        fail_count = 0
        for i, r in enumerate(results):
            if isinstance(r, BaseException):
                logger.error("chat_batch_raw item %d/%d failed: %s", i, len(prompts), r)
                processed.append(None)
                fail_count += 1
            else:
                processed.append(r)
        if fail_count:
            logger.warning("chat_batch_raw: %d/%d items failed", fail_count, len(prompts))
        return processed

    async def _call_api(self, model: dict, messages: List[dict],
                        extra_body: Optional[Dict] = None) -> str:
        """
        Low-level API call to the LLM endpoint (OpenAI-compatible).
        Returns raw content string from the response.
        """
        endpoint_url = model.get("endpoint_url", "")
        if not endpoint_url:
            raise RuntimeError(f"Model {model.get('model_name')} has no endpoint_url configured")

        # Resolve API key (handle both encrypted and plaintext placeholders)
        api_key = model.get("api_key", "")
        if api_key.startswith("encrypted:"):
            api_key = api_key[len("encrypted:"):]
        elif api_key:
            try:
                from app.utils.encrypt import decrypt_api_key
                api_key = decrypt_api_key(api_key)
            except Exception:
                pass

        payload = _build_payload(model, messages, extra_body=extra_body)

        headers = {}
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"

        model_name = model["model_name"]
        t0 = time.monotonic()

        async with _get_model_semaphore(model):
            try:
                client = await get_shared_client()
                resp = await client.post(endpoint_url, json=payload, headers=headers)
                resp.raise_for_status()
                data = resp.json()
                content = data["choices"][0]["message"]["content"]
                elapsed = time.monotonic() - t0
                logger.info("LLM API 调用完成, model=%s, duration=%.2fs", model_name, elapsed)
                return content
            except httpx.HTTPStatusError as e:
                elapsed = time.monotonic() - t0
                logger.error("LLM API HTTP 错误: status=%d, model=%s, duration=%.2fs",
                             e.response.status_code, model_name, elapsed)
                raise RuntimeError(
                    f"LLM API HTTP 错误 (模型: {model_name}, 状态码: {e.response.status_code})"
                ) from e
            except httpx.TimeoutException as e:
                elapsed = time.monotonic() - t0
                logger.error("LLM API 超时, model=%s, duration=%.2fs", model_name, elapsed)
                raise RuntimeError(
                    f"LLM API 请求超时 (模型: {model_name}, 耗时: {elapsed:.1f}s)"
                ) from e
            except Exception as e:
                elapsed = time.monotonic() - t0
                logger.error("LLM API 调用失败: %s, model=%s, duration=%.2fs", e, model_name, elapsed)
                raise

    async def _call_api_stream(
        self, model: dict, messages: List[dict],
        on_chunk: Optional[callable] = None,
        extra_body: Optional[Dict] = None,
    ) -> str:
        """
        Streaming API call to the LLM endpoint (OpenAI-compatible SSE).
        Calls on_chunk(accumulated_text) for each delta token.
        Returns the full content string when done.
        """
        endpoint_url = model.get("endpoint_url", "")
        if not endpoint_url:
            raise RuntimeError(f"Model {model.get('model_name')} has no endpoint_url configured")

        # Resolve API key (same logic as _call_api)
        api_key = model.get("api_key", "")
        if api_key.startswith("encrypted:"):
            api_key = api_key[len("encrypted:"):]
        elif api_key:
            try:
                from app.utils.encrypt import decrypt_api_key
                api_key = decrypt_api_key(api_key)
            except Exception:
                pass

        payload = _build_payload(model, messages, extra_body=extra_body, stream=True)

        headers = {}
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"

        model_name = model["model_name"]
        t0 = time.monotonic()
        accumulated = ""

        async with _get_model_semaphore(model):
            try:
                client = await get_shared_client()
                async with client.stream("POST", endpoint_url, json=payload, headers=headers) as resp:
                    resp.raise_for_status()
                    async for line in resp.aiter_lines():
                        if not line.startswith("data: "):
                            continue
                        data_str = line[6:]
                        if data_str.strip() == "[DONE]":
                            break
                        try:
                            chunk = json.loads(data_str)
                            delta = chunk["choices"][0].get("delta", {}).get("content", "")
                            if delta:
                                accumulated += delta
                                if on_chunk:
                                    on_chunk(accumulated)
                        except (json.JSONDecodeError, KeyError, IndexError):
                            continue
                elapsed = time.monotonic() - t0
                logger.info("LLM API 流式调用完成, model=%s, duration=%.2fs, chars=%d",
                            model_name, elapsed, len(accumulated))
                return accumulated
            except httpx.HTTPStatusError as e:
                elapsed = time.monotonic() - t0
                logger.error("LLM API HTTP 错误 (stream): status=%d, model=%s, duration=%.2fs",
                             e.response.status_code, model_name, elapsed)
                raise RuntimeError(
                    f"LLM API HTTP 错误 (模型: {model_name}, 状态码: {e.response.status_code})"
                ) from e
            except httpx.TimeoutException as e:
                elapsed = time.monotonic() - t0
                logger.error("LLM API 超时 (stream), model=%s, duration=%.2fs", model_name, elapsed)
                raise RuntimeError(
                    f"LLM API 请求超时 (模型: {model_name}, 耗时: {elapsed:.1f}s)"
                ) from e
            except Exception as e:
                elapsed = time.monotonic() - t0
                logger.error("LLM API 流式调用失败: %s, model=%s, duration=%.2fs", e, model_name, elapsed)
                raise

    async def chat_stream(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        model_id: Optional[int] = None,
        purpose: Optional[str] = None,
        on_chunk: Optional[callable] = None,
        extra_body: Optional[Dict] = None,
    ) -> str:
        """
        Streaming chat endpoint. Calls on_chunk(accumulated_text) as tokens arrive.
        Returns parsed full content when done.
        """
        model = self._get_model_config(model_id=model_id, purpose=purpose)
        if not model:
            raise RuntimeError("No available model configuration")

        if system_prompt is None:
            system_prompt = model.get("config", {}).get("prompt", "")

        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        content = await self._call_api_stream(model, messages, on_chunk=on_chunk, extra_body=extra_body)
        return parse_llm_content(content)

    def _get_model_config(
        self,
        model_id: Optional[int] = None,
        purpose: Optional[str] = None,
    ) -> Optional[dict]:
        """Load model configuration from database by ID or purpose.

        Resolution order:
        1) explicit model_id —— 直接按 ID 查
        2) model bound to the given purpose —— 按 purpose 绑定查
        3) default model —— 兜底到页面配置的默认模型，
           避免新增 purpose 时必须先在 DB 里建立绑定才能跑
        """
        if model_id:
            return ModelRepo.get_by_id(model_id)
        if purpose:
            model = ModelRepo.get_by_purpose(purpose)
            if model:
                return model
            # 找不到对应 purpose 的模型时，回退到默认模型
            logger.warning(
                "No model bound to purpose=%s, falling back to default model",
                purpose,
            )
        return ModelRepo.get_default()
