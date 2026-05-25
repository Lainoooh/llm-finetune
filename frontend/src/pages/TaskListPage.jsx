import { useMemo, useState } from "react";
import { Card } from "../components/Card";
import { SectionTitle } from "../components/SectionTitle";
import { Button } from "../components/Button";
import { Badge } from "../components/Badge";
import { Field } from "../components/Field";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Breadcrumb } from "../layouts/Breadcrumb";
import { FilterBar } from "../components/FilterBar";
import { Pagination } from "../components/Pagination";
import { cloneTask, createTask, deleteTask, updateTask } from "../api/tasksApi";

const pageSize = 10;

export function TaskListPage({ tasks, reload, selectTask, S, statusPalette }) {
  const [editOpen, setEditOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [editDraft, setEditDraft] = useState({ name: "" });
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, task: null });
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("all");
  const [saving, setSaving] = useState(false);

  const filteredTasks = useMemo(() => {
    const searchLower = searchTerm.toLowerCase();
    return tasks.filter((item) => {
      const matchesSearch = [item.name, item.id, item.taskCode].some((value) => String(value || "").toLowerCase().includes(searchLower));
      const matchesStatus = statusFilter === "all" || item.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [searchTerm, statusFilter, tasks]);

  const totalPages = Math.ceil(filteredTasks.length / pageSize);
  const currentTasks = filteredTasks.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const statusCounts = {
    all: tasks.length,
    running: tasks.filter((item) => item.status === "running").length,
    succeeded: tasks.filter((item) => item.status === "succeeded").length,
    failed: tasks.filter((item) => item.status === "failed").length,
    draft: tasks.filter((item) => item.status === "draft").length,
  };

  function openNew() {
    setEditingTask(null);
    setEditDraft({ name: "" });
    setEditOpen(true);
  }

  function openEdit(taskRow) {
    setEditingTask(taskRow);
    setEditDraft({ name: taskRow.name });
    setEditOpen(true);
  }

  async function saveEdit() {
    setSaving(true);
    try {
      if (editingTask) {
        await updateTask(editingTask.taskCode || editingTask.id, editDraft);
      } else {
        await createTask(editDraft);
      }
      setEditOpen(false);
      await reload();
    } catch (error) {
      alert(`保存任务失败：${error.message}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleClone(taskRow) {
    try {
      await cloneTask(taskRow.taskCode || taskRow.id, { copySubtasks: true });
      await reload();
    } catch (error) {
      alert(`复制任务失败：${error.message}`);
    }
  }

  async function confirmDelete() {
    try {
      await deleteTask(deleteConfirm.task.taskCode || deleteConfirm.task.id);
      setDeleteConfirm({ open: false, task: null });
      await reload();
    } catch (error) {
      alert(`删除任务失败：${error.message}`);
    }
  }

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <Card S={S} style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <Breadcrumb page="tasks" setPage={() => {}} task={{ name: "任务列表" }} S={S} />
        <SectionTitle title="任务列表" desc={`共 ${filteredTasks.length} 个微调训练任务`} actions={<Button onClick={openNew} S={S}>新建微调训练任务</Button>} S={S} style={{ marginBottom: 8 }} />

        <FilterBar
          searchValue={searchTerm}
          onSearchChange={(e) => {
            setSearchTerm(e.target.value);
            setCurrentPage(1);
          }}
          searchPlaceholder="搜索任务名、任务编号..."
          statusFilter={statusFilter}
          onStatusFilterChange={(key) => {
            setStatusFilter(key);
            setCurrentPage(1);
          }}
          statusOptions={[
            { key: "all", label: "全部", count: statusCounts.all },
            { key: "running", label: "运行中", count: statusCounts.running },
            { key: "succeeded", label: "已完成", count: statusCounts.succeeded },
            { key: "failed", label: "失败", count: statusCounts.failed },
            { key: "draft", label: "草稿", count: statusCounts.draft },
          ]}
          S={S}
        />

        <div style={{ flex: 1, overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 6 }}>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>任务名</th>
                <th style={S.th}>状态</th>
                <th style={S.th}>子任务</th>
                <th style={S.th}>操作</th>
              </tr>
            </thead>
            <tbody>
              {currentTasks.map((r) => (
                <tr key={r.taskCode || r.id}>
                  <td style={S.td}>
                    <button onClick={() => selectTask(r.taskCode || r.id)} style={{ border: 0, background: "transparent", fontWeight: 800, cursor: "pointer", color: S.page.color, display: "block", padding: 0, textAlign: "left" }}>{r.name}</button>
                    <div style={{ color: "#94a3b8", fontSize: 12 }}>{r.taskCode || r.id}</div>
                  </td>
                  <td style={S.td}><Badge status={r.status} statusPalette={statusPalette} /></td>
                  <td style={S.td}><SubtaskProgress r={r} S={S} /></td>
                  <td style={S.td}>
                    <div style={{ display: "flex", gap: 8 }}>
                      <IconButton title="Details" S={S} onClick={() => selectTask(r.taskCode || r.id)}>
                        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
                        <circle cx="12" cy="12" r="3" />
                      </IconButton>
                      <IconButton title="Copy" S={S} onClick={() => handleClone(r)}>
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </IconButton>
                      <IconButton title="Edit" S={S} onClick={() => openEdit(r)}>
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </IconButton>
                      <IconButton title="Delete" danger S={S} onClick={() => setDeleteConfirm({ open: true, task: r })}>
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        <line x1="10" y1="11" x2="10" y2="17" />
                        <line x1="14" y1="11" x2="14" y2="17" />
                      </IconButton>
                    </div>
                  </td>
                </tr>
              ))}
              {currentTasks.length === 0 ? (
                <tr><td style={S.td} colSpan="4">暂无任务数据</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <Pagination currentPage={currentPage} totalPages={totalPages} totalItems={filteredTasks.length} pageSize={pageSize} onPageChange={setCurrentPage} S={S} />
      </Card>

      {editOpen ? (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, zIndex: 50 }}>
          <div style={{ background: S.card.background, borderRadius: 8, padding: 24, width: "min(680px, 100%)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e2e8f0", paddingBottom: 16, marginBottom: 20 }}>
              <b style={{ fontSize: 20, color: S.page.color }}>{editingTask ? "编辑任务" : "新建任务"}</b>
              <div style={{ display: "flex", gap: 8 }}>
                <Button secondary onClick={() => setEditOpen(false)} S={S}>取消</Button>
                <Button onClick={saveEdit} disabled={saving || !editDraft.name} S={S}>{saving ? "保存中..." : "保存"}</Button>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16 }}>
              <Field label="任务名称" value={editDraft.name} onChange={(e) => setEditDraft({ ...editDraft, name: e.target.value })} S={S} />
              {editingTask ? (
                <div>
                  <div style={{ color: S.page.background === "#0a0a0a" ? "#9ca3af" : "#64748b", fontSize: 13, marginBottom: 6 }}>任务编号（不可修改）</div>
                  <div style={{ ...S.input, color: S.page.background === "#0a0a0a" ? "#6b7280" : "#94a3b8", background: S.page.background === "#0a0a0a" ? "#1a1a1a" : "#f1f5f9", fontFamily: "monospace" }}>{editingTask.taskCode}</div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmDialog open={deleteConfirm.open} title="删除任务" message={`确定要删除任务 "${deleteConfirm.task?.name}" 吗？删除后将无法恢复。`} onConfirm={confirmDelete} onCancel={() => setDeleteConfirm({ open: false, task: null })} confirmText="删除" danger S={S} />
    </div>
  );
}

function IconButton({ title, onClick, children, S, danger = false }) {
  const baseColor = S.page.background === "#0a0a0a" ? "#9ca3af" : "#6B7280";
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        border: 0,
        background: "transparent",
        cursor: "pointer",
        padding: 6,
        borderRadius: 4,
        color: baseColor,
        transition: "all 0.2s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = danger ? (S.page.background === "#0a0a0a" ? "#2d2d2d" : "#FEF2F2") : (S.page.background === "#0a0a0a" ? "#2d2d2d" : "#F9FAFB");
        e.currentTarget.style.color = danger ? "#EF4444" : (S.page.background === "#0a0a0a" ? "#e5e7eb" : "#004EA2");
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
        e.currentTarget.style.color = baseColor;
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
    </button>
  );
}

function SubtaskProgress({ r, S }) {
  const total = r.subtaskCount || 0;
  const muted = S.page.background === "#0a0a0a" ? "#6b7280" : "#94a3b8";
  const subtle = S.page.background === "#0a0a0a" ? "#9ca3af" : "#64748b";
  const pct = total > 0 ? Math.round((r.succeededCount / total) * 100) : 0;

  if (total === 0) {
    return <span style={{ fontSize: 12, color: muted }}>暂无子任务</span>;
  }

  const items = [
    { label: "成功", count: r.succeededCount, color: "#10b981" },
    { label: "运行中", count: r.runningCount, color: "#004EA2" },
    { label: "失败", count: r.failedCount, color: "#ef4444" },
    { label: "草稿", count: r.draftCount, color: S.page.background === "#0a0a0a" ? "#6b7280" : "#9CA3AF" },
  ];

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <div style={{ flex: 1, height: 6, borderRadius: 3, background: S.envCards.progressBarBg, overflow: "hidden" }}>
          <div style={{ width: `${pct}%`, height: "100%", background: "#10b981", borderRadius: 3, transition: "width 0.3s" }} />
        </div>
        <span style={{ fontSize: 12, color: subtle, whiteSpace: "nowrap" }}>{r.succeededCount}/{total}</span>
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {items.map((item) => (
          <span key={item.label} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: subtle }}>
            <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: item.color, flexShrink: 0 }} />
            {item.label}: {item.count}
          </span>
        ))}
      </div>
    </div>
  );
}
