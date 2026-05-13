import { useState, useMemo, useEffect } from "react";
import { S } from "./styles/styles";
import { Sidebar } from "./layouts/Sidebar";
import { Breadcrumb } from "./layouts/Breadcrumb";
import { Dashboard } from "./pages/Dashboard";
import { ServersPage } from "./pages/ServersPage";
import { TaskListPage } from "./pages/TaskListPage";
import { TaskDetailPage } from "./pages/TaskDetailPage";
import { SubtaskPage } from "./pages/SubtaskPage";
import { ComparePage } from "./pages/ComparePage";
import { initialServers, initialTask } from "./data/mockData";

function runSelfTests() {
  const allowed = ["online", "running", "succeeded", "failed", "draft", "waiting"];
  console.assert(initialServers.length === 2, "server seed count should be 2");
  console.assert(initialTask.subtasks.length === 3, "subtask seed count should be 3");
  console.assert(initialTask.subtasks.every((t) => allowed.includes(t.status)), "all statuses should be known");
  console.assert(initialTask.subtasks.every((t) => t.learningRate && t.epoch && t.batchSize && t.step), "subtasks should include LR/EP/BS/ST");
  console.assert(["user", "password", "host", "workDir"].every((k) => k in initialServers[0]), "server edit fields must exist");
}

export default function App() {
  const [page, setPage] = useState("dashboard");
  const [servers, setServers] = useState(initialServers);
  const [task, setTask] = useState(initialTask);

  useEffect(() => {
    runSelfTests();
  }, []);

  const content = useMemo(() => {
    if (page === "servers") return <ServersPage servers={servers} setServers={setServers} />;
    if (page === "tasks") return <TaskListPage task={task} setPage={setPage} />;
    if (page === "taskDetail") return <TaskDetailPage task={task} setTask={setTask} setPage={setPage} />;
    if (page === "subtask") return <SubtaskPage servers={servers} setPage={setPage} />;
    if (page === "compare") return <ComparePage task={task} setPage={setPage} />;
    return <Dashboard servers={servers} task={task} setPage={setPage} />;
  }, [page, servers, task]);

  return (
    <div style={S.page}>
      <div style={S.layout}>
        <Sidebar page={page} setPage={setPage} />
        <main style={S.main}>
          <Breadcrumb page={page} setPage={setPage} task={task} />
          {content}
        </main>
      </div>
    </div>
  );
}
