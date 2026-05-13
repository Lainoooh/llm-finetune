import { useState, useMemo, useEffect } from "react";
import { useTheme, statusText } from "./styles/themes";
import { Sidebar } from "./layouts/Sidebar";
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
  const [page, setPage] = useState(() => {
    const path = window.location.pathname;
    if (path === "/servers") return "servers";
    if (path === "/tasks") return "tasks";
    if (path === "/taskDetail") return "taskDetail";
    if (path === "/subtask") return "subtask";
    if (path === "/compare") return "compare";
    return "dashboard";
  });
  const [servers, setServers] = useState(initialServers);
  const [task, setTask] = useState(initialTask);
  const { theme, themeConfig, setTheme, allThemes } = useTheme();

  useEffect(() => {
    runSelfTests();
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      if (path === "/servers") setPage("servers");
      else if (path === "/tasks") setPage("tasks");
      else if (path === "/taskDetail") setPage("taskDetail");
      else if (path === "/subtask") setPage("subtask");
      else if (path === "/compare") setPage("compare");
      else setPage("dashboard");
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const handleSetPage = (newPage) => {
    setPage(newPage);
    const path = newPage === "dashboard" ? "/" : `/${newPage}`;
    window.history.pushState({}, "", path);
  };

  const S = themeConfig.S;
  const statusPalette = themeConfig.statusPalette;

  const content = useMemo(() => {
    if (page === "servers") return <ServersPage servers={servers} setServers={setServers} S={S} statusPalette={statusPalette} />;
    if (page === "tasks") return <TaskListPage task={task} setPage={handleSetPage} S={S} statusPalette={statusPalette} />;
    if (page === "taskDetail") return <TaskDetailPage task={task} setTask={setTask} setPage={handleSetPage} S={S} statusPalette={statusPalette} />;
    if (page === "subtask") return <SubtaskPage servers={servers} setPage={handleSetPage} S={S} statusPalette={statusPalette} />;
    if (page === "compare") return <ComparePage task={task} setPage={handleSetPage} S={S} statusPalette={statusPalette} />;
    return <Dashboard servers={servers} task={task} setPage={handleSetPage} S={S} statusPalette={statusPalette} />;
  }, [page, servers, task, S, statusPalette]);

  return (
    <div style={S.page}>
      <div style={S.layout}>
        <Sidebar page={page} setPage={handleSetPage} S={S} theme={theme} onThemeChange={setTheme} themes={allThemes} />
        <main style={S.main}>
          {content}
        </main>
      </div>
    </div>
  );
}
