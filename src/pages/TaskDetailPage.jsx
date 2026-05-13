export function TaskDetailPage({ task, setTask, setPage, S, statusPalette }) {
  function cloneTask(sub) {
    const next = `task_${String(task.subtasks.length + 1).padStart(3, "0")}`;
    setTask({ ...task, subtasks: [...task.subtasks, { ...sub, id: next, name: `${sub.name}_copy`, status: "draft", score: null }] });
  }

  function startAll() {
    setTask({ ...task, status: "running", subtasks: task.subtasks.map((s) => (["draft", "failed"].includes(s.status) ? { ...s, status: "running" } : s)) });
  }

  const running = task.subtasks.filter((s) => s.status === "running").length;
  const succeeded = task.subtasks.filter((s) => s.status === "succeeded").length;
  const failed = task.subtasks.filter((s) => s.status === "failed").length;

  return (
    <Card S={S}>
      <div style={{ ...S.row, borderBottom: "1px solid", borderColor: S.card.border.split(" ")[2], paddingBottom: 16 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Metric label="ID" value={task.id} wide />
          <Metric label="MODEL" value={task.modelName} wide />
          <Badge status={task.status} statusPalette={statusPalette} />
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Button secondary S={S}>新建子任务</Button>
          <Button onClick={startAll} S={S}>并行启动任务</Button>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12, marginTop: 16 }}>
        <Info label="TOTAL" value={task.subtasks.length} />
        <Info label="RUNNING" value={running} />
        <Info label="SUCCEEDED" value={succeeded} />
        <Info label="FAILED" value={failed} />
      </div>
      <TaskTable subtasks={task.subtasks} onClone={cloneTask} onConfig={() => setPage("subtask")} S={S} statusPalette={statusPalette} />
    </Card>
  );
}
