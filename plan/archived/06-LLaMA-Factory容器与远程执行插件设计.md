# LLaMA-Factory容器与远程执行插件设计

> 状态：[草案]  
> 创建时间：2026-05-21  
> 最后更新：2026-05-21

## 1. 插件定位

当前无法直连训练服务器，只能通过 Jupyter 页面进入远程 LLaMA-Factory 容器终端。因此需要一个临时远程执行插件。

它的定位是：

- 为后端提供“在远程容器执行命令组并读取结果”的能力。
- 支撑服务器环境探测、工作目录检查、训练启动、日志读取、评测执行。
- 作为过渡方案存在，后续可替换为 SSH、Docker API 或 Kubernetes Job。

它不是：

- 前端组件。
- 业务模型。
- 通用 WebShell 产品。
- 长期唯一执行方式。

## 2. 为什么不能放在浏览器端

浏览器端直接连接 Jupyter 会带来问题：

- Token 暴露给用户浏览器。
- 任意前端脚本都可能获得远程 shell 能力。
- 队列、超时、重连和资源锁难以统一管理。
- 训练任务状态无法可靠持久化。

因此插件必须运行在后端或本地 sidecar 服务中，前端只调用业务 API。

## 3. 插件接口抽象

后端业务层只依赖统一接口：

```ts
interface RemoteExecutor {
  probe(server: ServerProfile): Promise<ProbeResult>
  run(server: ServerProfile, commandGroup: string, options?: RunOptions): Promise<RunResult>
  enqueue(server: ServerProfile, commandGroup: string, options?: RunOptions): Promise<RemoteTask>
  streamLogs(runId: string): AsyncIterable<LogChunk>
  reset(server: ServerProfile): Promise<void>
}
```

Jupyter 插件只是该接口的一个实现：

```text
RemoteExecutor
  ├── JupyterTerminalExecutor 当前阶段
  ├── SshExecutor 后续
  ├── DockerExecExecutor 后续
  └── KubernetesJobExecutor 后续
```

## 4. Jupyter Terminal 技术实现

Jupyter Terminal 使用：

- REST API 创建终端。
- WebSocket 建立交互通道。
- JSON frame 发送 stdin。
- JSON frame 接收 stdout/stderr。

流程：

```text
POST /jupyter/api/terminals
  -> {"name":"1"}

WS /jupyter/terminals/websocket/1?token=...
  -> ["stdin", "命令\n"]
  <- ["stdout", "输出"]
```

## 5. 长连接队列语义

每个 ServerProfile 对应一个会话管理器：

```text
JupyterSessionManager
  session generation: 1
  terminal name: 1
  websocket: connected
  queue:
    task A running
    task B queued
    task C queued
```

执行规则：

- 同一会话内 FIFO 串行执行命令组。
- 每个命令组带唯一结束标记。
- 每个命令组有超时时间。
- 当前命令完成后执行下一个。
- 会话断开、发送失败、超时、输出过大时触发 session reset。

会话 reset 规则：

```text
旧 session 挂掉
  -> 当前任务失败，状态 SESSION_RESET
  -> 旧队列全部失败，队列数据丢弃
  -> 删除旧 terminal，尽力清理
  -> 创建新 terminal
  -> 新 session generation +1
  -> 等待业务层重新提交命令
```

这符合当前预期：会话之间的队列互相独立，旧队列不迁移。

## 6. 命令组包装

业务层发送的是一套 shell 命令，而不是单行命令。

推荐包装方式：

1. 将命令组 base64 编码。
2. 写入远程临时脚本。
3. 使用 `bash script.sh` 执行。
4. 执行结束后输出唯一结束标记和退出码。

示例：

```bash
__file="$(mktemp /tmp/llmft.XXXXXX.sh)"
base64 -d > "$__file" <<'EOF'
<base64 script>
EOF
bash "$__file"
__code=$?
rm -f "$__file"
printf '\n__LLMFT_DONE_<task_id>__:%s\n' "$__code"
```

优点：

- 多行命令稳定。
- 引号和特殊字符不容易破坏交互 shell。
- 可通过结束标记确定输出边界。

## 7. 探测命令分类

### 7.1 环境探测

用于服务器管理页：

- hostname
- Python 版本
- PyTorch 版本
- CUDA 版本
- NVIDIA GPU 列表
- LLaMA-Factory 版本
- 磁盘容量
- 工作目录权限

### 7.2 文件操作

用于子任务配置页：

- 创建目录。
- 写入 `train.yaml`。
- 写入 `dataset_info.json`。
- 刷新目录树。
- 下载日志文件内容。

### 7.3 训练执行

用于启动子任务：

```bash
cd "$SUBTASK_DIR"
export CUDA_VISIBLE_DEVICES="0,1"
llamafactory-cli train train.yaml 2>&1 | tee logs/train.log
```

### 7.4 评测执行

用于测试评测页：

```bash
cd "$SUBTASK_DIR"
llamafactory-cli eval eval.yaml 2>&1 | tee eval/eval.log
```

## 8. 日志流设计

第一阶段可以通过 `/run` 同步返回命令输出。

训练任务需要长时间运行，应采用异步：

```text
POST /api/subtasks/:id/start
  -> 立即返回 runId

GET /api/runs/:runId/logs/stream
  -> SSE 推送 stdout/stderr
```

Jupyter 插件收到 stdout/stderr 后：

- 写入 ExecutionLog。
- 同时推送给订阅的前端。
- 后端解析 loss 指标。

## 9. 安全边界

必须遵守：

- Token 只放在后端环境变量或加密配置中。
- 前端不能直接接触 token。
- `/api/remote/run` 仅开发调试启用，生产关闭或加权限。
- 业务 API 只允许执行预定义动作，不允许任意用户自由输入 shell。
- 命令模板参数必须转义。
- 训练命令只能在配置的工作目录下运行。

## 10. 插件生命周期

| 阶段 | 执行器 |
|---|---|
| 原型验证 | Jupyter Terminal Executor |
| 内部试用 | Jupyter + 持久化任务状态 |
| 标准化部署 | SSH / Docker Exec |
| 多机规模化 | Kubernetes Job 或 Ray 等调度 |

因此实现时要把 Jupyter 逻辑隔离在 `plugins/jupyterTerminal`，不要散落到业务代码和前端组件中。

