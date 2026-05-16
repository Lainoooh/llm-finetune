# CHANGELOG

本文件记录 plan 目录设计文档的变更历史。

---

## v1.3 (2026-04-28)

- 数据库路径迁移：`backend/app/data/bse.db` → `data/bse.db`（与 backend/frontend/plan 同级）
- 修改 `database.py` DB_DIR 指向项目根目录 `data/`
- [09] 新增部署方案：打包部署策略、build.sh + deploy.sh 脚本化部署
- 新增 `scripts/` 目录：build.sh（本地打包）、deploy.sh（服务器部署）、bse.conf（Nginx 模板）
- 部署包包含完整项目（含 node_modules），排除 data/（数据库）、venv、logs

---

## v1.2 (2026-04-27)

### 文档重组
- 重组 plan 目录结构，从 6 个文档扩展为 9 个模块化文档
- 数据文件迁移至 `data/` 子目录
- 删除增量文档 `workflow-restructure.md`（已合并）
- 删除临时文件 `~$RDU标准指标集.xlsx`
- 新建 `00-方案管理规范.md`

### 新增文档
- [06] 前端交互设计：路由系统、状态机（蓝/橙/绿/红）、轮询机制、showAsCompleted 逻辑
- [07] 并发控制与日志设计：2 层 Semaphore、httpx 连接池、JSON 结构化日志、ContextVar
- [08] 系统配置页面设计（草案）：rdu_categories 表、指标/风险信号 CRUD、模型并发数

### 更新文档
- [01] 整体架构设计：新增 logging_config、llm_service、prompts 模块，更新目录结构
- [02] 数据库设计：新增 purpose/parent_model_id/display_name/metrics_json/similarity_score 字段，新增 indicator_values 表
- [03] 工作流引擎设计：合并 restructure 方案，更新为新版 7 步定义（Step 2 拆分、3+4 合并）
- [04] RDU 指标体系设计：补充 BERTScore 匹配逻辑、指标值清洗规则
- [05] API 接口设计：新增模型管理(parents/children/batch)、工作流、指标值等端点

---

## v1.1 (2026-04-25)

- 工作流重构：Step 2 拆分为 auto 分析 + manual 确认，Step 3+4 合并为 2 阶段 LLM
- 新增 `workflow-restructure.md` 增量变更文档

---

## v1.0 (2026-04-24)

- 初始版本：architecture.md、database-design.md、workflow-design.md、api-design.md、rdu-metrics-design.md
- 数据文件：RDU标准指标集.xlsx、parsed_metrics.json、parsed_rdu.json、年报扫描指标值.json
