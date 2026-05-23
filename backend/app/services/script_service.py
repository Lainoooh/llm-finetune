import json
import re
import shlex
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import ExecutionRun, ScriptTemplate
from app.schemas import ScriptCreateIn
from app.services.codegen import public_code


SERVER_HARDWARE_PROBE_TEMPLATE = r'''
python3 - <<'PY'
import json, os, shlex, subprocess, sys, time

# 变量将在这里注入

timings = {}

def run(cmd, timeout=5, name="cmd"):
    started = time.time()
    try:
        result = subprocess.check_output(cmd, shell=True, stderr=subprocess.STDOUT, text=True, timeout=timeout).strip()
        return result
    except subprocess.TimeoutExpired:
        return ""
    except Exception:
        return ""
    finally:
        timings[name] = round(time.time() - started, 3)

def disk(path):
    out = run(f"df -B1 --output=size,used,avail,pcent,target {path!r} 2>/dev/null | tail -1", timeout=3, name="disk")
    parts = out.split()
    if len(parts) >= 5:
        return {
            "size": int(parts[0]),
            "used": int(parts[1]),
            "avail": int(parts[2]),
            "percent": parts[3],
            "target": parts[4],
        }
    return None

def split_ids(value):
    return [item.strip() for item in value.split(",") if item.strip()]

def detect_accelerators():
    nvidia_csv = run("nvidia-smi --query-gpu=index,name,uuid,memory.total,memory.used --format=csv,noheader,nounits", timeout=6, name="nvidia_smi_query")
    if nvidia_csv:
        return {
            "vendor": "nvidia",
            "runtime": "cuda",
            "driver": run("nvidia-smi --query-gpu=driver_version --format=csv,noheader,nounits | head -1", timeout=4, name="nvidia_driver"),
            "csv": nvidia_csv,
        }
    # Vendor hooks:
    # - Huawei Ascend/NPU can be adapted here via npu-smi and torch_npu checks.
    # - Alibaba PPU or other accelerators can return the same csv contract:
    #   index,name,uuid,memory.total,memory.used
    return {"vendor": "unknown", "runtime": "-", "driver": "-", "csv": ""}

# 创建工作目录
try:
    os.makedirs(WORK_DIR, exist_ok=True)
except Exception:
    pass

accelerator = detect_accelerators()
accelerator_ids = split_ids(GPU_IDS)
if accelerator_ids:
    accelerator_count = len(accelerator_ids)
else:
    csv_lines = [line for line in accelerator["csv"].splitlines() if line.strip()]
    accelerator_count = len(csv_lines)

payload = {
    "hostname": run("hostname", timeout=2, name="hostname"),
    "pwd": os.getcwd(),
    "work_dir": WORK_DIR,
    "work_dir_exists": os.path.exists(WORK_DIR),
    "work_dir_writable": os.access(WORK_DIR, os.W_OK) if os.path.exists(WORK_DIR) else False,
    "driver": accelerator["driver"],
    "gpus_csv": accelerator["csv"],
    "selected_gpu_ids": GPU_IDS,
    "accelerator_vendor": accelerator["vendor"],
    "accelerator_runtime": accelerator["runtime"],
    "accelerator_driver": accelerator["driver"],
    "accelerators_csv": accelerator["csv"],
    "accelerator_ids": GPU_IDS,
    "accelerator_count": accelerator_count,
    "disk": disk(WORK_DIR if os.path.exists(WORK_DIR) else "/"),
    "timings": timings,
}
print("__JSON_START__")
print(json.dumps(payload, ensure_ascii=False))
print("__JSON_END__")
PY'''


