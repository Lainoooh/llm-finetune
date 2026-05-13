import { useState } from "react";
import { ThemeSwitcher } from "../components/ThemeSwitcher";

export function Sidebar({ page, setPage, S, theme, onThemeChange, themes }) {
  const [hoverKey, setHoverKey] = useState(null);

  const items = [
    ["dashboard", "总览"],
    ["servers", "服务器"],
    ["tasks", "微调训练任务"],
    ["compare", "综合对比"],
  ];

  const active = (key) => (key === "tasks" ? ["tasks", "taskDetail", "subtask"].includes(page) : page === key);

  const getNavBackground = (key) => {
    if (active(key)) return S.page.background === "#0a0a0a" ? "#667eea" : "#0f172a";
    if (hoverKey === key) return S.page.background === "#0a0a0a" ? "#2d2d2d" : "#f1f5f9";
    return "transparent";
  };

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
          onMouseEnter={() => setHoverKey(key)}
          onMouseLeave={() => setHoverKey(null)}
          style={{
            ...S.navBtn,
            background: getNavBackground(key),
            color: active(key) ? "#fff" : (S.page.background === "#0a0a0a" ? S.page.color : "#475569"),
            transition: "all 0.15s ease",
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
