import { useState } from "react";
import { Card } from "../components/Card";
import { SectionTitle } from "../components/SectionTitle";
import { Button } from "../components/Button";
import { Badge } from "../components/Badge";
import { Field } from "../components/Field";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Breadcrumb } from "../layouts/Breadcrumb";

export function TaskListPage({ task, setPage, S, statusPalette }) {
  const [editOpen, setEditOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [editDraft, setEditDraft] = useState({ name: "", modelName: "", baseModel: "" });
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, task: null });

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
    <Card S={S}>
      <Breadcrumb page="tasks" setPage={setPage} task={task} S={S} />
      <SectionTitle
        title="任务列表"
        desc={`共 ${rows.length} 个微调训练任务`}
        actions={
          <Button onClick={createNewTask} S={S}>新建微调训练任务</Button>
        }
        S={S}
      />
      <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 16 }}>
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
            {rows.map((r) => (
              <tr key={r.id}>
                <td style={S.td}>
                  <button onClick={() => setPage("taskDetail")} style={{ border: 0, background: "transparent", fontWeight: 800, cursor: "pointer", color: S.page.color }}>
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
                        borderRadius: 6,
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
                        borderRadius: 6,
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
                        borderRadius: 6,
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
                        borderRadius: 6,
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
    </Card>
  );
}
