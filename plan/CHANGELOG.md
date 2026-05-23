# CHANGELOG

## 2026-05-23

- 新增 `13-远程执行框架与连接方式扩展设计.md`，明确“通用执行框架 + Jupyter/SSH Transport 适配器”的两层执行器架构。
- 后端执行层完成重构：队列锁、marker、超时、输出清洗、断线 reset 收敛到 `QueuedRemoteSession`，Jupyter 与 SSH 只负责连接和 IO。
- 新增 SSH 连接适配层与 `asyncssh` 依赖，服务器配置新增 `accessType`、`sshPort`、`sshKey` 字段。
- 服务器新增/编辑弹窗增加“连接方式”分段选项，支持 Jupyter/SSH 动态表单。
- 服务器弹窗修订为基础配置、连接方式、Jupyter/SSH 专属连接参数分区；Jupyter 模式只填写 Base URL 与 Token，SSH 模式填写账号、地址、密码。
- 环境信息展示改为每行 3 项，字段展示为 `显卡型号/CUDA 版本/显卡数量/编号/PyTorch 版本`。
- 后端服务器响应增加 `accelerator`、`acceleratorVendor`、`acceleratorRuntime`、`acceleratorIds`、`acceleratorCount`、`aiFramework` 通用字段，探测脚本预留非 NVIDIA 设备适配入口。
- 将服务器探测改为整体任务模型：硬件与工作目录探测、微调容器环境探测两个子结果独立返回，前端轮询并先到先渲染。
- 服务器配置新增微调工具容器名；微调环境探测进入 Docker 容器，仅检查 Python、PyTorch、Transformers 和微调工具版本。
- 新增 fake transport 测试，验证通用执行框架的 marker、exit code 和 timeout reset。

## 2026-05-21

- 统一数据库 ID 设计：所有表的 `id` 改为雪花算法生成的 `BIGINT/long` 内部存储 ID；任务和子任务展示编号改为 `task_code`、`subtask_code`，不再与存储主键混用。
- 新增 `09-后端架构与任务队列详细设计.md`，明确 Python FastAPI 后端、两层队列、后台训练、日志采集和状态轮询方案。
- 新增 `10-远程命令脚本库与执行清单.md`，沉淀服务器探测、文件同步、训练启动、日志读取、停止训练等远程脚本模板。
- 新增 `11-脚本配置管理页面设计.md`，设计脚本管理页面、版本、参数、测试、绑定和审计能力。
- 新增 `12-开发任务拆分与自测试指南.md`，拆分可交给小型智能体执行的前后端开发任务和验收测试。
- 新增 `00-方案管理规范.md`，建立 plan 目录编号和维护规则。
- 新增 `01-整体架构设计.md`，定义可视化微调平台总体架构和远程执行插件定位。
- 新增 `02-产品功能与页面梳理.md`，基于当前 React 页面整理现有功能与目标能力。
- 新增 `03-领域模型与数据设计.md`，定义服务器、GPU、任务、子任务、执行记录等核心模型。
- 新增 `04-服务器与GPU资源管理详细设计.md`，设计服务器配置、容器校验、GPU 切分和资源锁。
- 新增 `05-微调任务与子任务编排详细设计.md`，设计任务/子任务生命周期、训练启动和评测流程。
- 新增 `06-LLaMA-Factory容器与远程执行插件设计.md`，定义 Jupyter Terminal 临时插件和后续执行器替换方向。
- 新增 `07-API接口与前端集成设计.md`，定义前后端 API 和当前页面替换路径。
- 新增 `08-迭代路线与风险清单.md`，拆分阶段性交付和风险缓解策略。
