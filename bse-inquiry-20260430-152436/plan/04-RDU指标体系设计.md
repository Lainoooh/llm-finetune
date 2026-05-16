# RDU 指标体系设计文档 [已实现]

<!-- Updated: 2026-04-27 补充 BERTScore 匹配逻辑、指标值清洗规则、metrics_json 输入格式 -->

## 1. RDU 概述

### 1.1 什么是 RDU？

RDU（Risk Data Utility）是北交所年报审查系统的核心风险识别引擎，通过标准化的指标体系和风险信号定义，自动识别年报中的异常数据和潜在风险。

### 1.2 设计目标

1. **标准化**: 112 项标准指标，覆盖整体业绩、分业务、分季度、分区域、分子公司五大维度
2. **可配置**: 71 项风险信号定义，支持动态调整和扩展
3. **可追溯**: 指标值与风险信号关联，支持审计和回溯
4. **高性能**: 基于 SQLite 的轻量级实现，支持快速查询和匹配

---

## 2. 指标体系架构

### 2.1 三层架构

```
┌─────────────────────────────────────────────────────────┐
│  第一层：标准指标定义 (rdu_metrics_standard)              │
│  - 112 项标准指标                                        │
│  - 定义指标代码、名称、分类                               │
│  - 作为指标值的模板和参考                                 │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│  第二层：指标值实例 (rdu_metric_values)                   │
│  - 从年报 PDF 扫描提取的实际数值                          │
│  - 关联到具体任务 (task_id)                              │
│  - 保留原始格式（如"219,631,927.58元"）                   │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│  第三层：风险信号定义 (rdu_risk_signals)                  │
│  - 71 项风险信号                                         │
│  - 每项关联多个指标代码                                   │
│  - 通过指标值匹配触发风险信号                             │
└─────────────────────────────────────────────────────────┘
```

### 2.2 数据流转

```
年报 PDF
    ↓
OCR 扫描 + 解析
    ↓
提取指标值 → rdu_metric_values (task_id, metric_code, value)
    ↓
匹配风险信号 → rdu_risk_signals (metric_codes JSON)
    ↓
触发风险 → risk_signals (任务级别的风险实例)
```

---

## 3. 指标分类体系

### 3.1 分类 ID 映射

| category_id | 分类名称 | 指标数量 | 说明 |
|-------------|---------|---------|------|
| 1 | 关于经营业绩 | 112 | 包含整体业绩、现金流、分季度等 |
| 2 | 分业务（产品） | 30 | 5 个业务线 × 3 期 × 2 指标 |
| 3 | 分季度 | 12 | 4 季度 × 3 指标 |
| 4 | 分区域/境内外 | 28 | 5 区域 + 境内外 × 2 期 × 2 指标 |
| 5 | 分子公司 | 30 | 5 公司 × 3 期 × 2 指标 |

**注意**: 当前 Excel 数据中，所有 112 项指标的 category_id 均为 1（关于经营业绩），但指标代码中隐含了更细的分类信息。

---

## 4. 标准指标定义 (rdu_metrics_standard)

### 4.1 表结构

