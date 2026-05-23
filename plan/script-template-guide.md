# 脚本模板配置指南

## 概述

本文档定义了项目中脚本模板的标准配置方式。所有新增脚本必须严格遵循此规范。

---

## 核心设计原则

### 1. 变量注入机制

**不使用模板占位符**（如 `{{variable}}`），而是在 Python 脚本开头直接注入变量定义。

**工作流程：**
1. 用户调用脚本时传入参数：`{"work_dir": "/home/jovyan/work", "gpu_ids": "0"}`
2. `render_script()` 函数将参数转换为 Python 变量定义并注入到脚本开头
3. 脚本中直接使用这些变量

**示例：**

调用：
```python
render_script(script, {"work_dir": "/home/jovyan/work", "gpu_ids": "0"})
```

生成的脚本：
```python
python3 - <<'PY'
WORK_DIR = '/home/jovyan/work'
GPU_IDS = '0'

# 脚本逻辑直接使用 WORK_DIR 和 GPU_IDS
```

### 2. JSON 输出规范

所有脚本必须使用 JSON 边界标记包围输出：

```python
print("__JSON_START__")
print(json.dumps(result, ensure_ascii=False))
print("__JSON_END__")
```

执行器会提取这两个标记之间的内容作为脚本输出。

### 3. 避免转义问题

**问题：** Docker 格式字符串 `{{.Names}}` 会与模板语法冲突

**解决方案：** 使用 Python 变量存储

```python
# ✅ 正确
docker_format = "{{.Names}}"
cmd = "docker ps --format '" + docker_format + "' | grep xxx"

# ❌ 错误（会被模板渲染器处理）
cmd = f"docker ps --format '{{.Names}}' | grep xxx"
```

---

## 脚本模板结构

### 标准模板格式

```python
SCRIPT_TEMPLATE = r'''
python3 - <<'PY'
import json, os, subprocess, sys

# 变量将在这里注入（由 render_script 自动添加）
# 例如：PARAM1 = 'value1'
#       PARAM2 = 'value2'

# 脚本逻辑
def main():
    # 直接使用注入的变量
    result = {
        "status": "success",
        "param1": PARAM1,
        "param2": PARAM2
    }
    return result

# 执行并输出
result = main()

print("__JSON_START__")
print(json.dumps(result, ensure_ascii=False))
print("__JSON_END__")
PY
'''
```

### 必需元素

1. **以 `python3 - <<'PY'` 开头**
   - `render_script` 依赖此标记来注入变量

2. **导入必要的模块**
   ```python
   import json, os, subprocess, sys
   ```

3. **JSON 边界标记**
   ```python
   print("__JSON_START__")
   print(json.dumps(result, ensure_ascii=False))
   print("__JSON_END__")
   ```

4. **以 `PY` 结尾**
   ```python
   PY
   '''
   ```

---

## 新增脚本步骤

### 步骤 1：定义脚本模板

在 `backend/app/services/script_service.py` 中添加：

```python
NEW_SCRIPT_TEMPLATE = r'''
python3 - <<'PY'
import json, os, subprocess, sys

# 变量将在这里注入

# 脚本逻辑
def your_function():
    # 使用注入的变量：PARAM1, PARAM2 等
    result = {"status": "success"}
    return result

result = your_function()

print("__JSON_START__")
print(json.dumps(result, ensure_ascii=False))
print("__JSON_END__")
PY
'''
```

### 步骤 2：添加到 BUILTIN_SCRIPTS

```python
BUILTIN_SCRIPTS = [
    # ... 现有脚本 ...
    {
        "key": "category.script_name",        # 脚本唯一标识（必须唯一）
        "name": "脚本显示名称",                # 用户界面显示的名称
        "category": "category",               # 分类：server, dataset, task 等
        "description": "脚本功能描述",         # 简短描述脚本用途
        "template": NEW_SCRIPT_TEMPLATE,      # 使用上面定义的模板
        "param_schema_json": json.dumps(
            {
                "required": ["param1"],       # 必需参数列表
                "properties": {
                    "param1": {
                        "type": "text",       # 参数类型：text, path, gpu_ids
                        "description": "参数1描述"
                    },
                    "param2": {
                        "type": "text",
                        "description": "参数2描述（可选）"
                    },
                },
            },
            ensure_ascii=False,
        ),
        "timeout_ms": 30_000,                 # 超时时间（毫秒）
        "risk_level": "low",                  # 风险级别：low, medium, high
    },
]
```

### 步骤 3：更新数据库

修改完成后，运行更新脚本：

```bash
cd backend
source .venv/bin/activate
python3 -c "
import sys
sys.path.insert(0, '.')
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from app.services.script_service import seed_builtin_scripts

engine = create_engine('sqlite:///./data/llm_finetune.db')
with Session(engine) as db:
    seed_builtin_scripts(db)
    print('✅ 数据库更新完成')
"
```