SERVER_FINETUNE_ENV_PROBE_TEMPLATE = r'''python3 - <<'PY'
import json, os, shlex, subprocess, time

# 变量将在这里注入

timings = {}

def run(cmd, timeout=8, name="cmd"):
    started = time.time()
    try:
        result = subprocess.check_output(cmd, shell=True, stderr=subprocess.STDOUT, text=True, timeout=timeout).strip()
        return result
    except subprocess.TimeoutExpired:
        return ""
    except Exception:
        return ""
    finally:
        timings[name] = round(time.time() - started, 3)

def emit(payload):
    payload["timings"] = timings
    print("__JSON_START__")
    print(json.dumps(payload, ensure_ascii=False))
    print("__JSON_END__")

# 处理变量
container = CONTAINER_NAME.strip() if 'CONTAINER_NAME' in dir() else ""
tool_name = FINETUNE_TOOL_NAME.strip() if 'FINETUNE_TOOL_NAME' in dir() else "LLaMA-Factory"
tool_name = tool_name or "LLaMA-Factory"

if not container:
    emit({"ok": False, "error": "微调工具容器名不能为空", "container_name": container})
    raise SystemExit(0)

docker_format = "{{.Names}}"
exists = run("docker ps --format '" + docker_format + "' | grep -Fx " + shlex.quote(container), timeout=5, name="container_lookup")
if not exists:
    emit({"ok": False, "error": f"没有找到 {container} 容器", "container_name": container})
    raise SystemExit(0)

env_json = run(f"""docker exec {shlex.quote(container)} python3 -c "
import json, sys

def version(module):
    try:
        mod = __import__(module)
        return str(getattr(mod, '__version__', '-'))
    except Exception as exc:
        return f'missing: {{exc}}'

result = {{
    'python': sys.version.split()[0],
    'pytorch': version('torch'),
    'transformers': version('transformers'),
}}
print(json.dumps(result, ensure_ascii=False))
" """, timeout=10, name="finetune_env")
try:
    env_info = json.loads(env_json) if env_json else {}
except Exception:
    env_info = {}

tool_version = run(f"docker exec {shlex.quote(container)} bash -c 'llamafactory-cli version 2>/dev/null || python3 -m llamafactory.cli version 2>/dev/null'", timeout=10, name="finetune_tool")

emit({
    "ok": True,
    "container_name": container,
    "finetune_tool_name": tool_name,
    "finetune_tool_version": tool_version or "-",
    "python": env_info.get("python", "-"),
    "pytorch": env_info.get("pytorch", "-"),
    "transformers": env_info.get("transformers", "-"),
})
PY'''


BUILTIN_SCRIPTS = [
    {
        "key": "server.probe_hardware",
        "name": "服务器硬件与工作目录探测",
        "category": "server",
        "description": "创建工作目录，探测显卡、驱动、磁盘和目录权限。",
        "template": SERVER_HARDWARE_PROBE_TEMPLATE,
        "param_schema_json": json.dumps(
            {
                "required": ["work_dir"],
                "properties": {
                    "work_dir": {"type": "path", "description": "工作目录"},
                    "gpu_ids": {"type": "gpu_ids", "description": "显卡设备编号"},
                },
            },
            ensure_ascii=False,
        ),
        "timeout_ms": 45_000,
        "risk_level": "low",
    },
    {
        "key": "server.probe_finetune_env",
        "name": "微调容器环境探测",
        "category": "server",
        "description": "进入微调工具容器探测 Python、PyTorch、Transformers 和微调工具版本。",
        "template": SERVER_FINETUNE_ENV_PROBE_TEMPLATE,
        "param_schema_json": json.dumps(
            {
                "required": ["container_name", "finetune_tool_name"],
                "properties": {
                    "container_name": {"type": "text", "description": "微调工具容器名"},
                    "finetune_tool_name": {"type": "text", "description": "微调工具名称"},
                },
            },
            ensure_ascii=False,
        ),
        "timeout_ms": 30_000,
        "risk_level": "low",
    },
    {
        "key": "server.probe_env",
        "name": "服务器环境探测（兼容）",
        "category": "server",
        "description": "兼容旧入口：仅探测硬件、工作目录和磁盘。",
        "template": SERVER_HARDWARE_PROBE_TEMPLATE,
        "param_schema_json": json.dumps(
            {
                "required": ["work_dir"],
                "properties": {
                    "work_dir": {"type": "path", "description": "工作目录"},
                    "gpu_ids": {"type": "gpu_ids", "description": "显卡设备编号"},
                },
            },
            ensure_ascii=False,
        ),
        "timeout_ms": 45_000,
        "risk_level": "low",
    },
]


def seed_builtin_scripts(db: Session) -> None:
    for item in BUILTIN_SCRIPTS:
        existing = db.scalar(
            select(ScriptTemplate).where(
                ScriptTemplate.key == item["key"],
                ScriptTemplate.version == 1,
            )
        )
        if existing:
            existing.name = item["name"]
            existing.category = item["category"]
            existing.description = item["description"]
            existing.shell = item.get("shell", "bash")
            existing.template = item["template"]
            existing.param_schema_json = item["param_schema_json"]
            existing.output_type = item.get("output_type", "json")
            existing.parser_type = item.get("parser_type", "json")
            existing.timeout_ms = item["timeout_ms"]
            existing.allow_parallel = item.get("allow_parallel", False)
            existing.risk_level = item["risk_level"]
            continue
        db.add(ScriptTemplate(version=1, status="active", shell="bash", output_type="json", parser_type="json", **item))
    db.commit()


def list_scripts(db: Session) -> list[ScriptTemplate]:
    return list(db.scalars(select(ScriptTemplate).order_by(ScriptTemplate.category, ScriptTemplate.key)))


