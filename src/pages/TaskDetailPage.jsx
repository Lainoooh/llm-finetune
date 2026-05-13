import { Card } from "../components/Card";
import { Button } from "../components/Button";
import { Badge } from "../components/Badge";
import { Metric } from "../components/Metric";
import { Info } from "../components/Info";
import { TaskTable } from "../components/TaskTable";
import { S } from "../styles/styles";

export function TaskDetailPage({ task, setTask, setPage }) {
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
    <Card>
      <div style={{ ...S.row, borderBottom: "1px solid #e2e8f0", paddingBottom: 16 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Metric label="ID" value={task.id} wide />
          <Metric label="MODEL" value={task.modelName} wide />
          <Badge status={task.status} />
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Button secondary>新建子任务</Button>
          <Button onClick={startAll}>并行启动任务</Button>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12, marginTop: 16 }}>
        <Info label="TOTAL" value={task.subtasks.length} />
        <Info label="RUNNING" value={running} />
        <Info label="SUCCEEDED" value={succeeded} />
        <Info label="FAILED" value={failed} />
      </div>
      <TaskTable subtasks={task.subtasks} onClone={cloneTask} onConfig={() => setPage("subtask")} />
    </Card>
  );
}
