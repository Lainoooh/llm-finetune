# LLM Fine-tune Platform

基于 LLaMA-Factory 的 LLM 微调训练管理平台，支持服务器管理、训练任务编排、脚本执行和模型对比。

## 技术栈

- **前端**: React 18 + Vite 5 (CSS-in-JS)
- **后端**: FastAPI + SQLAlchemy + SQLite
- **远程执行**: asyncssh + WebSocket
- **构建**: Vite (前端) + Uvicorn (后端)

## 项目结构

```
llm-finetune/
├── backend/                # FastAPI 后端
│   ├── app/
│   │   ├── api/routes/     # 路由 (dashboard, servers, tasks, executions, scripts)
│   │   ├── core/           # 配置、事件总线、雪花ID
│   │   ├── db/             # 数据库 (SQLite)
│   │   ├── executors/      # 远程执行器 (SSH / Jupyter Terminal)
│   │   ├── models/         # SQLAlchemy 模型
│   │   ├── schemas/        # Pydantic 校验
│   │   ├── services/       # 业务逻辑 (server, task, script, execution)
│   │   └── tests/
│   ├── data/               # 数据库文件
│   ├── requirements.txt
│   └── main.py
├── frontend/               # React 前端
│   ├── src/
│   │   ├── api/            # API 客户端
│   │   ├── components/     # 通用组件 (Badge, Button, TaskTable, LossChart...)
│   │   ├── layouts/        # 布局 (Sidebar, Header, Breadcrumb)
│   │   ├── pages/          # 页面 (Dashboard, Servers, Tasks, Subtask, Compare, Scripts)
│   │   └── styles/         # 主题 (dark, chatgpt, fresh)
│   ├── ui/                 # 独立 UI 组件
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── plan/                   # 方案文档
└── data/
```

## 功能模块

| 模块 | 说明 |
|------|------|
| **总览 (Dashboard)** | 服务器统计、任务状态、Loss 趋势图 |
| **服务器管理 (Servers)** | 服务器列表、SSH 配置、环境探测 (GPU/CUDA/PyTorch) |
| **训练任务 (Tasks)** | 任务 CRUD、子任务并行、LLaMA-Factory YAML 配置 |
| **脚本执行 (Scripts)** | 内置脚本模板、远程执行、日志实时回传 |
| **综合对比 (Compare)** | Loss 曲线对比、评测结果对比 |
| **会话池 (SessionPool)** | SSH 会话复用、并发排队、心跳保活 |

## 快速开始

### 前端

```bash
cd frontend
npm install
npm run dev          # http://localhost:30000
```

### 后端

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 30001
```

### 构建

```bash
cd frontend
npm run build        # 输出到 frontend/dist/
```

## 备注

- 后端默认监听 `127.0.0.1:30001`，前端开发代理 `/api` → 后端
- 远程执行依赖 SSH key，需在服务器管理页面配置连接信息
- 数据库文件位于 `backend/data/llm_finetune.db`，启动时自动初始化
