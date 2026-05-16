# API 接口设计文档 [已实现]

<!-- Updated: 2026-04-27 新增模型管理(parents/children/batch)、工作流(start/resume/step-data)、指标值、问询函等端点 -->

## 1. API 概述

### 1.1 基础信息

- **Base URL**: `http://localhost:30001/api`
- **认证方式**: Bearer Token (JWT)
- **数据格式**: JSON
- **CORS**: 允许所有来源（开发环境）

### 1.2 认证机制

所有 API 请求（除登录外）需要在 Header 中携带 Token：

```http
Authorization: Bearer <token>
```

### 1.3 错误响应格式

```json
{
  "detail": "错误信息"
}
```

---

## 2. 认证接口 `/api/auth`

### 2.1 登录

```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "admin123"
}
```

**响应**:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": 1,
    "username": "admin",
    "role": "admin"
  }
}
```

---

## 3. 模型管理接口 `/api/models`

### 3.1 获取活跃模型列表

```http
GET /api/models/active
```

**响应**:
```json
[
  {
    "id": 1,
    "vendor": "aliyun",
    "model_name": "Qwen3-32B",
    "is_default": true
  }
]
```

---

## 4. 对话管理接口 `/api/conversations`

### 4.1 创建对话

```http
POST /api/conversations
Content-Type: application/json

{
  "title": "海希通讯2024年报审查"
}
```

**响应**:
```json
{
  "id": "conv-xxx",
  "title": "海希通讯2024年报审查",
  "owner_id": 1,
  "created_at": "2026-04-24T10:00:00"
}
```

### 4.2 获取对话列表

```http
GET /api/conversations
```

**响应**:
```json
[
  {
    "id": "conv-xxx",
    "title": "海希通讯2024年报审查",
    "created_at": "2026-04-24T10:00:00",
    "updated_at": "2026-04-24T10:30:00"
  }
]
```

### 4.3 获取单个对话

```http
GET /api/conversations/{conv_id}
```

### 4.4 删除对话

```http
DELETE /api/conversations/{conv_id}
```

**响应**:
```json
{
  "message": "对话已删除"
}
```

---

## 5. 消息接口 `/api`

### 5.1 获取对话消息

```http
GET /api/conversations/{conv_id}/messages
```

**响应**:
```json
[
  {
    "id": "msg-001",
    "conversation_id": "conv-xxx",
    "role": "user",
    "content": "审查海希通讯2024年报",
    "message_type": "text",
    "created_at": "2026-04-24T10:00:00"
  },
  {
    "id": "msg-002",
    "conversation_id": "conv-xxx",
    "role": "assistant",
    "content": "正在创建审查任务...",
    "message_type": "text",
    "task_id": "task-xxx",
    "created_at": "2026-04-24T10:00:01"
  }
]
```

### 5.2 发送消息

```http
POST /api/conversations/{conv_id}/messages
Content-Type: application/json

{
  "role": "user",
  "content": "请审查海希通讯2024年报",
  "type": "text"
}
```

---

## 6. 任务接口 `/api`

### 6.1 创建任务

```http
POST /api/conversations/{conv_id}/tasks
Content-Type: application/json

{
  "company_name": "海希通讯",
  "report_year": 2024,
  "model_id": 1
}
```

**响应**:
```json
{
  "id": "task-xxx",
  "conversation_id": "conv-xxx",
  "company_name": "海希通讯",
  "report_year": 2024,
  "status": "pending",
  "current_step": 0,
  "created_at": "2026-04-24T10:00:00"
}
```

### 6.2 获取任务列表

```http
GET /api/conversations/{conv_id}/tasks
```

### 6.3 获取单个任务

```http
GET /api/tasks/{task_id}
```

### 6.4 更新任务状态

```http
PATCH /api/tasks/{task_id}
Content-Type: application/json

