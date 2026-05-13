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
        marginBottom: 20,
        paddingBottom: 16,
        borderBottom: `1px solid ${S.page.background === "#F8F9FA" ? "#E5E7EB" : "#2a2a2a"}`
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
            ...(active(key) ? S.navBtnActive : {}),
          }}
          onMouseEnter={(e) => {
            if (!active(key)) {
              Object.assign(e.currentTarget.style, S.navBtnHover);
            }
          }}
          onMouseLeave={(e) => {
            if (!active(key)) {
              Object.assign(e.currentTarget.style, S.navBtn);
            }
          }}
        >
          {label}
        </button>
      ))}
      <div style={{ flex: 1 }} />
      <div style={{
        marginBottom: 16,
        background: S.page.background === "#F8F9FA" ? "#F9FAFB" : "#2a2a2a",
        borderRadius: 12,
        padding: 14,
        fontSize: 12,
        color: S.page.background === "#F8F9FA" ? "#6B7280" : "#9ca3af",
        lineHeight: 1.7
      }}>
        并行启动；失败不自动重试；所有子任务完成后再比较。
      </div>
      <ThemeSwitcher currentTheme={theme} onThemeChange={onThemeChange} themes={themes} S={S} />
    </aside>
  );
}