```sql
CREATE TABLE rdu_metrics_standard (
    id            BIGINT PRIMARY KEY,           -- 雪花算法 ID
    category_id   INTEGER NOT NULL DEFAULT 1,   -- 分类 ID
    metric_name   TEXT NOT NULL,                -- 指标名称
    metric_code   TEXT NOT NULL UNIQUE,         -- 指标代码
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 4.2 指标代码命名规则

格式: `RDU_PERF_{范围}_{指标}_{期间}`

#### 4.2.1 范围标识符

| 标识符 | 说明 | 示例 |
|--------|------|------|
| TOTAL | 整体业绩 | RDU_PERF_TOTAL_REV_T |
| QUARTER | 分季度 | RDU_PERF_QUARTER_REV_T_Q1 |
| BIZ01-BIZ05 | 分业务（产品）1-5 | RDU_PERF_BIZ01_REV_T |
| REGION01-REGION05 | 分区域 1-5 | RDU_PERF_REGION01_REV_T |
| DOMESTIC | 境内 | RDU_PERF_DOMESTIC_REV_T |
| OVERSEAS | 境外 | RDU_PERF_OVERSEAS_REV_T |
| COMPANY01-COMPANY05 | 分子公司 1-5 | RDU_PERF_COMPANY01_REV_T |

#### 4.2.2 指标标识符

| 标识符 | 说明 | 单位 |
|--------|------|------|
| REV | 营业收入 | 元 |
| GPM | 毛利率 | % |
| NP | 净利润 | 元 |
| OCF_NET | 经营活动产生的现金流量净额 | 元 |

#### 4.2.3 期间标识符

| 标识符 | 说明 | 示例 |
|--------|------|------|
| T_2 | T-2 期（前两年） | RDU_PERF_TOTAL_REV_T_2 |
| T_1 | T-1 期（前一年） | RDU_PERF_TOTAL_REV_T_1 |
| T | T 期（当年） | RDU_PERF_TOTAL_REV_T |
| TP1 | T+1 期（期后） | RDU_PERF_QUARTER_REV_TP1_Q1 |
| Q1-Q4 | 季度 | RDU_PERF_QUARTER_REV_T_Q1 |

### 4.3 指标分类详情

#### 4.3.1 整体业绩（12 项）

| 期间 | 营业收入 | 毛利率 | 净利润 | 现金流 |
|------|---------|--------|--------|--------|
| T-2 | ✓ | ✓ | ✓ | ✓ |
| T-1 | ✓ | ✓ | ✓ | ✓ |
| T | ✓ | ✓ | ✓ | ✓ |

#### 4.3.2 分季度/期后（12 项）

| 期间 | Q1 | Q2 | Q3 | Q4 |
|------|----|----|----|----|
| T 期 | 营收、净利、毛利率 | ✓ | ✓ | ✓ |
| T+1 期 | 营收、净利、毛利率 | - | - | - |

#### 4.3.3 分业务（产品）（30 项）

- 5 个业务线 × 3 期（T-2, T-1, T）× 2 指标（营收、毛利率）
- 业务线编号: BIZ01, BIZ02, BIZ03, BIZ04, BIZ05

#### 4.3.4 分区域/境内外（28 项）

- 5 个区域 × 2 期（T-1, T）× 2 指标（营收、毛利率）= 20 项
- 境内/境外 × 2 期 × 2 指标 = 8 项

#### 4.3.5 分子公司（30 项）

- 5 个公司 × 3 期（T-1, T）× 3 指标（营收、毛利率、净利润）= 30 项
- **注意**: 公司只有 T-1 和 T 两期数据

---

## 5. 风险信号定义 (rdu_risk_signals)

### 5.1 表结构

```sql
CREATE TABLE rdu_risk_signals (
    id            BIGINT PRIMARY KEY,           -- 雪花算法 ID
    category_id   INTEGER NOT NULL DEFAULT 1,   -- 分类 ID
    risk_signal   TEXT NOT NULL,                -- 风险信号名称
    metric_codes  TEXT NOT NULL,                -- JSON 数组：关联的指标代码
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 5.2 风险信号分类

| 分类 | category_id | 数量 | 示例 |
|------|-------------|------|------|
| 整体业绩 | 1 | 32 | 营业收入大幅增长、毛利率大幅下滑 |
| 分业务（产品） | 2 | 18 | 单项业务营业收入大幅增长 |
| 分季度 | 3 | 8 | 各季度营业收入差异较大 |
| 分区域 | 4 | 11 | 单一区域营业收入大幅下滑 |
| 分子公司 | 5 | 2 | 子公司普遍亏损 |

### 5.3 风险信号示例

#### 5.3.1 整体业绩类

| ID | 风险信号 | 关联指标代码 | 阈值规则 |
|----|---------|-------------|---------|
| 113 | 营业收入大幅增长 | `["RDU_PERF_TOTAL_REV_T_1", "RDU_PERF_TOTAL_REV_T"]` | 增长超过 10% |
| 114 | 毛利率大幅下滑 | `["RDU_PERF_TOTAL_GPM_T_1", "RDU_PERF_TOTAL_GPM_T"]` | 下滑超过 3 个百分点 |
| 115 | 净利润大幅增长 | `["RDU_PERF_TOTAL_NP_T_1", "RDU_PERF_TOTAL_NP_T"]` | 增长超过 5% |
| 116 | 净利润大幅下滑 | `["RDU_PERF_TOTAL_NP_T_1", "RDU_PERF_TOTAL_NP_T"]` | 下滑超过 5% |
| 119 | 营业收入与毛利率均大幅增长 | `["RDU_PERF_TOTAL_REV_T_1", "RDU_PERF_TOTAL_REV_T", "RDU_PERF_TOTAL_GPM_T_1", "RDU_PERF_TOTAL_GPM_T"]` | 营收增长>10% 且 毛利率增长>3pct |

#### 5.3.2 分业务类

| ID | 风险信号 | 关联指标代码 | 阈值规则 |
|----|---------|-------------|---------|
| 145 | 单项业务营业收入大幅增长 | `["RDU_PERF_BIZ01_REV_T_1", ..., "RDU_PERF_BIZ05_REV_T"]` | 增长率超过 20% |
| 149 | 单项业务毛利率较高 | `["RDU_PERF_BIZ01_GPM_T", ..., "RDU_PERF_BIZ05_GPM_T"]` | 超过 40% |

#### 5.3.3 分季度类

| ID | 风险信号 | 关联指标代码 | 阈值规则 |
|----|---------|-------------|---------|
| 163 | 各季度营业收入差异较大 | `["RDU_PERF_QUARTER_REV_T_Q1", ..., "RDU_PERF_TOTAL_REV_T"]` | 占比：最高-最低>10% |
| 168 | 第四季度营业收入占比较高 | `["RDU_PERF_QUARTER_REV_T_Q4", "RDU_PERF_TOTAL_REV_T"]` | 超过 30% |

---

## 6. 指标值实例 (rdu_metric_values)

### 6.1 表结构

```sql
CREATE TABLE rdu_metric_values (
    id            BIGINT PRIMARY KEY,           -- 雪花算法 ID
    task_id       TEXT,                         -- 关联任务 ID（NULL 表示基准数据）
    metric_code   TEXT NOT NULL,                -- 指标代码
    metric_name   TEXT NOT NULL,                -- 指标名称
    value         TEXT NOT NULL,                -- 指标值（原始字符串）
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 6.2 数据示例

```sql
-- 基准数据 (task_id=1)
(184, '1', 'RDU_PERF_TOTAL_REV_T_2', 'T-2期营业收入', '219,631,927.58元'),
(185, '1', 'RDU_PERF_TOTAL_GPM_T_2', 'T-2期毛利率', '53.30%'),
(186, '1', 'RDU_PERF_TOTAL_NP_T_2', 'T-2期净利润', '60,632,541.65元'),
(190, '1', 'RDU_PERF_TOTAL_REV_T', 'T期营业收入', '511,810,505.43元'),
(191, '1', 'RDU_PERF_TOTAL_GPM_T', 'T期毛利率', '31.58%'),
```

### 6.3 值格式说明

| 类型 | 格式示例 | 说明 |
|------|---------|------|
| 金额 | `219,631,927.58元` | 带千位分隔符，单位"元" |
| 百分比 | `53.30%` | 带百分号 |
| 负数 | `-1,757,501.32元` | 负号在前 |
| 零值 | `0.00元` 或 `0.00%` | 保留两位小数 |

### 6.4 数据解析规则

前端/后端解析时需要：
1. 去除千位分隔符（逗号）
2. 提取数值部分
3. 识别单位（元/%）
4. 转换为数值类型进行比较

```python
def parse_metric_value(value_str: str) -> float:
    """解析指标值字符串为数值"""
    # 去除单位
    cleaned = value_str.replace('元', '').replace('%', '').replace(',', '')
    return float(cleaned)
```

---

## 7. 风险信号匹配逻辑

### 7.1 匹配流程

```
1. 读取任务的指标值
   ↓
2. 查询 rdu_risk_signals 获取所有风险信号定义
   ↓
3. 对每个风险信号：
   a. 解析 metric_codes JSON 数组
   b. 从 rdu_metric_values 中获取对应指标值
   c. 应用阈值规则判断是否触发
   d. 如果触发，创建 risk_signals 记录
   ↓
4. 返回触发的风险信号列表
```

### 7.2 匹配示例

**风险信号**: 营业收入大幅增长
- **metric_codes**: `["RDU_PERF_TOTAL_REV_T_1", "RDU_PERF_TOTAL_REV_T"]`
- **阈值规则**: 增长超过 10%

**指标值**:
- T-1 期营业收入: `234,260,476.98元`
- T 期营业收入: `511,810,505.43元`

**计算**:
```
增长率 = (511,810,505.43 - 234,260,476.98) / 234,260,476.98
       = 277,550,028.45 / 234,260,476.98
       = 1.185 = 118.5%
```

**结果**: 118.5% > 10% → **触发风险信号**

### 7.3 阈值规则引擎

阈值规则需要支持：
1. **单期比较**: `T期 < 0`
2. **两期比较**: `T期 - T-1期 > 10%`
3. **三期趋势**: `T-2 > T-1 > T`
4. **多指标组合**: `营收增长>10% AND 毛利率下滑>3pct`

---

## 8. 数据初始化

### 8.1 初始化脚本

```bash
cd backend
python -m app.seed
```

### 8.2 初始化数据量

| 表 | 数据量 | ID 范围 | 来源 |
|----|--------|---------|------|
| rdu_metrics_standard | 112 | 1-112 | RDU标准指标集.xlsx (metrics-standard) |
| rdu_risk_signals | 71 | 113-183 | RDU标准指标集.xlsx (metrics) |
| rdu_metric_values | 112 | 184-295 | 年报扫描指标值.json |

### 8.3 主键策略

- **初始数据**: 手动赋值（从 1 开始连续）
- **后续新增**: 雪花算法生成
- **ID 分段**:
  - 1-112: 标准指标定义
  - 113-183: 风险信号定义
  - 184-295: 基准指标值
  - 296+: 新增数据（雪花算法）

---

## 9. API 接口

### 9.1 指标查询

```http
GET /api/rdu/metrics
GET /api/rdu/metrics?category_id=1
GET /api/rdu/metrics/RDU_PERF_TOTAL_REV_T
```

### 9.2 风险信号查询

```http
GET /api/rdu/risk-signals
GET /api/rdu/risk-signals?category_id=1
GET /api/rdu/risk-signals/113
```

### 9.3 风险信号匹配

```http
GET /api/rdu/risk-signals/match?metric_codes=RDU_PERF_TOTAL_REV_T,RDU_PERF_TOTAL_REV_T_1
```

返回匹配的风险信号列表。

---

## 10. 仓库类设计

### 10.1 RDUMetricsRepo

```python
class RDUMetricsRepo:
    @staticmethod
    def get_by_code(metric_code: str) -> Optional[dict]
    @staticmethod
    def list_by_category(category_id: int) -> list
    @staticmethod
    def list_all() -> list
    @staticmethod
    def list_by_codes(metric_codes: list) -> list
```

### 10.2 RDURiskSignalsRepo

```python
class RDURiskSignalsRepo:
    @staticmethod
    def get_by_id(signal_id: int) -> Optional[dict]
    @staticmethod
    def list_by_category(category_id: int) -> list
    @staticmethod
    def list_all() -> list
    @staticmethod
    def get_signals_for_metrics(metric_codes: list) -> list
```

---

## 11. 扩展性设计

### 11.1 新增指标分类

1. 在 `rdu_metrics_standard` 中插入新分类的指标
2. 在 `rdu_risk_signals` 中定义新的风险信号
3. 更新前端展示逻辑

### 11.2 自定义阈值

未来可以为每个风险信号添加单独的阈值配置：

```sql
ALTER TABLE rdu_risk_signals ADD COLUMN threshold_config TEXT;
```

存储 JSON 配置：
```json
{
  "rules": [
    {"metric": "RDU_PERF_TOTAL_REV_T", "operator": ">", "value": 10, "unit": "%"}
  ]
}
```

### 11.3 多模型支持

不同行业可能需要不同的风险信号定义：
- 添加 `industry` 字段到 `rdu_risk_signals`
- 根据公司所属行业匹配风险信号

---

## 12. 性能优化

### 12.1 索引策略

```sql
CREATE INDEX idx_metrics_code ON rdu_metrics_standard(metric_code);
CREATE INDEX idx_metric_values_code ON rdu_metric_values(metric_code);
CREATE INDEX idx_metric_values_task ON rdu_metric_values(task_id);
```

### 12.2 批量查询

```python
# 批量获取指标值
def get_metrics_by_task(task_id: str, metric_codes: list) -> dict:
    placeholders = ",".join(["?"] * len(metric_codes))
    rows = conn.execute(
        f"SELECT metric_code, value FROM rdu_metric_values 
         WHERE task_id = ? AND metric_code IN ({placeholders})",
        [task_id] + metric_codes
    ).fetchall()
    return {row['metric_code']: row['value'] for row in rows}
```

### 12.3 缓存策略

- RDU 指标定义和风险信号定义变化频率低，可以缓存
- 指标值变化频繁，不建议缓存

---

## 13. 数据安全

### 13.1 数据完整性

- `metric_code` 唯一约束防止重复
- 外键约束保证数据一致性（虽然当前未使用外键关联）

### 13.2 审计追踪

- `created_at` 和 `updated_at` 记录数据变更时间
- 未来可添加 `created_by` 和 `updated_by` 字段

---

## 14. 故障排查

### 14.1 常见问题

| 问题 | 原因 | 解决方案 |
|------|------|---------|
| 指标值查询为空 | metric_code 不匹配 | 检查指标代码命名 |
| 风险信号未触发 | 指标值缺失 | 检查 rdu_metric_values 数据 |
| ID 冲突 | 雪花算法配置错误 | 检查 Worker ID 配置 |

### 14.2 调试查询

```sql
-- 检查某任务的所有指标值
SELECT * FROM rdu_metric_values WHERE task_id = '1' ORDER BY id;

-- 检查风险信号关联的指标
SELECT risk_signal, metric_codes FROM rdu_risk_signals WHERE id = 113;

-- 检查指标定义
SELECT * FROM rdu_metrics_standard WHERE metric_code = 'RDU_PERF_TOTAL_REV_T';
```

---

## 15. BERTScore 风险信号匹配

<!-- Added: 2026-04-27 -->

### 15.1 匹配流程

Step 2 的 Phase 2 输出一个"预测风险信号名称"，需要与 `rdu_risk_signals.risk_signal` 进行语义匹配：

```
LLM Phase 2 输出 → 预测名称（如"营业收入显著增长"）
                        ↓
BERTScore(预测名称, 标准名称)
                        ↓
similarity > 0.9 → is_triggered = True
similarity ≤ 0.9 → is_triggered = False
```

### 15.2 相似度存储

匹配结果存入 `risk_signals.similarity_score` 字段（REAL 类型），供人工审核参考。

---

## 16. 指标值清洗规则

<!-- Added: 2026-04-27 -->

`workflow_engine.py` 中的 `_sanitize_metric_value()` 方法：

1. 去除单位后缀：元、%、万、亿
2. 去除千分位逗号
3. 零值（0.00 / 0.00%）转为空字符串（跳过该指标）
4. 返回清洗后的原始值字符串

---

## 17. metrics_json 输入格式

<!-- Added: 2026-04-27 -->

当前版本通过 `tasks.metrics_json` 字段接收 JSON 格式指标数据，替代 PDF 解析：

```json
{
  "T-2期营业收入": "219,631,927.58元",
  "T-2期毛利率": "53.30%",
  "T期营业收入": "511,810,505.43元",
  ...
}
```

指标名称与 `rdu_metrics_standard.metric_name` 匹配，自动映射到 `metric_code`。
