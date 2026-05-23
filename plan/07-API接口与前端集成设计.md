# API接口与前端集成设计

> 状态：[草案]  
> 创建时间：2026-05-21  
> 最后更新：2026-05-21

## 1. 集成目标

当前前端是纯 mock，本阶段目标是以最小侵入方式加入 API 层：

- 保留现有页面结构。
- 新增 `src/api` 封装请求。
- 新增后端服务承接真实远程执行。
- 逐步替换 mock 行为。

## 2. 前端目录建议

```text
src/
  api/
    client.js
    serversApi.js
    tasksApi.js
    subtasksApi.js
    runsApi.js
  hooks/
    useServerProbe.js
    useRunLogs.js
  pages/
    ServersPage.jsx
    TaskDetailPage.jsx
    SubtaskPage.jsx
```

### 2.1 API client

职责：

- 统一 base URL。
- 统一 JSON 请求。
- 统一错误处理。

```js
export async function request(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    headers: { "content-type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);
  return data;
}
```

## 3. 后端目录建议

```text
server/
  index.mjs
  config/
    env.mjs
  routes/
    servers.mjs
    tasks.mjs
    subtasks.mjs
    runs.mjs
  services/
    serverService.mjs
    taskService.mjs
    subtaskService.mjs
    runService.mjs
  plugins/
    remoteExecutor/
      index.mjs
      jupyterTerminalExecutor.mjs
      sessionManager.mjs
      parsers.mjs
```

## 4. 服务器 API

### 4.1 获取服务器对象

```text
GET /api/servers
```

响应：

```json
{
  "items": [
    {
      "id": "srv-a-gpu0",
      "name": "A100-训练机-01-GPU0",
      "host": "47.94.137.97:30009",
      "status": "online",
      "gpuIds": "0",
      "gpu": "1 × NVIDIA A100 80GB",
      "cuda": "12.1",
      "torch": "2.4.0+cu121",
      "finetuneToolName": "LLaMA-Factory",
      "finetuneTools": {
        "LLaMA-Factory": "0.9.2.dev0"
      },
      "workDir": "/home/jovyan/work",
      "disk": "3.0TB / 3.5TB",
      "diskUsed": 3.0,
      "diskTotal": 3.5
    }
  ]
}
```

### 4.2 探测服务器

```text
POST /api/servers/:id/probe
```

响应：

```json
{
  "server": {
    "id": "srv-a-gpu0",
    "status": "online",
    "gpu": "1 × NVIDIA A100 80GB",
    "cuda": "12.1",
    "torch": "2.4.0+cu121",
    "finetuneTools": {
      "LLaMA-Factory": "0.9.2.dev0"
    },
    "disk": "3.0TB / 3.5TB",
    "diskUsed": 3.0,
    "diskTotal": 3.5
  },
  "raw": {}
}
```

### 4.3 探测未保存草稿

新增服务器弹窗中，用户还没保存时也需要测试：

```text
POST /api/servers/probe-draft
```

请求：

```json
{
  "name": "GPU 容器",
  "accessType": "jupyter",
  "jupyterBaseUrl": "http://47.94.137.97:30009/jupyter",
  "token": "仅后端开发环境可接受，生产需凭据引用",
  "workDir": "/home/jovyan/work",
  "gpuIds": "0"
}
```

第一阶段可用，后续应改为凭据配置，不允许前端提交 token。

## 5. 任务 API

### 5.1 任务列表

```text
GET /api/tasks
POST /api/tasks
PATCH /api/tasks/:id
DELETE /api/tasks/:id
POST /api/tasks/:id/clone
```

### 5.2 任务详情

```text
GET /api/tasks/:id
```

返回任务和子任务列表。

### 5.3 并行启动

```text
POST /api/tasks/:id/start
```

响应：

```json
{
  "started": ["task_001", "task_002"],
  "skipped": [
    {
      "subtaskId": "task_003",
      "reason": "GPU 0 is locked by task_001"
    }
  ]
}
```