### 步骤 4：测试脚本

创建测试文件验证脚本：

```python
#!/usr/bin/env python3
import asyncio
import sys
sys.path.insert(0, 'backend')

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session
from app.models import ScriptTemplate
from app.services.script_service import render_script
from app.executors.jupyter_terminal.transport import JupyterTransport, JupyterEndpoint
from app.executors.queued_session import QueuedRemoteSession

async def test():
    engine = create_engine("sqlite:///backend/data/llm_finetune.db")
    with Session(engine) as db:
        script = db.scalar(
            select(ScriptTemplate).where(ScriptTemplate.key == 'your.script.key')
        )
        rendered = render_script(script, {
            "param1": "value1",
            "param2": "value2"
        })

    endpoint = JupyterEndpoint(
        base_url="http://your-jupyter-url",
        token="your-token"
    )
    transport = JupyterTransport(endpoint)
    session = QueuedRemoteSession(transport)

    try:
        result = await session.run_script(rendered, timeout_ms=script.timeout_ms)
        print(f"✅ 成功！")
        print(f"输出: {result.stdout}")
    except Exception as e:
        print(f"❌ 失败: {e}")
    finally:
        await transport.close()

if __name__ == "__main__":
    asyncio.run(test())
```

---

## 配置规则

### ✅ 必须遵守

1. **脚本必须以 `python3 - <<'PY'` 开头**
   - `render_script` 依赖此标记注入变量

2. **参数名转换为大写变量**
   - `work_dir` → `WORK_DIR`
   - `gpu_ids` → `GPU_IDS`
   - `container_name` → `CONTAINER_NAME`

3. **必须输出 JSON 边界标记**
   ```python
   print("__JSON_START__")
   print(json.dumps(result, ensure_ascii=False))
   print("__JSON_END__")
   ```

4. **不使用模板占位符**
   - ❌ 不要使用 `{{variable}}`
   - ✅ 直接使用 Python 变量

5. **Docker/Shell 格式字符串使用变量**
   ```python
   # ✅ 正确
   docker_format = "{{.Names}}"
   cmd = "docker ps --format '" + docker_format + "'"
   
   # ❌ 错误
   cmd = "docker ps --format '{{.Names}}'"
   ```

### ❌ 禁止事项

1. ❌ **不要使用环境变量**
   ```python
   # ❌ 错误
   WORK_DIR = os.environ.get("WORK_DIR", "")
   
   # ✅ 正确（变量会被自动注入）
   # WORK_DIR 直接使用
   ```

2. ❌ **不要在模板中使用 export**
   ```bash
   # ❌ 错误
   export WORK_DIR="/path"
   python3 - <<'PY'
   ```

3. ❌ **不要在 f-string 中使用 `{{` 和 `}}`**
   ```python
   # ❌ 错误
   cmd = f"docker ps --format '{{.Names}}'"
   
   # ✅ 正确
   fmt = "{{.Names}}"
   cmd = f"docker ps --format '{fmt}'"
   ```

4. ❌ **不要使用模板占位符语法**
   ```python
   # ❌ 错误
   WORK_DIR = """{{work_dir}}"""
   
   # ✅ 正确（自动注入）
   # WORK_DIR 变量会被自动定义
   ```

---

## 完整示例

### 示例 1：数据集准备脚本

```python
# 1. 定义模板
DATASET_PREPARE_TEMPLATE = r'''
python3 - <<'PY'
import json, os, subprocess, sys

# 变量将在这里注入：DATASET_PATH, OUTPUT_DIR

# 创建输出目录
try:
    os.makedirs(OUTPUT_DIR, exist_ok=True)
except Exception as e:
    result = {"success": False, "error": str(e)}
    print("__JSON_START__")
    print(json.dumps(result, ensure_ascii=False))
    print("__JSON_END__")
    sys.exit(0)

# 处理数据集
def prepare_dataset():
    cmd = f"python prepare.py --input {DATASET_PATH} --output {OUTPUT_DIR}"
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    
    return {
        "success": result.returncode == 0,
        "dataset_path": DATASET_PATH,
        "output_dir": OUTPUT_DIR,
        "message": result.stdout if result.returncode == 0 else result.stderr
    }

result = prepare_dataset()

print("__JSON_START__")
print(json.dumps(result, ensure_ascii=False))
print("__JSON_END__")
PY
'''

# 2. 添加到 BUILTIN_SCRIPTS
{
    "key": "dataset.prepare",
    "name": "数据集准备",
    "category": "dataset",
    "description": "准备和预处理训练数据集",
    "template": DATASET_PREPARE_TEMPLATE,
    "param_schema_json": json.dumps({
        "required": ["dataset_path", "output_dir"],
        "properties": {
            "dataset_path": {"type": "path", "description": "数据集路径"},
            "output_dir": {"type": "path", "description": "输出目录"},
        },
    }, ensure_ascii=False),
    "timeout_ms": 60_000,
    "risk_level": "low",
}
```

