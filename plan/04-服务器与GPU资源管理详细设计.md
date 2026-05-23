# 服务器与GPU资源管理详细设计

> 状态：[草案]  
> 创建时间：2026-05-21  
> 最后更新：2026-05-21

## 1. 模块目标

服务器管理模块负责把远程训练资源变成可被子任务安全选择的资源对象。它不仅要保存连接地址，还要完成：

- 远程连接方式配置。
- LLaMA-Factory 容器部署或校验。
- 环境信息探测。
- 工作目录选定。
- GPU 卡位拆分。
- 资源占用状态展示。
- 训练冲突预防。

## 2. 当前前端基础

当前 `ServersPage` 已有字段：

```js
{
  name,
  user,
  password,
  host,
  workDir,
  gpuIds,
  finetuneToolName,
  gpu,
  cuda,
  torch,
  finetuneTools,
  disk,
  status
}
```

这些字段可以直接过渡到 `ServerProfile`。后续需要补充物理服务器和 GPU 设备层。

## 3. 服务器配置流程

### 3.1 新增物理服务器

用户输入：

- 服务器名称
- 连接地址
- 连接方式：当前阶段可固定为 `Jupyter`
- Jupyter base URL
- Token 或凭据引用
- 备注

系统动作：

1. 保存物理服务器记录。
2. 使用执行器做最小连通性探测。
3. 拉取基础环境信息。
4. 拉取 GPU 列表。
5. 进入 GPU 切分配置。

### 3.2 探测命令

探测建议由后端发送一个 Python 脚本，输出 JSON：

```bash
python3 - <<'PY'
import json, os, shutil, subprocess, sys

def run(cmd):
    try:
        return subprocess.check_output(cmd, shell=True, stderr=subprocess.STDOUT, text=True, timeout=10).strip()
    except Exception as e:
        return ""

result = {
    "hostname": run("hostname"),
    "python": sys.version.split()[0],
    "cuda": run("python3 - <<'PY2'\nimport torch\nprint(torch.version.cuda or '')\nPY2"),
    "torch": run("python3 - <<'PY2'\nimport torch\nprint(torch.__version__)\nPY2"),
    "nvidia_smi": run("nvidia-smi --query-gpu=index,name,uuid,memory.total --format=csv,noheader,nounits"),
    "driver": run("nvidia-smi --query-gpu=driver_version --format=csv,noheader,nounits | head -1"),
    "llamafactory": run("llamafactory-cli version 2>/dev/null || python3 -m llamafactory.cli version 2>/dev/null"),
    "disk": run("df -B1 --output=source,size,used,avail,pcent,target / /home/jovyan/work 2>/dev/null | tail -n +2"),
    "pwd": os.getcwd(),
}
print(json.dumps(result, ensure_ascii=False))
PY
```

后端将 JSON 解析为页面字段。

## 4. LLaMA-Factory 容器管理

### 4.1 当前阶段

当前只基于已有 LLaMA-Factory 容器镜像和 Jupyter 入口，系统不负责部署容器，只负责：

- 检查容器内命令是否可用。
- 检查 GPU 是否透传。
- 检查工作目录是否可写。
- 检查 LLaMA-Factory 版本。

### 4.2 后续阶段

当沉淀出标准微调镜像后，服务器配置应支持：

- 镜像名称和版本选择。
- Docker 运行参数配置。
- GPU 映射配置。
- 数据目录挂载配置。
- 容器启动、停止、重启。
- 容器健康检查。

建议命令模板：

```bash
docker run -d \
  --name llamafactory-${server_profile_id} \
  --gpus '"device=0,1"' \
  -v /data/finetune:/workspace \
  -p 8888:8888 \
  bse/llamafactory:version
```

## 5. GPU 切分设计

### 5.1 目标

用户可以把一台多卡服务器拆成多个逻辑服务器对象，以便子任务选择时天然避免资源冲突。

示例：

```text
物理机 H800-01: 8 张 GPU
  H800-01-GPU0: gpuIds=0
  H800-01-GPU1: gpuIds=1
  H800-01-GPU2: gpuIds=2
  H800-01-GPU3: gpuIds=3
  H800-01-GPU4-7: gpuIds=4,5,6,7
```

### 5.2 页面交互建议

在服务器编辑弹窗中增加“GPU 资源配置”区：

- 显示探测到的 GPU 卡片。
- 每张卡显示：index、型号、显存、状态。
- 支持勾选 GPU IDs 作为当前服务器对象。
- 支持“一键按单卡拆分”。
- 支持“一键按多卡组合拆分”。

### 5.3 冲突校验

保存 ServerProfile 时校验：

- 同一物理服务器下，多个 ServerProfile 可以有 GPU 交集，但 UI 应提示。
- 子任务启动时，GPU 交集不能被 active lock 占用。
- 如果外部进程占用 GPU，状态应显示 `external_busy`，启动前需要二次确认或禁止启动。

## 6. 工作目录设计

每个 ServerProfile 需要工作目录：

```text
workDir/
  datasets/
  tasks/
    <task_id>/
      subtasks/
        <subtask_id>/
          train.yaml
          dataset_info.json
          run.sh
          logs/
          outputs/
          eval/
```

工作目录检查：

- 目录存在，不存在则可创建。
- 当前用户有写权限。
- 可用空间满足阈值。
- 支持刷新目录树。

## 7. 状态定义

### 7.1 服务器对象状态

| 状态 | 说明 |
|---|---|
| `unknown` | 未探测 |
| `online` | 可连接，环境正常 |
| `offline` | 无法连接 |
| `busy` | GPU 被任务占用 |
| `warning` | 可连接但环境不完整 |
| `disabled` | 用户禁用 |

### 7.2 GPU 状态

| 状态 | 说明 |
|---|---|
| `idle` | 可调度 |
| `locked` | 被系统任务占用 |
| `external_busy` | 被系统外进程占用 |
| `unknown` | 状态未知 |

## 8. API 概览

| 接口 | 说明 |
|---|---|
| `GET /api/servers` | 获取逻辑服务器对象列表 |
| `POST /api/physical-servers` | 新增物理服务器 |
| `POST /api/servers` | 新增逻辑服务器对象 |
| `PATCH /api/servers/:id` | 更新服务器对象 |
| `DELETE /api/servers/:id` | 删除服务器对象 |
| `POST /api/physical-servers/:id/probe` | 探测物理服务器 |
| `POST /api/servers/:id/probe` | 探测逻辑服务器对象 |
| `POST /api/servers/:id/check-workdir` | 检查工作目录 |
| `POST /api/servers/:id/split-gpus` | 按 GPU 生成多个服务器对象 |

## 9. 与当前前端的落地关系

第一阶段可以不大改 UI，只替换 mock：

- `testConnection()` 调 `POST /api/servers/probe-draft`。
- `testServerConnection(serverId)` 调 `POST /api/servers/:id/probe`。
- 返回结果继续写入现有 `envInfo` 和 `servers` 状态。

第二阶段再加入物理服务器/GPU 切分 UI。

