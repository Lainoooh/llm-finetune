# 微调工具平台 - 前端项目

## 项目概述

这是一个基于 React + Vite 的微调训练平台前端项目，用于管理和监控 LLaMA-Factory 的微调训练任务。

## 技术栈

- **React 18.3.1** - UI 框架
- **Vite 5.4.2** - 构建工具
- **纯 CSS-in-JS** - 样式方案（无额外依赖）

## 项目结构

```
llm-finetune/
├── src/
│   ├── components/          # 通用组件
│   │   ├── Badge.jsx        # 状态徽章
│   │   ├── Button.jsx       # 按钮组件
│   │   ├── Card.jsx         # 卡片容器
│   │   ├── Field.jsx        # 表单输入
│   │   ├── Info.jsx         # 信息展示
│   │   ├── LossChart.jsx    # Loss 曲线图
│   │   ├── Metric.jsx       # 指标标签
│   │   ├── SectionTitle.jsx # 区块标题
│   │   ├── Stat.jsx         # 统计卡片
│   │   └── TaskTable.jsx    # 任务表格
│   ├── layouts/             # 布局组件
│   │   ├── Breadcrumb.jsx   # 面包屑导航
│   │   └── Sidebar.jsx      # 侧边栏
│   ├── pages/               # 页面组件
│   │   ├── Dashboard.jsx    # 总览页
│   │   ├── ServersPage.jsx  # 服务器管理
│   │   ├── TaskListPage.jsx # 任务列表
│   │   ├── TaskDetailPage.jsx # 任务详情
│   │   ├── SubtaskPage.jsx  # 子任务配置
│   │   └── ComparePage.jsx  # 综合对比
│   ├── data/                # 数据层
│   │   └── mockData.js      # 模拟数据
│   ├── styles/              # 样式
│   │   └── styles.js        # 样式常量
│   ├── App.jsx              # 主应用
│   └── main.jsx             # 入口文件
├── index.html               # HTML 模板
├── package.json             # 项目配置
└── vite.config.js           # Vite 配置
```

## 功能模块

### 1. 总览（Dashboard）
- 服务器数量统计
- 子任务状态统计
- 训练 Loss 趋势图

### 2. 服务器管理（Servers）
- 服务器列表展示
- 服务器连接配置编辑
- 环境信息查看（GPU、CUDA、PyTorch 等）

### 3. 微调训练任务（Tasks）
- 任务列表管理
- 任务详情查看
- 子任务并行启动
- 子任务配置（基础配置、数据集、训练参数、日志、评测）

### 4. 综合对比（Compare）
- Loss 曲线对比
- 评测结果对比
- 参数与结果汇总

## 快速开始

### 安装依赖
```bash
npm install
```

### 启动开发服务器
```bash
npm run dev
```

访问：http://localhost:3000/

### 构建生产版本
```bash
npm run build
```

### 预览生产构建
```bash
npm run preview
```

## 开发说明

### 状态管理
- 使用 React Hooks（useState）管理本地状态
- 服务器数据：`servers` 状态
- 任务数据：`task` 状态
- 页面路由：`page` 状态（字符串切换）

### 页面路由
当前使用状态切换实现页面导航：
- `dashboard` - 总览
- `servers` - 服务器管理
- `tasks` - 任务列表
- `taskDetail` - 任务详情
- `subtask` - 子任务配置
- `compare` - 综合对比

### 模拟数据
所有数据存储在 `src/data/mockData.js`，包括：
- `initialServers` - 服务器列表
- `initialTask` - 任务数据
- `lossData` - Loss 曲线数据
- `logs` - 训练日志
- `yamlText` - 训练配置 YAML
- `evalYaml` - 评测配置 YAML
- `datasetInfo` - 数据集信息

## 后续扩展计划

### 阶段 1：API 集成（待开发）
- [ ] 创建 API 服务层（`src/api/`）
- [ ] 替换模拟数据为真实 API 调用
- [ ] 添加 loading 和 error 状态处理

### 阶段 2：状态管理升级（可选）
- [ ] 引入 Context API 或 Zustand
- [ ] 统一管理全局状态

### 阶段 3：路由升级（可选）
- [ ] 引入 React Router
- [ ] 实现真实 URL 路由

### 阶段 4：功能增强
- [ ] 添加表单验证
- [ ] 添加错误边界
- [ ] 添加 WebSocket 实时更新
- [ ] 添加文件上传功能

## 注意事项

1. **样式方案**：当前使用内联样式，如需修改全局样式，编辑 `src/styles/styles.js`
2. **数据持久化**：当前数据仅存在内存中，刷新页面会重置
3. **浏览器兼容**：建议使用现代浏览器（Chrome、Firefox、Safari、Edge）

## 项目特点

✅ **轻量级**：无额外 UI 库依赖  
✅ **快速启动**：Vite HMR 毫秒级热更新  
✅ **模块化**：组件拆分清晰，易于维护  
✅ **可扩展**：预留 API 层和状态管理扩展空间  

## 开发者

- 初始版本：2026-05-13
- 构建工具：Vite 5.4.2
- React 版本：18.3.1