{
  "status": "completed"
}
```

---

## 7. 工作流接口 `/api`

### 7.1 启动工作流

```http
POST /api/tasks/{task_id}/workflow/start
```

**响应**:
```json
{
  "message": "工作流已启动"
}
```

### 7.2 获取工作流状态

```http
GET /api/tasks/{task_id}/workflow
```

**响应**:
```json
{
  "current_step": 2,
  "status": "paused",
  "steps": [
    {
      "step_index": 0,
      "step_name": "年报上传和审查",
      "step_type": "auto",
      "status": "completed",
      "logs": "PDF 解析完成..."
    },
    {
      "step_index": 1,
      "step_name": "指标提取",
      "step_type": "auto",
      "status": "completed",
      "logs": "提取 112 项财务指标..."
    },
    {
      "step_index": 2,
      "step_name": "RDU风险信号触发判断",
      "step_type": "manual_risk",
      "status": "running"
    }
  ]
}
```

### 7.3 获取步骤数据

```http
GET /api/tasks/{task_id}/steps/{step_index}
```

**响应** (步骤 2 - 风险信号):
```json
{
  "step_index": 2,
  "step_name": "RDU风险信号触发判断",
  "signals": [
    {
      "id": "risk-001",
      "signal_code": "RDU_PERF_001",
      "name": "营业收入大幅增长",
      "indicators": [
        {
          "code": "RDU_PERF_TOTAL_REV_T_1",
          "value": "234,260,476.98元"
        },
        {
          "code": "RDU_PERF_TOTAL_REV_T",
          "value": "511,810,505.43元"
        }
      ],
      "logic": "T期营业收入较T-1期增长118.5%",
      "risk": "公司可能存在收入确认异常",
      "is_triggered": true
    }
  ]
}
```

### 7.4 确认并继续

```http
POST /api/tasks/{task_id}/workflow/resume
Content-Type: application/json

{
  "step_index": 2,
  "decision": "confirm",
  "confirmed_ids": ["risk-001", "risk-002"],
  "rejected_ids": ["risk-003"]
}
```

---

## 8. 风险信号接口 `/api`

### 8.1 获取任务的风险信号

```http
GET /api/tasks/{task_id}/signals
```

### 8.2 更新单个信号状态

```http
PATCH /api/tasks/{task_id}/signals/{signal_id}
Content-Type: application/json

{
  "is_triggered": false
}
```

### 8.3 批量更新信号状态

```http
POST /api/tasks/{task_id}/signals/batch-update
Content-Type: application/json

{
  "triggered_ids": ["risk-001", "risk-002"]
}
```

---

## 9. 问询函接口 `/api`

### 9.1 获取问询函

```http
GET /api/tasks/{task_id}/letter
```

**响应**:
```json
{
  "id": 1,
  "task_id": "task-xxx",
  "content": "# 问询函\n\n尊敬的海希通讯：\n\n根据贵公司2024年年度报告...",
  "version": 1,
  "created_at": "2026-04-24T11:00:00"
}
```

---

## 10. RDU 指标接口 `/api/rdu`

### 10.1 获取标准指标列表

```http
GET /api/rdu/metrics
GET /api/rdu/metrics?category_id=1
```

**响应**:
```json
[
  {
    "id": 1,
    "category_id": 1,
    "metric_name": "T-2期营业收入",
    "metric_code": "RDU_PERF_TOTAL_REV_T_2"
  }
]
```

### 10.2 获取单个指标定义

```http
GET /api/rdu/metrics/{metric_code}
```

### 10.3 获取风险信号列表

```http
GET /api/rdu/risk-signals
GET /api/rdu/risk-signals?category_id=1
```

**响应**:
```json
[
  {
    "id": 113,
    "category_id": 1,
    "risk_signal": "营业收入大幅增长",
    "metric_codes": ["RDU_PERF_TOTAL_REV_T_1", "RDU_PERF_TOTAL_REV_T"]
  }
]
```

### 10.4 获取单个风险信号

```http
GET /api/rdu/risk-signals/{signal_id}
```

### 10.5 匹配风险信号

```http
GET /api/rdu/risk-signals/match?metric_codes=RDU_PERF_TOTAL_REV_T,RDU_PERF_TOTAL_REV_T_1
```

**响应**: 返回所有匹配的风险信号列表。

---

## 11. 兼容接口 `/api/rdu-risks`

### 11.1 获取风险定义

```http
GET /api/rdu-risks
GET /api/rdu-risks?category_id=1
```

### 11.2 获取单个风险定义

```http
GET /api/rdu-risks/{signal_id}
```

---

## 12. 前端 API 客户端

### 12.1 基础配置

```javascript
// frontend/services/api.js
const API_BASE = import.meta.env.VITE_API_BASE || '';

