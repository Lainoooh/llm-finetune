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
      {/* Logo区域 - 照抄参考项目 */}
      <div style={{
        height: 72,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        borderBottom: `1px solid ${S.page.background === "#F8F9FA" ? "#f3f4f6" : "#2a2a2a"}`,
        padding: '0 16px',
        background: S.sidebar.background
      }}>
        <img src="/pic/icon_logo.png" alt="logo" style={{ width: 40, height: 40, flexShrink: 0, objectFit: 'contain' }} />
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, gap: 3 }}>
          <img src="/pic/icon_name.png" alt="北京证券交易所" style={{ height: 22, objectFit: 'contain', objectPosition: 'left' }} />
          <div style={{ width: '100%', height: 1, background: S.page.background === "#F8F9FA" ? "#e5e7eb" : "#3a3a3a" }}></div>
          <span style={{
            fontSize: 11,
            color: S.page.background === "#F8F9FA" ? "#6b7280" : "#9ca3af",
            fontWeight: 700,
            letterSpacing: '0.5px',
            lineHeight: 1.2,
            whiteSpace: 'nowrap'
          }}>模型微调平台</span>
        </div>
      </div>

      {/* 导航按钮区域 */}
      <div style={{ padding: '12px 12px 0 12px', flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 12 }}>
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
        </div>

        {/* 主题切换器 */}
        <div style={{ paddingBottom: 12 }}>
          <ThemeSwitcher currentTheme={theme} onThemeChange={onThemeChange} themes={themes} S={S} />
        </div>
      </div>
    </aside>
  );
}
