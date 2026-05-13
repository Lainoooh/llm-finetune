import { useState } from "react";
import { Card } from "../components/Card";
import { Button } from "../components/Button";
import { Badge } from "../components/Badge";
import { Metric } from "../components/Metric";
import { Info } from "../components/Info";
import { TaskTable } from "../components/TaskTable";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Breadcrumb } from "../layouts/Breadcrumb";

export function TaskDetailPage({ task, setTask, setPage, S, statusPalette }) {
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, subtask: null });

  function cloneTask(sub) {
    const next = `task_${String(task.subtasks.length + 1).padStart(3, "0")}`;
    setTask({ ...task, subtasks: [...task.subtasks, { ...sub, id: next, name: `${sub.name}_copy`, status: "draft", score: null }] });
  }

  function deleteSubtask(sub) {
    setDeleteConfirm({ open: true, subtask: sub });
  }

  function confirmDelete() {
    setTask({ ...task, subtasks: task.subtasks.filter((s) => s.id !== deleteConfirm.subtask.id) });
    setDeleteConfirm({ open: false, subtask: null });
  }

  function startAll() {
    setTask({ ...task, status: "running", subtasks: task.subtasks.map((s) => (["draft", "failed"].includes(s.status) ? { ...s, status: "running" } : s)) });
  }

  function createNewSubtask() {
    const next = `task_${String(task.subtasks.length + 1).padStart(3, "0")}`;
    const newSubtask = {
      id: next,
      name: `new_subtask_${task.subtasks.length + 1}`,
      serverName: "A100-训练机-01",
      status: "draft",
      gpu: "0,1",
      learningRate: "5e-5",
      epoch: 3,
      batchSize: 2,
      step: 500,
      loss: null,
      score: null,
      outputDir: `/workspace/finetune-platform/outputs/${task.name}/${next}`,
    };
    setTask({ ...task, subtasks: [...task.subtasks, newSubtask] });
  }

  const running = task.subtasks.filter((s) => s.status === "running").length;
  const succeeded = task.subtasks.filter((s) => s.status === "succeeded").length;
  const failed = task.subtasks.filter((s) => s.status === "failed").length;

  return (
    <Card S={S}>
      <Breadcrumb page="taskDetail" setPage={setPage} task={task} S={S} />

      {/* 顶部信息区域 - 表格式 */}
      <div style={{ borderBottom: "1px solid", borderColor: S.card.border.split(" ")[2], paddingBottom: 16, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 24, fontSize: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ color: S.page.background === "#F8F9FA" ? "#6B7280" : "#9ca3af", fontWeight: 500 }}>任务名称:</span>
              <span style={{ color: S.page.color, fontWeight: 700, fontSize: 15 }}>{task.modelName}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ color: S.page.background === "#F8F9FA" ? "#6B7280" : "#9ca3af", fontWeight: 500 }}>ID:</span>
              <span style={{ color: S.page.background === "#F8F9FA" ? "#6B7280" : "#9ca3af", fontWeight: 600 }}>{task.id}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ color: S.page.background === "#F8F9FA" ? "#6B7280" : "#9ca3af", fontWeight: 500 }}>状态:</span>
              <Badge status={task.status} statusPalette={statusPalette} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Button secondary onClick={createNewSubtask} S={S}>新建子任务</Button>
            <Button onClick={startAll} S={S}>并行启动任务</Button>
          </div>
        </div>

        {/* 统计信息 */}
        <div style={{ display: "flex", gap: 16, fontSize: 13 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: "#10b981" }}></div>
            <span style={{ color: S.page.background === "#F8F9FA" ? "#6B7280" : "#9ca3af" }}>成功: {succeeded}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: "#004EA2" }}></div>
            <span style={{ color: S.page.background === "#F8F9FA" ? "#6B7280" : "#9ca3af" }}>运行中: {running}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: "#ef4444" }}></div>
            <span style={{ color: S.page.background === "#F8F9FA" ? "#6B7280" : "#9ca3af" }}>失败: {failed}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ color: S.page.background === "#F8F9FA" ? "#6B7280" : "#9ca3af" }}>待处理: {task.subtasks.length - succeeded - running - failed}</span>
          </div>
          <div style={{ fontWeight: 600, color: S.page.color }}>总计: {task.subtasks.length}</div>
        </div>
      </div>

      <TaskTable subtasks={task.subtasks} onClone={cloneTask} onConfig={() => setPage("subtask")} onDelete={deleteSubtask} S={S} statusPalette={statusPalette} />

      <ConfirmDialog
        open={deleteConfirm.open}
        title="删除子任务"
        message={`确定要删除子任务 "${deleteConfirm.subtask?.id}" (${deleteConfirm.subtask?.name}) 吗？删除后将无法恢复。`}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirm({ open: false, subtask: null })}
        confirmText="删除"
        danger={true}
        S={S}
      />
    </Card>
  );
}
