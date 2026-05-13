import { ThemeSwitcher } from "../components/ThemeSwitcher";

export function Sidebar({ page, setPage, S, theme, onThemeChange, themes }) {
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
        <div style={{ color: "#cbd5e1", fontSize: 12, marginTop: 4 }}>模型微调平台</div>
      </div>
      {items.map(([key, label]) => (
        <button
          key={key}
          onClick={() => setPage(key)}
          style={{
            ...S.navBtn,
            background: active(key) ? (S.page.background === "#1a1a1a" ? "#667eea" : (S.page.background === "#f0f9ff" ? "#0ea5e9" : "#2d3748")) : "transparent",
            color: active(key) ? "#fff" : S.page.color,
          }}
        >
          {label}
        </button>
      ))}
      <div style={{ flex: 1 }} />
      <div style={{ marginBottom: 16, background: S.sidebar.background === "#fff" ? "#f8fafc" : "#2d2d2d", borderRadius: 16, padding: 14, fontSize: 12, color: S.sidebar.background === "#fff" ? "#64748b" : "#9ca3af", lineHeight: 1.7 }}>
        并行启动；失败不自动重试；所有子任务完成后再比较。
      </div>
      <ThemeSwitcher currentTheme={theme} onThemeChange={onThemeChange} themes={themes} S={S} />
    </aside>
  );
}