## 6. 子任务 API

```text
POST /api/tasks/:taskId/subtasks
GET /api/subtasks/:id
PATCH /api/subtasks/:id
DELETE /api/subtasks/:id
POST /api/subtasks/:id/clone
POST /api/subtasks/:id/start
POST /api/subtasks/:id/stop
POST /api/subtasks/:id/sync
POST /api/subtasks/:id/evaluate
GET /api/subtasks/:id/files
GET /api/subtasks/:id/logs
```

### 6.1 启动子任务

```text
POST /api/subtasks/:id/start
```

后端动作：

- 校验配置完整。
- 校验服务器在线。
- 获取 GPU 锁。
- 创建 ExecutionRun。
- 生成并同步配置。
- 发送训练命令。

响应：

```json
{
  "runId": "run_123",
  "subtask": {
    "id": "task_002",
    "status": "running"
  }
}
```

## 7. 执行记录与日志 API

### 7.1 执行记录

```text
GET /api/runs/:id
```

### 7.2 日志流

```text
GET /api/runs/:id/logs/stream
```

建议用 SSE：

```text
event: log
data: {"stream":"stdout","content":"step=10 loss=2.114"}

event: status
data: {"status":"succeeded","exitCode":0}
```

原因：

- 前端接入简单。
- 训练日志是服务端到客户端单向流。
- 不需要浏览器直接参与远程 WebSocket。

## 8. Vite 代理配置

开发阶段在 `vite.config.js` 增加：

```js
server: {
  port: 3000,
  open: true,
  proxy: {
    "/api": "http://127.0.0.1:8787"
  }
}
```

前端始终请求 `/api/...`。

## 9. 当前页面替换计划

### 9.1 ServersPage

替换：

- `testConnection()` 从 mock 改为 `probeDraftServer(draft)`。
- `testServerConnection(serverId)` 从 mock 改为 `probeServer(serverId)`。
- `batchTestConnection()` 保留，循环调用 API。

### 9.2 TaskListPage

替换：

- `rows` 从硬编码改为 `GET /api/tasks`。
- 新建、编辑、复制、删除接 API。

### 9.3 TaskDetailPage

替换：

- `createNewSubtask()` 接 `POST /api/tasks/:id/subtasks`。
- `startAll()` 接 `POST /api/tasks/:id/start`。
- 复制、删除接 API。

### 9.4 SubtaskPage

替换：

- 服务器选择来自 API。
- 保存配置接 `PATCH /api/subtasks/:id`。
- 同步到远程接 `POST /api/subtasks/:id/sync`。
- 刷新目录接 `GET /api/subtasks/:id/files`。
- 启动训练接 `POST /api/subtasks/:id/start`。
- 停止训练接 `POST /api/subtasks/:id/stop`。
- 日志接 SSE。
- 执行评测接 `POST /api/subtasks/:id/evaluate`。

### 9.5 ComparePage

替换：

- Loss 曲线从 `GET /api/tasks/:id/metrics` 获取。
- 评测结果从 `GET /api/tasks/:id/evaluations` 获取。
- 导出报告接 `POST /api/tasks/:id/report`。

## 10. 错误处理规范

后端错误响应：

```json
{
  "code": "GPU_LOCKED",
  "message": "GPU 0 is locked by task_001",
  "details": {}
}
```

常见错误码：

| code | 说明 |
|---|---|
| `SERVER_OFFLINE` | 服务器无法连接 |
| `ENV_INVALID` | 环境缺少必要工具 |
| `GPU_LOCKED` | GPU 被占用 |
| `WORKDIR_NOT_WRITABLE` | 工作目录不可写 |
| `REMOTE_SESSION_RESET` | Jupyter 会话重建，需重试 |
| `COMMAND_TIMEOUT` | 远程命令超时 |
| `TRAIN_FAILED` | 训练命令失败 |

