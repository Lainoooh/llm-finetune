from __future__ import annotations

import asyncio
import re
import time
from uuid import uuid4

from app.core.config import get_settings
from app.executors.base import RemoteExecutionError, RemoteExecutionResult
from app.executors.transport import RemoteTransport


ANSI_RE = re.compile(r"\x1b\][^\x07]*(?:\x07|\x1b\\)|\x1b\[[0-?]*[ -/]*[@-~]")


def clean_terminal_output(value: str) -> str:
    return ANSI_RE.sub("", value).replace("\r", "").lstrip().rstrip()


class QueuedRemoteSession:
    def __init__(self, transport: RemoteTransport):
        self.transport = transport
        self.settings = get_settings()
        self.generation = 0
        self.lock = asyncio.Lock()
        self.session_lock = asyncio.Lock()

    async def run_script(self, script: str, timeout_ms: int | None = None) -> RemoteExecutionResult:
        timeout = (timeout_ms or self.settings.remote_command_default_timeout_ms) / 1000
        async with self.lock:
            await self.ensure_connected()
            marker = f"__LLMFT_DONE_{uuid4().hex}_{int(time.time() * 1000)}__"
            # 在脚本内部注入结束标记
            modified_script = self._inject_marker(script, marker)
            output = ""
            stderr = ""
            try:
                # 直接发送完整脚本，不包装
                await self.transport.send(modified_script)
                while True:
                    frame = await asyncio.wait_for(self.transport.recv(), timeout=timeout)
                    content = frame.content or ""
                    if frame.kind == "stdout":
                        output += content
                    elif frame.kind == "stderr":
                        stderr += content
                        output += content
                    # 检测结束标记
                    if marker in output:
                        # 提取 JSON
                        json_output = self._extract_json(output)

                        return RemoteExecutionResult(
                            exit_code=0,
                            stdout=json_output,
                            stderr=clean_terminal_output(stderr),
                            raw_output=output,
                            generation=self.generation,
                        )
            except asyncio.TimeoutError as exc:
                await self.reset()
                raise RemoteExecutionError(f"Remote command timed out after {timeout_ms} ms", "COMMAND_TIMEOUT") from exc
            except Exception as exc:
                await self.reset()
                raise RemoteExecutionError(f"Remote session failed: {exc}", "REMOTE_SESSION_RESET") from exc

    async def ensure_connected(self) -> None:
        if self.transport.is_connected:
            return
        async with self.session_lock:
            if self.transport.is_connected:
                return
            await self.transport.connect()
            self.generation += 1
            await self._initialize_shell()

    async def _initialize_shell(self) -> None:
        # Jupyter 终端需要先接收初始提示符，否则后续命令不会执行
        # 等待并丢弃初始输出
        await asyncio.sleep(0.5)
        try:
            # 清空初始缓冲区（提示符等）
            while True:
                await asyncio.wait_for(self.transport.recv(), timeout=0.3)
        except asyncio.TimeoutError:
            # 缓冲区已清空
            pass
        return

    def _inject_marker(self, script: str, marker: str) -> str:
        """在脚本末尾（heredoc 之外）添加结束标记"""
        # 不要在 heredoc 内部注入，而是在脚本末尾添加
        # 这样 heredoc 可以正常执行，marker 在脚本执行完成后才输出
        return script.rstrip() + f'\necho "{marker}"\n'

    def _extract_json(self, output: str) -> str:
        """从输出中提取 JSON（在 __JSON_START__ 和 __JSON_END__ 之间）"""
        cleaned = clean_terminal_output(output)

        start_marker = "__JSON_START__"
        end_marker = "__JSON_END__"

        # 使用 rfind 查找最后一次出现（真正的输出，而不是输入回显）
        start_idx = cleaned.rfind(start_marker)
        end_idx = cleaned.rfind(end_marker)

        if start_idx != -1 and end_idx != -1 and start_idx < end_idx:
            # 提取标记之间的内容
            json_str = cleaned[start_idx + len(start_marker):end_idx].strip()
            return json_str

        # 如果没有找到标记，返回清理后的完整输出（向后兼容）
        return cleaned.strip()

    async def reset(self) -> None:
        await self.transport.close()