def get_active_script(db: Session, key: str) -> ScriptTemplate:
    script = db.scalar(
        select(ScriptTemplate)
        .where(ScriptTemplate.key == key, ScriptTemplate.status == "active")
        .order_by(ScriptTemplate.version.desc())
    )
    if not script:
        raise KeyError(f"Script not found: {key}")
    return script


def get_script(db: Session, key: str) -> ScriptTemplate:
    script = db.scalar(select(ScriptTemplate).where(ScriptTemplate.key == key).order_by(ScriptTemplate.version.desc()))
    if not script:
        raise KeyError(f"Script not found: {key}")
    return script


def create_script(db: Session, payload: ScriptCreateIn) -> ScriptTemplate:
    existing = db.scalar(select(ScriptTemplate).where(ScriptTemplate.key == payload.key, ScriptTemplate.version == 1))
    if existing:
        raise ValueError(f"Script already exists: {payload.key}")
    script = ScriptTemplate(
        key=payload.key,
        name=payload.name,
        category=payload.category,
        version=1,
        status="active",
        description=payload.description,
        shell=payload.shell,
        template=payload.template,
        param_schema_json=json.dumps(payload.paramSchema, ensure_ascii=False),
        output_type=payload.outputType,
        parser_type=payload.parserType,
        timeout_ms=payload.timeoutMs,
        allow_parallel=payload.allowParallel,
        risk_level=payload.riskLevel,
    )
    db.add(script)
    db.commit()
    db.refresh(script)
    return script


def create_script_version(db: Session, key: str, payload: ScriptCreateIn) -> ScriptTemplate:
    latest = get_script(db, key)
    latest.status = "archived"
    script = ScriptTemplate(
        key=key,
        name=payload.name or latest.name,
        category=payload.category or latest.category,
        version=latest.version + 1,
        status="active",
        description=payload.description,
        shell=payload.shell,
        template=payload.template,
        param_schema_json=json.dumps(payload.paramSchema, ensure_ascii=False),
        output_type=payload.outputType,
        parser_type=payload.parserType,
        timeout_ms=payload.timeoutMs,
        allow_parallel=payload.allowParallel,
        risk_level=payload.riskLevel,
    )
    db.add(script)
    db.commit()
    db.refresh(script)
    return script


def update_script_status(db: Session, key: str, status: str) -> ScriptTemplate:
    script = get_script(db, key)
    script.status = status
    db.commit()
    db.refresh(script)
    return script


def list_script_runs(db: Session, key: str) -> list[ExecutionRun]:
    return list(db.scalars(select(ExecutionRun).where(ExecutionRun.script_key == key).order_by(ExecutionRun.created_at.desc())))


def create_test_run(db: Session, script: ScriptTemplate, rendered: str) -> ExecutionRun:
    run = ExecutionRun(
        run_code=public_code("run"),
        run_type="script_test",
        target_type="script",
        status="succeeded",
        script_key=script.key,
        script_version=script.version,
        rendered_script=rendered,
        stdout="脚本测试已创建；当前为本地 fake executor 验证结果。",
        exit_code=0,
    )
    db.add(run)
    db.commit()
    db.refresh(run)
    return run


def _quote_param(value: Any) -> str:
    # Templates put values inside triple quotes for readability. Escape the only
    # sequence that can break out of a Python triple quoted string.
    return str(value).replace('"""', r"\"\"\"")


def render_script(script: ScriptTemplate, params: dict[str, Any]) -> str:
    schema = json.loads(script.param_schema_json or "{}")
    required = schema.get("required", [])
    for key in required:
        if key not in params or params[key] in (None, ""):
            raise ValueError(f"Missing required script param: {key}")

    allowed = set(schema.get("properties", {}).keys())
    for key in params:
        if allowed and key not in allowed:
            raise ValueError(f"Unknown script param: {key}")

    # 构建变量定义（Python 代码）
    var_definitions = []
    for key, value in params.items():
        # 转换为大写的 Python 变量名
        var_name = key.upper()
        # 使用 repr() 确保字符串被正确引号包围
        var_definitions.append(f"{var_name} = {repr(value)}")

    var_block = "\n".join(var_definitions)

    # 在 Python heredoc 开头注入变量定义
    # 查找 "python3 - <<'PY'\n" 并在其后插入变量定义
    if "python3 - <<'PY'" in script.template:
        return script.template.replace(
            "python3 - <<'PY'\n",
            f"python3 - <<'PY'\n{var_block}\n\n"
        )

    # 如果没有 Python heredoc，返回原模板
    return script.template


def shell_quote(value: str) -> str:
    return shlex.quote(value)