### 示例 2：模型训练脚本

```python
# 1. 定义模板
MODEL_TRAIN_TEMPLATE = r'''
python3 - <<'PY'
import json, os, subprocess, sys, time

# 变量将在这里注入：MODEL_NAME, DATASET_PATH, OUTPUT_DIR, GPU_IDS

timings = {}

def run_command(cmd, timeout=300, name="cmd"):
    started = time.time()
    try:
        result = subprocess.run(
            cmd, 
            shell=True, 
            capture_output=True, 
            text=True, 
            timeout=timeout
        )
        return {
            "success": result.returncode == 0,
            "stdout": result.stdout,
            "stderr": result.stderr,
            "returncode": result.returncode
        }
    except subprocess.TimeoutExpired:
        return {"success": False, "error": "命令超时"}
    except Exception as e:
        return {"success": False, "error": str(e)}
    finally:
        timings[name] = round(time.time() - started, 3)

# 构建训练命令
train_cmd = f"CUDA_VISIBLE_DEVICES={GPU_IDS} python train.py "
train_cmd += f"--model {MODEL_NAME} "
train_cmd += f"--data {DATASET_PATH} "
train_cmd += f"--output {OUTPUT_DIR}"

# 执行训练
result = run_command(train_cmd, timeout=3600, name="train")

# 输出结果
output = {
    "success": result["success"],
    "model_name": MODEL_NAME,
    "output_dir": OUTPUT_DIR,
    "gpu_ids": GPU_IDS,
    "timings": timings
}

if not result["success"]:
    output["error"] = result.get("error") or result.get("stderr")

print("__JSON_START__")
print(json.dumps(output, ensure_ascii=False))
print("__JSON_END__")
PY
'''

# 2. 添加到 BUILTIN_SCRIPTS
{
    "key": "model.train",
    "name": "模型训练",
    "category": "model",
    "description": "启动模型训练任务",
    "template": MODEL_TRAIN_TEMPLATE,
    "param_schema_json": json.dumps({
        "required": ["model_name", "dataset_path", "output_dir"],
        "properties": {
            "model_name": {"type": "text", "description": "模型名称"},
            "dataset_path": {"type": "path", "description": "数据集路径"},
            "output_dir": {"type": "path", "description": "输出目录"},
            "gpu_ids": {"type": "gpu_ids", "description": "GPU 设备编号"},
        },
    }, ensure_ascii=False),
    "timeout_ms": 3600_000,  # 1 小时
    "risk_level": "medium",
}
```

---

## 参数类型说明

### 支持的参数类型

| 类型 | 说明 | 示例 |
|------|------|------|
| `text` | 普通文本 | `"LLaMA-Factory"` |
| `path` | 文件或目录路径 | `"/home/jovyan/work"` |
| `gpu_ids` | GPU 设备编号 | `"0"` 或 `"0,1,2"` |

### 参数定义示例

```python
"param_schema_json": json.dumps({
    "required": ["必需参数1", "必需参数2"],
    "properties": {
        "必需参数1": {
            "type": "text",
            "description": "参数描述"
        },
        "可选参数": {
            "type": "path",
            "description": "参数描述"
        },
    },
}, ensure_ascii=False)
```

---

## 常见问题

### Q1: 为什么不使用 `{{variable}}` 占位符？

**A:** 占位符语法会与 Docker 格式字符串（如 `{{.Names}}`）冲突，导致需要复杂的转义规则。直接在 Python 中注入变量更简单、更可靠。

### Q2: 如何处理 Docker 格式字符串？

**A:** 使用 Python 变量存储：

```python
docker_format = "{{.Names}}"
cmd = "docker ps --format '" + docker_format + "'"
```

### Q3: 变量名如何转换？

**A:** 参数名会自动转换为大写：
- `work_dir` → `WORK_DIR`
- `container_name` → `CONTAINER_NAME`

### Q4: 如何处理可选参数？

**A:** 在脚本中检查变量是否存在：

```python
# 检查可选参数
gpu_ids = GPU_IDS if 'GPU_IDS' in dir() else "0"
```

或者在 `param_schema_json` 中不将其列入 `required`。

### Q5: 脚本执行失败如何调试？

**A:** 
1. 检查 `backend.log` 查看后端日志
2. 使用测试脚本直接调用执行器
3. 检查 `raw_output` 查看完整输出

---

## 版本历史

| 版本 | 日期 | 说明 |
|------|------|------|
| 1.0 | 2026-05-23 | 初始版本，定义脚本模板标准规范 |

---

## 相关文件

- `backend/app/services/script_service.py` - 脚本模板定义
- `backend/app/executors/queued_session.py` - 脚本执行器
- `backend/app/models.py` - ScriptTemplate 模型定义

---

**严格遵循本规范，确保所有脚本的一致性和可维护性。**
