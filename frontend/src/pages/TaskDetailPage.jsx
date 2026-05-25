import { useEffect, useMemo, useRef, useState } from "react";
import { Card } from "../components/Card";
import { Button } from "../components/Button";
import { Badge } from "../components/Badge";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Breadcrumb } from "../layouts/Breadcrumb";
import { Pagination } from "../components/Pagination";
import { TaskTable } from "../components/TaskTable";
import { Field } from "../components/Field";
import { cloneSubtask, createSubtask, deleteSubtask, startTask } from "../api/tasksApi";

const pageSize = 10;

export function TaskDetailPage({ task, refreshTask, selectSubtask, setPage, S, statusPalette }) {
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, subtask: null });
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("all");
  const [openStatusDropdown, setOpenStatusDropdown] = useState(false);
  const [busy, setBusy] = useState(false);
  const [newSubtaskOpen, setNewSubtaskOpen] = useState(false);
  const [newSubtaskDraft, setNewSubtaskDraft] = useState({ name: "", baseModel: "" });
  const dropdownRef = useRef(null);

  const subtasks = task.subtasks || [];
  const filteredSubtasks = useMemo(() => {
    const searchLower = searchTerm.toLowerCase();
    return subtasks.filter((item) => {
      const matchesSearch = [item.id, item.subtaskCode, item.name, item.serverName, item.gpu].some((value) => String(value || "").toLowerCase().includes(searchLower));
      const matchesStatus = statusFilter === "all" || item.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [searchTerm, statusFilter, subtasks]);

  const totalPages = Math.ceil(filteredSubtasks.length / pageSize);
  const currentSubtasks = filteredSubtasks.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const statusCounts = {
    all: subtasks.length,
    running: subtasks.filter((s) => s.status === "running").length,
    succeeded: subtasks.filter((s) => s.status === "succeeded").length,
    failed: subtasks.filter((s) => s.status === "failed").length,
    draft: subtasks.filter((s) => s.status === "draft").length,
  };
  const statusOptions = [
    { key: "all", label: "全部", count: statusCounts.all },
    { key: "running", label: "运行中", count: statusCounts.running },
    { key: "succeeded", label: "已完成", count: statusCounts.succeeded },
    { key: "failed", label: "失败", count: statusCounts.failed },
    { key: "draft", label: "草稿", count: statusCounts.draft },
  ];

  useEffect(() => {
    function handleClickOutside(event) {
      if (openStatusDropdown && dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpenStatusDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [openStatusDropdown]);

  function handleStatusFilter(status) {
    setStatusFilter(status);
    setCurrentPage(1);
    setOpenStatusDropdown(false);
  }

  async function handleClone(subtask) {
    try {
      await cloneSubtask(subtask.subtaskCode || subtask.id);
      await refreshTask();
    } catch (error) {
      alert(`复制子任务失败：${error.message}`);
    }
  }

  async function confirmDelete() {
    try {
      await deleteSubtask(deleteConfirm.subtask.subtaskCode || deleteConfirm.subtask.id);
      setDeleteConfirm({ open: false, subtask: null });
      await refreshTask();
    } catch (error) {
      alert(`删除子任务失败：${error.message}`);
    }
  }

  async function handleStartAll() {
    setBusy(true);
    try {
      await startTask(task.taskCode || task.id);
      await refreshTask();
    } catch (error) {
      alert(`启动任务失败：${error.message}`);
    } finally {
      setBusy(false);
    }
  }

  function openNewSubtask() {
    setNewSubtaskDraft({ name: `new_subtask_${subtasks.length + 1}`, baseModel: "" });
    setNewSubtaskOpen(true);
  }

  async function confirmCreateSubtask() {
    if (!newSubtaskDraft.baseModel?.trim()) {
      alert("请填写基模路径");
      return;
    }
    try {
      await createSubtask(task.taskCode || task.id, {
        name: newSubtaskDraft.name,
        baseModel: newSubtaskDraft.baseModel,
        gpu: "0",
        learningRate: "5e-5",
        epoch: 3,
        batchSize: 2,
        step: 500,
      });
      setNewSubtaskOpen(false);
      await refreshTask();
    } catch (error) {
      alert(`新建子任务失败：${error.message}`);
    }
  }

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <Card S={S} style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <Breadcrumb page="taskDetail" setPage={setPage} task={task} S={S} />
        <div style={{ borderBottom: "1px solid", borderColor: S.card.border.split(" ")[2], paddingBottom: 16, marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ color: S.page.color, fontWeight: 700, fontSize: 18 }}>{task.name}</span>
                <Badge status={task.status} statusPalette={statusPalette} />
              </div>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 4, fontFamily: "monospace" }}>
                <span>{task.taskCode || task.id}</span>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Button secondary onClick={openNewSubtask} S={S}>新建子任务</Button>
              <Button onClick={handleStartAll} disabled={busy || !subtasks.length} S={S}>{busy ? "启动中..." : "并行启动任务"}</Button>
            </div>
          </div>

          {/* 统计信息和筛选栏 */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 13 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: "#10b981" }}></div>
              <span style={{ color: S.page.background === "#F8F9FA" ? "#6B7280" : "#9ca3af" }}>成功: {statusCounts.succeeded}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: "#004EA2" }}></div>
              <span style={{ color: S.page.background === "#F8F9FA" ? "#6B7280" : "#9ca3af" }}>运行中: {statusCounts.running}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: "#ef4444" }}></div>
              <span style={{ color: S.page.background === "#F8F9FA" ? "#6B7280" : "#9ca3af" }}>失败: {statusCounts.failed}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: S.page.background === "#0a0a0a" ? "#6b7280" : "#9CA3AF" }}></div>
              <span style={{ color: S.page.background === "#F8F9FA" ? "#6B7280" : "#9ca3af" }}>草稿: {statusCounts.draft}</span>
            </div>
            <div style={{ fontWeight: 600, color: S.page.color }}>总计: {subtasks.length}</div>

            {/* 分隔线 */}
            <div style={{ width: 1, height: 20, background: S.page.background === "#0a0a0a" ? "#374151" : "#e2e8f0" }} />

            {/* 状态下拉筛选 */}
            <div style={{ position: "relative" }} ref={dropdownRef}>
              <button
                onClick={() => setOpenStatusDropdown(!openStatusDropdown)}
                style={{
                  padding: "3px 8px",
                  border: `2px solid ${statusFilter !== "all" ? "#004EA2" : (S.page.background === "#0a0a0a" ? "#374151" : "#e2e8f0")}`,
                  borderRadius: 6,
                  background: statusFilter !== "all" ? (S.page.background === "#0a0a0a" ? "#004EA215" : "#F0F7FF") : (S.page.background === "#0a0a0a" ? "#1f2937" : "#ffffff"),
                  color: statusFilter !== "all" ? "#004EA2" : S.page.color,
                  fontSize: 13,
                  fontWeight: statusFilter !== "all" ? 600 : 500,
                  cursor: "pointer",
                  transition: "all 0.15s",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontFamily: "inherit",
                }}
                onMouseEnter={(e) => {
                  if (statusFilter === "all") {
                    e.currentTarget.style.borderColor = S.page.background === "#0a0a0a" ? "#4b5563" : "#cbd5e1";
                    e.currentTarget.style.background = S.page.background === "#0a0a0a" ? "#111827" : "#f8fafc";
                  }
                }}
                onMouseLeave={(e) => {
                  if (statusFilter === "all") {
                    e.currentTarget.style.borderColor = S.page.background === "#0a0a0a" ? "#374151" : "#e2e8f0";
                    e.currentTarget.style.background = S.page.background === "#0a0a0a" ? "#1f2937" : "#ffffff";
                  }
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                </svg>
                {statusOptions.find((opt) => opt.key === statusFilter)?.label || "全部"}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: openStatusDropdown ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>
              {openStatusDropdown ? (
                <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, minWidth: 180, background: S.page.background === "#0a0a0a" ? "#1f2937" : "#ffffff", border: `1px solid ${S.page.background === "#0a0a0a" ? "#374151" : "#e2e8f0"}`, borderRadius: 10, boxShadow: S.page.background === "#0a0a0a" ? "0 10px 25px rgba(0,0,0,0.5)" : "0 10px 25px rgba(0,0,0,0.1)", zIndex: 100, maxHeight: 280, overflowY: "auto", padding: 6 }}>
                  {statusOptions.map((option) => (
                    <button
                      key={option.key}
                      onClick={() => handleStatusFilter(option.key)}
                      style={{ width: "100%", padding: "8px 12px", border: 0, background: statusFilter === option.key ? (S.page.background === "#0a0a0a" ? "#374151" : "#f1f5f9") : "transparent", color: S.page.color, fontSize: 13, fontWeight: statusFilter === option.key ? 600 : 400, cursor: "pointer", textAlign: "left", borderRadius: 6, fontFamily: "inherit", display: "flex", justifyContent: "space-between", alignItems: "center" }}
                      onMouseEnter={(e) => {
                        if (statusFilter !== option.key) {
                          e.currentTarget.style.background = S.page.background === "#0a0a0a" ? "#374151" : "#f1f5f9";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (statusFilter !== option.key) {
                          e.currentTarget.style.background = "transparent";
                        }
                      }}
                    >
                      <span>{option.label}</span>
                      <span style={{ padding: "2px 7px", borderRadius: 5, background: S.page.background === "#0a0a0a" ? "#374151" : "#e5e7eb", color: S.page.background === "#0a0a0a" ? "#d1d5db" : "#6b7280", fontSize: 11, fontWeight: 600 }}>
                        {option.count}
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div style={{ position: "relative", width: 260 }}>
              <div style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: S.page.background === "#0a0a0a" ? "#6b7280" : "#94a3b8", display: "flex", alignItems: "center" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.35-4.35" />
                </svg>
              </div>
              <input value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} placeholder="搜索子任务..." style={{ ...S.input, width: "100%", padding: "6px 34px" }} />
              {searchTerm ? (
                <button onClick={() => { setSearchTerm(""); setCurrentPage(1); }} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", border: 0, background: "transparent", color: "#94a3b8", cursor: "pointer", padding: 2, display: "flex", alignItems: "center" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              ) : null}
            </div>
          </div>
        </div>

        <div style={{ flex: 1, overflow: "auto" }}>
          <TaskTable subtasks={currentSubtasks} onClone={handleClone} onConfig={(subtask) => selectSubtask(subtask.subtaskCode || subtask.id)} onDelete={(subtask) => setDeleteConfirm({ open: true, subtask })} S={S} statusPalette={statusPalette} />
        </div>

        <Pagination currentPage={currentPage} totalPages={totalPages} totalItems={filteredSubtasks.length} pageSize={pageSize} onPageChange={setCurrentPage} S={S} />
      </Card>

      <ConfirmDialog open={deleteConfirm.open} title="删除子任务" message={`确定要删除子任务 "${deleteConfirm.subtask?.id}" (${deleteConfirm.subtask?.name}) 吗？删除后将无法恢复。`} onConfirm={confirmDelete} onCancel={() => setDeleteConfirm({ open: false, subtask: null })} confirmText="删除" danger S={S} />

      {newSubtaskOpen ? (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, zIndex: 50 }}>
          <div style={{ background: S.card.background, borderRadius: 8, padding: 24, width: "min(520px, 100%)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e2e8f0", paddingBottom: 16, marginBottom: 20 }}>
              <b style={{ fontSize: 20, color: S.page.color }}>新建子任务</b>
              <div style={{ display: "flex", gap: 8 }}>
                <Button secondary onClick={() => setNewSubtaskOpen(false)} S={S}>取消</Button>
                <Button onClick={confirmCreateSubtask} disabled={!newSubtaskDraft.baseModel?.trim() || !newSubtaskDraft.name?.trim()} S={S}>创建</Button>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16 }}>
              <Field label="子任务名称" value={newSubtaskDraft.name} onChange={(e) => setNewSubtaskDraft({ ...newSubtaskDraft, name: e.target.value })} S={S} />
              <Field label="基模路径（必填）" value={newSubtaskDraft.baseModel} onChange={(e) => setNewSubtaskDraft({ ...newSubtaskDraft, baseModel: e.target.value })} S={S} placeholder="如 Qwen/Qwen3-8B" />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
