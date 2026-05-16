import { useState } from "react";
import { Card } from "../components/Card";
import { SectionTitle } from "../components/SectionTitle";
import { Button } from "../components/Button";
import { Badge } from "../components/Badge";
import { Field } from "../components/Field";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Breadcrumb } from "../layouts/Breadcrumb";
import { FilterBar } from "../components/FilterBar";
import { Pagination } from "../components/Pagination";

export function TaskListPage({ task, setPage, S, statusPalette }) {
  const [editOpen, setEditOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [editDraft, setEditDraft] = useState({ name: "", modelName: "", baseModel: "" });
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, task: null });
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("all");
  const pageSize = 10;

  const rows = [
    {
      id: task.id,
      name: task.name,
      modelName: task.modelName,
      status: task.status,
      baseModel: "Qwen/Qwen3-8B",
      subtaskCount: task.subtasks.length,
      runningCount: task.subtasks.filter((s) => s.status === "running").length,
    },
    { id: "ID=bt002", name: "risk_signal_v2", modelName: "risk_signal_v2", status: "draft", baseModel: "Qwen/Qwen3-14B", subtaskCount: 0, runningCount: 0 },
    { id: "ID=bt003", name: "inquiry_generation_abtest", modelName: "inquiry_generation_abtest", status: "succeeded", baseModel: "Qwen/Qwen3-8B", subtaskCount: 4, runningCount: 0 },
  ];

  // 搜索和筛选
  const filteredTasks = rows.filter(taskRow => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = (
      taskRow.name.toLowerCase().includes(searchLower) ||
      taskRow.id.toLowerCase().includes(searchLower) ||
      taskRow.modelName.toLowerCase().includes(searchLower) ||
      taskRow.baseModel.toLowerCase().includes(searchLower)
    );
    const matchesStatus = statusFilter === "all" || taskRow.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // 分页逻辑
  const totalPages = Math.ceil(filteredTasks.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const currentTasks = filteredTasks.slice(startIndex, startIndex + pageSize);

  // 搜索处理
  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  // 状态筛选处理
  const handleStatusFilter = (status) => {
    setStatusFilter(status);
    setCurrentPage(1);
  };

  // 统计各状态数量
  const statusCounts = {
    all: rows.length,
    running: rows.filter(t => t.status === "running").length,
    succeeded: rows.filter(t => t.status === "succeeded").length,
    failed: rows.filter(t => t.status === "failed").length,
    draft: rows.filter(t => t.status === "draft").length,
  };

  function openEdit(taskRow) {
    setEditingTask(taskRow);
    setEditDraft({
      name: taskRow.name,
      modelName: taskRow.modelName,
      baseModel: taskRow.baseModel,
    });
    setEditOpen(true);
  }

  function saveEdit() {
    // TODO: 实际应该更新任务状态
    console.log("保存任务编辑:", editDraft);
    setEditOpen(false);
  }

  function cloneTask(taskRow) {
    // TODO: 实际应该复制任务
    console.log("复制任务:", taskRow);
  }

  function deleteTask(taskRow) {
    setDeleteConfirm({ open: true, task: taskRow });
  }

  function confirmDelete() {
    // TODO: 实际应该删除任务
    console.log("删除任务:", deleteConfirm.task);
    setDeleteConfirm({ open: false, task: null });
  }

  function createNewTask() {
    // TODO: 实际应该创建新任务
    console.log("创建新任务");
    alert("创建新任务功能开发中...");
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Card S={S} style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Breadcrumb page="tasks" setPage={setPage} task={task} S={S} />
        <SectionTitle
          title="任务列表"
          desc={`共 ${filteredTasks.length} 个微调训练任务`}
          actions={
            <Button onClick={createNewTask} S={S}>新建微调训练任务</Button>
          }
          S={S}
          style={{ marginBottom: 8 }}
        />

        {/* 筛选行：状态标签（左） + 搜索框（右） */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 12,
        }}>
          {/* 左侧：状态筛选 */}
          <div style={{ display: 'flex', gap: 6 }}>
            {[
              { key: 'all', label: '全部', count: statusCounts.all },
              { key: 'running', label: '运行中', count: statusCounts.running },
              { key: 'succeeded', label: '已完成', count: statusCounts.succeeded },
              { key: 'failed', label: '失败', count: statusCounts.failed },
              { key: 'draft', label: '草稿', count: statusCounts.draft },
            ].map(({ key, label, count }) => {
              const isActive = statusFilter === key;
              const activeColor = S.page.background === "#0a0a0a" ? "#8b5cf6" : "#004EA2";
              const activeBg = S.page.background === "#0a0a0a" ? "#8b5cf615" : "#F0F7FF";

              return (
                <button
                  key={key}
                  onClick={() => handleStatusFilter(key)}
                  style={{
                    padding: '7px 14px',
                    border: isActive
                      ? `2px solid ${activeColor}`
                      : `2px solid ${S.page.background === "#0a0a0a" ? "#374151" : "#e2e8f0"}`,
                    borderRadius: 8,
                    background: isActive
                      ? activeBg
                      : (S.page.background === "#0a0a0a" ? "#1f2937" : "#ffffff"),
                    color: isActive ? activeColor : S.page.color,
                    fontSize: 13,
                    fontWeight: isActive ? 600 : 500,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 7,
                    fontFamily: 'inherit',
                    whiteSpace: 'nowrap',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.borderColor = S.page.background === "#0a0a0a" ? "#4b5563" : "#cbd5e1";
                      e.currentTarget.style.background = S.page.background === "#0a0a0a" ? "#111827" : "#f8fafc";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.borderColor = S.page.background === "#0a0a0a" ? "#374151" : "#e2e8f0";
                      e.currentTarget.style.background = S.page.background === "#0a0a0a" ? "#1f2937" : "#ffffff";
                    }
                  }}
                >
                  {label}
                  {count !== undefined && (
                    <span style={{
                      padding: '2px 7px',
                      borderRadius: 5,
                      background: isActive
                        ? activeColor
                        : (S.page.background === "#0a0a0a" ? "#374151" : "#e5e7eb"),
                      color: isActive
                        ? '#fff'
                        : (S.page.background === "#0a0a0a" ? "#d1d5db" : "#6b7280"),
                      fontSize: 12,
                      fontWeight: 600,
                    }}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* 右侧：搜索框 */}
          <div style={{ position: 'relative', width: 280 }}>
            {/* 搜索图标 */}
            <div style={{
              position: 'absolute',
              left: 14,
              top: '50%',
              transform: 'translateY(-50%)',
              pointerEvents: 'none',
              color: S.page.background === "#0a0a0a" ? "#6b7280" : "#94a3b8",
              display: 'flex',
              alignItems: 'center',
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
            </div>

            <input
              type="text"
              value={searchTerm}
              onChange={handleSearch}
              placeholder="搜索任务名、任务ID、模型名..."
              style={{
                width: '100%',
                fontSize: 14,
                padding: '10px 44px 10px 44px',
                border: `2px solid ${S.page.background === "#0a0a0a" ? "#374151" : "#e2e8f0"}`,
                borderRadius: 4,
                background: S.page.background === "#0a0a0a" ? "#1f2937" : "#ffffff",
                color: S.page.color,
                outline: 'none',
                transition: 'all 0.2s',
                fontFamily: 'inherit',
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#667eea';
                e.target.style.background = S.page.background === "#0a0a0a" ? "#111827" : "#f9fafb";
              }}
              onBlur={(e) => {
                e.target.style.borderColor = S.page.background === "#0a0a0a" ? "#374151" : "#e2e8f0";
                e.target.style.background = S.page.background === "#0a0a0a" ? "#1f2937" : "#ffffff";
              }}
            />

            {searchTerm && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setCurrentPage(1);
                }}
                style={{
                  position: 'absolute',
                  right: 14,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  border: 0,
                  background: S.page.background === "#0a0a0a" ? "#374151" : "#e5e7eb",
                  cursor: 'pointer',
                  padding: 6,
                  borderRadius: 4,
                  color: S.page.background === "#0a0a0a" ? "#9ca3af" : "#6b7280",
                  display: 'flex',
                  alignItems: 'center',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = S.page.background === "#0a0a0a" ? "#4b5563" : "#d1d5db";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = S.page.background === "#0a0a0a" ? "#374151" : "#e5e7eb";
                }}
                title="清除搜索"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        <div style={{ flex: 1, overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 6 }}>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>任务名</th>
              <th style={S.th}>状态</th>
              <th style={S.th}>模型名</th>
              <th style={S.th}>基模</th>
              <th style={S.th}>子任务</th>
              <th style={S.th}>操作</th>
            </tr>
          </thead>
          <tbody>
            {currentTasks.map((r) => (
              <tr key={r.id}>
                <td style={S.td}>
                  <button onClick={() => setPage("taskDetail")} style={{ border: 0, background: "transparent", fontWeight: 800, cursor: "pointer", color: S.page.color, display: "block", padding: 0, textAlign: "left" }}>
                    {r.name}
                  </button>
                  <div style={{ color: S.page.background === "#0a0a0a" ? "#6b7280" : "#94a3b8", fontSize: 12 }}>{r.id}</div>
                </td>
                <td style={S.td}>
                  <Badge status={r.status} statusPalette={statusPalette} />
                </td>
                <td style={S.td}>{r.modelName}</td>
                <td style={S.td}>{r.baseModel}</td>
                <td style={S.td}>
                  总数 {r.subtaskCount} / 训练中 {r.runningCount}
                </td>
                <td style={S.td}>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={() => setPage("taskDetail")}
                      style={{
                        border: 0,
                        background: "transparent",
                        cursor: "pointer",
                        padding: 6,
                        borderRadius: 4,
                        color: S.page.background === "#0a0a0a" ? "#9ca3af" : "#6B7280",
                        transition: "all 0.2s",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = S.page.background === "#0a0a0a" ? "#2d2d2d" : "#F9FAFB";
                        e.currentTarget.style.color = S.page.background === "#0a0a0a" ? "#e5e7eb" : "#004EA2";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "transparent";
                        e.currentTarget.style.color = S.page.background === "#0a0a0a" ? "#9ca3af" : "#6B7280";
                      }}
                      title="查看详情"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    </button>
                    <button
                      onClick={() => cloneTask(r)}
                      style={{
                        border: 0,
                        background: "transparent",
                        cursor: "pointer",
                        padding: 6,
                        borderRadius: 4,
                        color: S.page.background === "#0a0a0a" ? "#9ca3af" : "#6B7280",
                        transition: "all 0.2s",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = S.page.background === "#0a0a0a" ? "#2d2d2d" : "#F9FAFB";
                        e.currentTarget.style.color = S.page.background === "#0a0a0a" ? "#e5e7eb" : "#004EA2";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "transparent";
                        e.currentTarget.style.color = S.page.background === "#0a0a0a" ? "#9ca3af" : "#6B7280";
                      }}
                      title="复制任务"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </svg>
                    </button>
                    <button
                      onClick={() => openEdit(r)}
                      style={{
                        border: 0,
                        background: "transparent",
                        cursor: "pointer",
                        padding: 6,
                        borderRadius: 4,
                        color: S.page.background === "#0a0a0a" ? "#9ca3af" : "#6B7280",
                        transition: "all 0.2s",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = S.page.background === "#0a0a0a" ? "#2d2d2d" : "#F9FAFB";
                        e.currentTarget.style.color = S.page.background === "#0a0a0a" ? "#e5e7eb" : "#004EA2";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "transparent";
                        e.currentTarget.style.color = S.page.background === "#0a0a0a" ? "#9ca3af" : "#6B7280";
                      }}
                      title="编辑任务"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => deleteTask(r)}
                      style={{
                        border: 0,
                        background: "transparent",
                        cursor: "pointer",
                        padding: 6,
                        borderRadius: 4,
                        color: S.page.background === "#0a0a0a" ? "#9ca3af" : "#6B7280",
                        transition: "all 0.2s",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = S.page.background === "#0a0a0a" ? "#2d2d2d" : "#FEF2F2";
                        e.currentTarget.style.color = "#EF4444";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "transparent";
                        e.currentTarget.style.color = S.page.background === "#0a0a0a" ? "#9ca3af" : "#6B7280";
                      }}
                      title="删除任务"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        <line x1="10" y1="11" x2="10" y2="17" />
                        <line x1="14" y1="11" x2="14" y2="17" />
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={filteredTasks.length}
        pageSize={pageSize}
        onPageChange={setCurrentPage}
        S={S}
      />
    </Card>

    {/* 编辑任务弹窗 */}
      {editOpen ? (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, zIndex: 50 }}>
          <div style={{ background: S.card.background, borderRadius: 24, padding: 24, width: "min(680px, 100%)", maxHeight: "90vh", overflow: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid", borderColor: S.card.border.split(" ")[2], paddingBottom: 16, marginBottom: 20 }}>
              <div>
                <b style={{ fontSize: 20, color: S.page.color }}>编辑任务</b>
                <div style={{ fontSize: 13, color: S.page.background === "#0a0a0a" ? "#9ca3af" : "#64748b", marginTop: 4 }}>
                  {editingTask?.id}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <Button secondary onClick={() => setEditOpen(false)} S={S}>
                  取消
                </Button>
                <Button onClick={saveEdit} S={S}>保存</Button>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16 }}>
              <Field label="任务名称" value={editDraft.name} onChange={(e) => setEditDraft({ ...editDraft, name: e.target.value })} S={S} />
              <Field label="模型名称" value={editDraft.modelName} onChange={(e) => setEditDraft({ ...editDraft, modelName: e.target.value })} S={S} />
              <Field label="基础模型" value={editDraft.baseModel} onChange={(e) => setEditDraft({ ...editDraft, baseModel: e.target.value })} S={S} />
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={deleteConfirm.open}
        title="删除任务"
        message={`确定要删除任务 "${deleteConfirm.task?.name}" 及其所有 ${deleteConfirm.task?.subtaskCount || 0} 个子任务吗？删除后将无法恢复。`}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirm({ open: false, task: null })}
        confirmText="删除"
        danger={true}
        S={S}
      />
    </div>
  );
}
