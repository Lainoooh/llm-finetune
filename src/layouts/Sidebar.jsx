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
      <div style={{
        marginBottom: 32,
        paddingBottom: 20,
        borderBottom: `1px solid ${S.sidebar.borderRight.split(" ")[2]}`
      }}>
        <div style={{
          fontSize: 18,
          fontWeight: 700,
          color: S.page.color,
          letterSpacing: '0.5px'
        }}>模型微调平台</div>
      </div>
      {items.map(([key, label]) => (
        <button
          key={key}
          onClick={() => setPage(key)}
          style={{
            ...S.navBtn,
            background: active(key) ? (S.page.background === "#0a0a0a" ? "#667eea" : "#0f172a") : "transparent",
            color: active(key) ? "#fff" : (S.page.background === "#0a0a0a" ? S.page.color : "#475569"),
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