function headers() {
  const h = { 'Content-Type': 'application/json' };
  const token = localStorage.getItem('auth_token');
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

async function request(path, options = {}) {
  const resp = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: headers(),
  });
  if (!resp.ok) {
    const error = await resp.json().catch(() => ({ detail: resp.statusText }));
    throw new Error(error.detail || 'Request failed');
  }
  return resp.json();
}
```

### 12.2 API 方法封装

```javascript
// 认证
export async function login(username, password) {
  return request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

// 对话
export async function listConversations() {
  return request('/api/conversations');
}

export async function createConversation(title) {
  return request('/api/conversations', {
    method: 'POST',
    body: JSON.stringify({ title }),
  });
}

export async function deleteConversation(convId) {
  return request(`/api/conversations/${convId}`, { method: 'DELETE' });
}

// 任务
export async function createTask(convId, data) {
  return request(`/api/conversations/${convId}/tasks`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function listTasks(convId) {
  return request(`/api/conversations/${convId}/tasks`);
}

export async function getTask(taskId) {
  return request(`/api/tasks/${taskId}`);
}

// 工作流
export async function startWorkflow(taskId) {
  return request(`/api/tasks/${taskId}/workflow/start`, { method: 'POST' });
}

export async function getWorkflowStatus(taskId) {
  return request(`/api/tasks/${taskId}/workflow`);
}

export async function getStepData(taskId, stepIndex) {
  return request(`/api/tasks/${taskId}/steps/${stepIndex}`);
}

export async function resumeWorkflow(taskId, data) {
  return request(`/api/tasks/${taskId}/workflow/resume`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// 风险信号
export async function batchUpdateSignals(taskId, data) {
  return request(`/api/tasks/${taskId}/signals/batch-update`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// 问询函
export async function getInquiryLetter(taskId) {
  return request(`/api/tasks/${taskId}/letter`);
}

// 模型
export async function listActiveModels() {
  return request('/api/models/active');
}

// RDU 指标
export async function listRDUMetrics(categoryId) {
  const params = categoryId ? `?category_id=${categoryId}` : '';
  return request(`/api/rdu/metrics${params}`);
}

export async function listRDURiskSignals(categoryId) {
  const params = categoryId ? `?category_id=${categoryId}` : '';
  return request(`/api/rdu/risk-signals${params}`);
}

export async function matchRiskSignals(metricCodes) {
  return request(`/api/rdu/risk-signals/match?metric_codes=${metricCodes.join(',')}`);
}
```

---

## 13. Vite 代理配置

### 13.1 开发环境

```javascript
// frontend/vite.config.js
export default {
  server: {
    port: 30000,
    proxy: {
      '/api': {
        target: 'http://localhost:30001',
        changeOrigin: true,
      },
    },
  },
}
```

### 13.2 生产环境

- 前端构建为静态文件
- 后端提供静态文件服务和 API
- 或使用 Nginx 反向代理

---

## 14. 错误码约定

| HTTP 状态码 | 说明 |
|------------|------|
| 200 | 成功 |
| 400 | 请求参数错误 |
| 401 | 未认证或 Token 过期 |
| 403 | 权限不足 |
| 404 | 资源不存在 |
| 500 | 服务器内部错误 |

---

## 15. 速率限制

当前版本未实现速率限制，未来可扩展：
- 登录接口：5 次/分钟
- 其他接口：100 次/分钟
- 使用 Redis 实现分布式限流

---

## 16. API 版本管理

当前版本: `v1`（隐式）

未来如需破坏性变更：
- 添加 URL 前缀：`/api/v2/...`
- 保留旧版本兼容性

---

## 17. 新增/变更 API 端点汇总

<!-- Added: 2026-04-27 -->

### 17.1 模型管理增强

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/api/models/parents` | 获取所有父模型列表（含子模型统计） |
| GET | `/api/models/parent/{id}/children` | 获取某父模型的所有子模型 |
| POST | `/api/models/batch` | 批量保存模型配置（统一/独立模式） |

### 17.2 工作流端点变更

| 方法 | 端点 | 说明 |
|------|------|------|
| POST | `/api/tasks/{task_id}/start` | 启动工作流（替代旧 /workflow/start） |
| GET | `/api/tasks/{task_id}/workflow` | 获取工作流状态（不变） |
| POST | `/api/tasks/{task_id}/workflow/resume` | 确认并继续（不变） |
| GET | `/api/tasks/{task_id}/steps/{index}/data` | 获取步骤详细数据 |

### 17.3 新增端点

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/api/tasks/{task_id}/inquiry-letter` | 获取问询函 |
| GET | `/api/tasks/{task_id}/indicators` | 获取任务指标值列表 |
| DELETE | `/api/tasks/{task_id}` | 删除任务（级联删除） |

### 17.4 前端 API 客户端方法清单

```javascript
// 认证 (4)
login, register, getMe, logout

// 模型管理 (8)
listActiveModels, listAllModels, createModel, updateModel,
deleteModel, listParentModels, getModelChildren, batchSaveModels

// 对话和消息 (5)
listConversations, createConversation, deleteConversation,
listMessages, sendMessage

// 任务 (5)
listTasks, createTask, getTask, deleteTask, uploadReport

// 工作流 (4)
startWorkflow, getWorkflowStatus, resumeWorkflow, getStepData

// 风险信号 (3)
getTaskSignals, updateSignal, batchUpdateSignals

// 问询函和指标 (4)
getInquiryLetter, getTaskIndicators,
listIndicatorDefinitions, listRduRisks
```
