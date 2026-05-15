import { useState } from "react";
import { Card } from "../components/Card";
import { Button } from "../components/Button";
import { Badge } from "../components/Badge";
import { Metric } from "../components/Metric";
import { Info } from "../components/Info";
import { TaskTable } from "../components/TaskTable";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Breadcrumb } from "../layouts/Breadcrumb";
import { SearchBar } from "../components/SearchBar";
import { Pagination } from "../components/Pagination";

export function TaskDetailPage({ task, setTask, setPage, S, statusPalette }) {
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, subtask: null });
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // 搜索过滤
  const filteredSubtasks = task.subtasks.filter(subtask => {
    const searchLower = searchTerm.toLowerCase();
    return (
      subtask.id.toLowerCase().includes(searchLower) ||
      subtask.name.toLowerCase().includes(searchLower) ||
      subtask.serverName.toLowerCase().includes(searchLower) ||
      subtask.gpu.toLowerCase().includes(searchLower)
    );
  });

  // 分页逻辑
  const totalPages = Math.ceil(filteredSubtasks.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const currentSubtasks = filteredSubtasks.slice(startIndex, startIndex + pageSize);

  // 搜索处理
  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

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

  const running = filteredSubtasks.filter((s) => s.status === "running").length;
  const succeeded = filteredSubtasks.filter((s) => s.status === "succeeded").length;
  const failed = filteredSubtasks.filter((s) => s.status === "failed").length;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Card S={S} style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <Breadcrumb page="taskDetail" setPage={setPage} task={task} S={S} />

      {/* 顶部信息区域 */}
      <div style={{ borderBottom: "1px solid", borderColor: S.card.border.split(" ")[2], paddingBottom: 16, marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ color: S.page.color, fontWeight: 700, fontSize: 18 }}>{task.name}</span>
              <Badge status={task.status} statusPalette={statusPalette} />
            </div>
            <div style={{ fontSize: 12, color: S.page.background === "#F8F9FA" ? "#9CA3AF" : "#6b7280", marginTop: 4, display: "flex", alignItems: "center", gap: 8 }}>
              <span>{task.id}</span>
              <span style={{ color: S.page.background === "#F8F9FA" ? "#D1D5DB" : "#4b5563" }}>|</span>
              <span>训练模型名：{task.modelName}</span>
              <span style={{ color: S.page.background === "#F8F9FA" ? "#D1D5DB" : "#4b5563" }}>|</span>
              <span>基模：{task.baseModel}</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Button secondary onClick={createNewSubtask} S={S}>新建子任务</Button>
            <Button onClick={startAll} S={S}>并行启动任务</Button>
          </div>
        </div>

        {/* 统计信息 */}
        <div style={{ display: "flex", gap: 16, fontSize: 13, alignItems: "center" }}>
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
            <span style={{ color: S.page.background === "#F8F9FA" ? "#6B7280" : "#9ca3af" }}>待处理: {filteredSubtasks.length - succeeded - running - failed}</span>
          </div>
          <div style={{ fontWeight: 600, color: S.page.color }}>总计: {filteredSubtasks.length}</div>
        </div>
      </div>

      <SearchBar
        value={searchTerm}
        onChange={handleSearch}
        placeholder="搜索子任务ID、名称、服务器或GPU..."
        S={S}
      />

      <div style={{ flex: 1, overflow: 'auto' }}>
        <TaskTable subtasks={currentSubtasks} onClone={cloneTask} onConfig={() => setPage("subtask")} onDelete={deleteSubtask} S={S} statusPalette={statusPalette} />
      </div>

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={filteredSubtasks.length}
        pageSize={pageSize}
        onPageChange={setCurrentPage}
        S={S}
      />
    </Card>

    {/* 删除确认弹窗 */}

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
    </div>
  );
}
