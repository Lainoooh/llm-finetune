import { S } from "../styles/styles";

export function Sidebar({ page, setPage }) {
  const items = [
    ["dashboard", "总览"],
    ["servers", "服务器"],
    ["tasks", "微调训练任务"],
    ["compare", "综合对比"],
  ];

  const active = (key) => (key === "tasks" ? ["tasks", "taskDetail", "subtask"].includes(page) : page === key);

  return (
    <aside style={S.sidebar}>
      <div style={S.brand}>
        <div style={{ fontWeight: 800 }}>微调工具平台</div>
        <div style={{ color: "#cbd5e1", fontSize: 12, marginTop: 4 }}>LLaMA-Factory Orchestrator</div>
      </div>
      {items.map(([key, label]) => (
        <button
          key={key}
          onClick={() => setPage(key)}
          style={{
            ...S.navBtn,
            background: active(key) ? "#0f172a" : "transparent",
            color: active(key) ? "#fff" : "#475569",
          }}
        >
          {label}
        </button>
      ))}
      <div style={{ marginTop: 40, background: "#f8fafc", borderRadius: 16, padding: 14, fontSize: 12, color: "#64748b", lineHeight: 1.7 }}>
        并行启动；失败不自动重试；所有子任务完成后再比较。
      </div>
    </aside>
  );
}
