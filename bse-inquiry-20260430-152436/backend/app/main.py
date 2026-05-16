"""
FastAPI application entry point.
"""

import logging

from app.logging_config import setup_logging

# Configure logging BEFORE anything else
setup_logging()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import init_db
from app.routers import auth, models, conversations, messages, tasks, workflow, signals, indicators, rdu_risks, categories

logger = logging.getLogger(__name__)

app = FastAPI(
    title="北交所年报审查系统",
    description="Annual Report Inquiry System for Beijing Stock Exchange",
    version="0.1.0",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize database on startup
@app.on_event("startup")
def startup_event():
    init_db()
    # 初始化默认数据（admin用户、RDU指标等）
    from app.seed import seed_from_init_sql
    logger.info("初始化默认数据")
    seed_from_init_sql()
    # 恢复僵尸任务（服务重启导致 running 状态的任务）
    from app.models.task import TaskRepo
    recovered = TaskRepo.recover_zombie_tasks()
    if recovered:
        logger.warning("已恢复 %d 个僵尸任务（running → interrupted）", recovered)
    logger.info("初始化完成")


@app.on_event("shutdown")
async def shutdown_event():
    from app.services.llm_service import close_shared_client
    await close_shared_client()

# Root endpoint
@app.get("/")
def root():
    return {"message": "北交所年报审查系统 API", "version": "0.1.0"}

# Register routers
app.include_router(auth.router, prefix="/api/auth", tags=["认证"])
app.include_router(models.router, prefix="/api/models", tags=["模型管理"])
app.include_router(conversations.router, prefix="/api/conversations", tags=["对话"])
app.include_router(messages.router, prefix="/api", tags=["消息"])
app.include_router(tasks.router, prefix="/api", tags=["任务"])
app.include_router(workflow.router, prefix="/api", tags=["工作流"])
app.include_router(signals.router, prefix="/api", tags=["风险信号"])
app.include_router(indicators.router, prefix="/api", tags=["指标"])
app.include_router(rdu_risks.router, prefix="/api", tags=["RDU风险定义"])
app.include_router(categories.router, prefix="/api/categories", tags=["分类管理"])
