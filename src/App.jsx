import { useCallback, useEffect, useMemo, useState } from "react";
import { useTheme } from "./styles/themes";
import { Sidebar } from "./layouts/Sidebar";
import { Header } from "./layouts/Header";
import { Dashboard } from "./pages/Dashboard";
import { ServersPage } from "./pages/ServersPage";
import { TaskListPage } from "./pages/TaskListPage";
import { TaskDetailPage } from "./pages/TaskDetailPage";
import { SubtaskPage } from "./pages/SubtaskPage";
import { ComparePage } from "./pages/ComparePage";
import { ScriptsPage } from "./pages/ScriptsPage";
import { listServers } from "./api/serversApi";
import { getDashboardSummary, getLossMetrics } from "./api/dashboardApi";
import { getTask, listSubtasks, listTasks } from "./api/tasksApi";

const emptySummary = {
  serversTotal: 0,
  serversOnline: 0,
  serversOffline: 0,
  tasksTotal: 0,
  subtasksTotal: 0,
  runningSubtasks: 0,
  failedSubtasks: 0,
};

const emptyTask = {
  id: "",
  taskCode: "",
  name: "暂无任务",
  modelName: "-",
  baseModel: "-",
  status: "draft",
  subtaskCount: 0,
  runningCount: 0,
  subtasks: [],
};

function pageFromPath() {
  const path = window.location.pathname;
  if (path === "/servers") return "servers";
  if (path === "/tasks") return "tasks";
  if (path === "/taskDetail") return "taskDetail";
  if (path === "/subtask") return "subtask";
  if (path === "/compare") return "compare";
  if (path === "/scripts") return "scripts";
  return "dashboard";
}

export default function App() {
  const [page, setPageState] = useState(pageFromPath);
  const [servers, setServers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [task, setTask] = useState(emptyTask);
  const [selectedTaskCode, setSelectedTaskCode] = useState("");
  const [selectedSubtaskCode, setSelectedSubtaskCode] = useState("");
  const [summary, setSummary] = useState(emptySummary);
  const [lossSeries, setLossSeries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { theme, themeConfig, setTheme, allThemes } = useTheme();

  const loadServers = useCallback(async () => {
    const items = await listServers();
    setServers(items);
    return items;
  }, []);

  const loadTasks = useCallback(async () => {
    const items = await listTasks();
    setTasks(items);
    return items;
  }, []);

  const loadSummary = useCallback(async () => {
    const data = await getDashboardSummary();
    setSummary(data);
    return data;
  }, []);

  const loadLoss = useCallback(async (taskCode = "") => {
    const data = await getLossMetrics(taskCode);
    setLossSeries(data.series || []);
  }, []);

  const loadTaskDetail = useCallback(async (taskCode) => {
    if (!taskCode) {
      setTask(emptyTask);
      return emptyTask;
    }
    const [detail, subtasks] = await Promise.all([getTask(taskCode), listSubtasks(taskCode)]);
    const nextTask = { ...detail, subtasks };
    setTask(nextTask);
    if (!selectedSubtaskCode && subtasks.length) {
      setSelectedSubtaskCode(subtasks[0].subtaskCode || subtasks[0].id);
    }
    return nextTask;
  }, [selectedSubtaskCode]);

  const refreshAll = useCallback(async () => {
    setError("");
    const [serverItems, taskItems] = await Promise.all([loadServers(), loadTasks(), loadSummary()]);
    const nextTaskCode = selectedTaskCode || taskItems[0]?.taskCode || taskItems[0]?.id || "";
    if (nextTaskCode) {
      setSelectedTaskCode(nextTaskCode);
      await loadTaskDetail(nextTaskCode);
      await loadLoss(nextTaskCode);
    } else {
      setTask(emptyTask);
      await loadLoss("");
    }
    return { serverItems, taskItems };
  }, [loadLoss, loadServers, loadSummary, loadTaskDetail, loadTasks, selectedTaskCode]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    refreshAll()
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const handlePopState = () => setPageState(pageFromPath());
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const setPage = useCallback((newPage) => {
    setPageState(newPage);
    const path = newPage === "dashboard" ? "/" : `/${newPage}`;
    window.history.pushState({}, "", path);
  }, []);

  const selectTask = useCallback(async (taskCode, nextPage = "taskDetail") => {
    setSelectedTaskCode(taskCode);
    setSelectedSubtaskCode("");
    await loadTaskDetail(taskCode);
    await loadLoss(taskCode);
    setPage(nextPage);
  }, [loadLoss, loadTaskDetail, setPage]);

  const selectSubtask = useCallback((subtaskCode) => {
    setSelectedSubtaskCode(subtaskCode);
    setPage("subtask");
  }, [setPage]);

  const selectedSubtask = useMemo(() => {
    return task.subtasks?.find((item) => (item.subtaskCode || item.id) === selectedSubtaskCode) || task.subtasks?.[0] || null;
  }, [selectedSubtaskCode, task.subtasks]);

  const refreshTask = useCallback(async () => {
    await Promise.all([loadTasks(), loadSummary()]);
    if (selectedTaskCode) {
      await loadTaskDetail(selectedTaskCode);
      await loadLoss(selectedTaskCode);
    }
  }, [loadLoss, loadSummary, loadTaskDetail, loadTasks, selectedTaskCode]);

  const S = themeConfig.S;
  const statusPalette = themeConfig.statusPalette;

  const content = useMemo(() => {
    if (loading) {
      return <div style={{ padding: 24, color: S.page.color }}>正在加载真实数据...</div>;
    }
    if (error) {
      return <div style={{ padding: 24, color: "#ef4444" }}>接口加载失败：{error}</div>;
    }
    if (page === "servers") {
      return <ServersPage servers={servers} setServers={setServers} reloadServers={loadServers} S={S} statusPalette={statusPalette} />;
    }
    if (page === "tasks") {
      return <TaskListPage tasks={tasks} reload={refreshAll} selectTask={selectTask} S={S} statusPalette={statusPalette} />;
    }
    if (page === "taskDetail") {
      return <TaskDetailPage task={task} refreshTask={refreshTask} selectSubtask={selectSubtask} setPage={setPage} S={S} statusPalette={statusPalette} />;
    }
    if (page === "subtask") {
      return <SubtaskPage task={task} subtask={selectedSubtask} servers={servers} refreshTask={refreshTask} setPage={setPage} S={S} statusPalette={statusPalette} />;
    }
    if (page === "compare") {
      return <ComparePage task={task} lossSeries={lossSeries} setPage={setPage} refreshTask={refreshTask} S={S} statusPalette={statusPalette} />;
    }
    if (page === "scripts") {
      return <ScriptsPage servers={servers} S={S} statusPalette={statusPalette} />;
    }
    return <Dashboard summary={summary} lossSeries={lossSeries} setPage={setPage} S={S} />;
  }, [S, error, loadServers, loading, lossSeries, page, refreshAll, refreshTask, selectSubtask, selectTask, selectedSubtask, servers, statusPalette, summary, task]);

  return (
    <div style={S.page}>
      <div style={S.layout}>
        <Sidebar page={page} setPage={setPage} S={S} theme={theme} onThemeChange={setTheme} themes={allThemes} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, position: "relative", background: S.page.background, zIndex: 20, overflow: "hidden" }}>
          <Header S={S} />
          <main style={{ flex: 1, overflow: "auto", boxSizing: "border-box", padding: "10px" }}>{content}</main>
        </div>
      </div>
    </div>
  );
}
