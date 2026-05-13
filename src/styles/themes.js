import { useState, useEffect } from "react";

// 主题配置
export const themes = {
  light: {
    name: "浅色",
    S: {
      page: { minHeight: "100vh", background: "#f7f7f8", color: "#2d3748", fontFamily: "Arial, sans-serif" },
      layout: { display: "flex" },
      sidebar: { width: 288, height: "100vh", flexShrink: 0, background: "#fff", borderRight: "1px solid #e5e7eb", padding: 20, boxSizing: "border-box", display: "flex", flexDirection: "column" },
      brand: { background: "linear-gradient(135deg, #10a37f 0%, #1a7f64 100%)", color: "#fff", borderRadius: 16, padding: 16, marginBottom: 24 },
      navBtn: { width: "100%", textAlign: "left", border: 0, borderRadius: 10, padding: "10px 12px", marginBottom: 6, cursor: "pointer", fontWeight: 600, transition: "all 0.2s" },
      main: { height: "100vh", overflow: "auto", flex: 1, padding: 28, boxSizing: "border-box" },
      card: { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" },
      row: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" },
      btn: { border: 0, borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontWeight: 600, fontSize: 13, transition: "all 0.2s" },
      table: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
      th: { background: "#f9fafb", color: "#6b7280", textTransform: "uppercase", fontSize: 11, textAlign: "left", padding: "12px 14px", borderBottom: "1px solid #e5e7eb", fontWeight: 600 },
      td: { padding: "12px 14px", borderBottom: "1px solid #f3f4f6", verticalAlign: "middle" },
      input: { width: "100%", boxSizing: "border-box", border: "1px solid #d1d5db", borderRadius: 8, padding: "9px 12px", fontSize: 13, transition: "border 0.2s" },
    },
    statusPalette: {
      online: ["#d1fae5", "#059669", "#a7f3d0"],
      running: ["#dbeafe", "#2563eb", "#bfdbfe"],
      succeeded: ["#d1fae5", "#059669", "#a7f3d0"],
      failed: ["#fee2e2", "#dc2626", "#fecaca"],
      draft: ["#f3f4f6", "#6b7280", "#e5e7eb"],
      waiting: ["#fef3c7", "#d97706", "#fde68a"],
    },
  },
  dark: {
    name: "深色",
    S: {
      page: { minHeight: "100vh", background: "#1a1a1a", color: "#ececec", fontFamily: "Arial, sans-serif" },
      layout: { display: "flex" },
      sidebar: { width: 288, height: "100vh", flexShrink: 0, background: "#202020", borderRight: "1px solid #2d2d2d", padding: 20, boxSizing: "border-box", display: "flex", flexDirection: "column" },
      brand: { background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", color: "#fff", borderRadius: 16, padding: 16, marginBottom: 24 },
      navBtn: { width: "100%", textAlign: "left", border: 0, borderRadius: 10, padding: "10px 12px", marginBottom: 6, cursor: "pointer", fontWeight: 600, transition: "all 0.2s" },
      main: { height: "100vh", overflow: "auto", flex: 1, padding: 28, boxSizing: "border-box" },
      card: { background: "#202020", border: "1px solid #2d2d2d", borderRadius: 16, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.3)" },
      row: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" },
      btn: { border: 0, borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontWeight: 600, fontSize: 13, transition: "all 0.2s" },
      table: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
      th: { background: "#2d2d2d", color: "#9ca3af", textTransform: "uppercase", fontSize: 11, textAlign: "left", padding: "12px 14px", borderBottom: "1px solid #3d3d3d", fontWeight: 600 },
      td: { padding: "12px 14px", borderBottom: "1px solid #2d2d2d", verticalAlign: "middle", color: "#ececec" },
      input: { width: "100%", boxSizing: "border-box", border: "1px solid #3d3d3d", borderRadius: 8, padding: "9px 12px", fontSize: 13, background: "#2d2d2d", color: "#ececec", transition: "border 0.2s" },
    },
    statusPalette: {
      online: ["#064e3b", "#10b981", "#065f46"],
      running: ["#1e3a8a", "#3b82f6", "#1e40af"],
      succeeded: ["#064e3b", "#10b981", "#065f46"],
      failed: ["#7f1d1d", "#ef4444", "#991b1b"],
      draft: ["#374151", "#9ca3af", "#4b5563"],
      waiting: ["#78350f", "#f59e0b", "#92400e"],
    },
  },
  fresh: {
    name: "清新",
    S: {
      page: { minHeight: "100vh", background: "#f0f9ff", color: "#1e293b", fontFamily: "Arial, sans-serif" },
      layout: { display: "flex" },
      sidebar: { width: 288, height: "100vh", flexShrink: 0, background: "#fff", borderRight: "1px solid #e0f2fe", padding: 20, boxSizing: "border-box", display: "flex", flexDirection: "column" },
      brand: { background: "linear-gradient(135deg, #0ea5e9 0%, #06b6d4 100%)", color: "#fff", borderRadius: 16, padding: 16, marginBottom: 24 },
      navBtn: { width: "100%", textAlign: "left", border: 0, borderRadius: 10, padding: "10px 12px", marginBottom: 6, cursor: "pointer", fontWeight: 600, transition: "all 0.2s" },
      main: { height: "100vh", overflow: "auto", flex: 1, padding: 28, boxSizing: "border-box" },
      card: { background: "#fff", border: "1px solid #e0f2fe", borderRadius: 16, padding: 20, boxShadow: "0 1px 3px rgba(14,165,233,0.08)" },
      row: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" },
      btn: { border: 0, borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontWeight: 600, fontSize: 13, transition: "all 0.2s" },
      table: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
      th: { background: "#f0f9ff", color: "#64748b", textTransform: "uppercase", fontSize: 11, textAlign: "left", padding: "12px 14px", borderBottom: "1px solid #e0f2fe", fontWeight: 600 },
      td: { padding: "12px 14px", borderBottom: "1px solid #f0f9ff", verticalAlign: "middle" },
      input: { width: "100%", boxSizing: "border-box", border: "1px solid #bae6fd", borderRadius: 8, padding: "9px 12px", fontSize: 13, transition: "border 0.2s" },
    },
    statusPalette: {
      online: ["#ccfbf1", "#0d9488", "#99f6e4"],
      running: ["#dbeafe", "#0284c7", "#bae6fd"],
      succeeded: ["#ccfbf1", "#0d9488", "#99f6e4"],
      failed: ["#fee2e2", "#dc2626", "#fecaca"],
      draft: ["#f1f5f9", "#64748b", "#e2e8f0"],
      waiting: ["#fef3c7", "#d97706", "#fde68a"],
    },
  },
};

export const statusText = {
  online: "在线",
  running: "训练中",
  succeeded: "成功",
  failed: "失败",
  draft: "草稿",
  waiting: "等待完成",
};

// 主题 Hook
export function useTheme() {
  const [currentTheme, setCurrentTheme] = useState(() => {
    const saved = localStorage.getItem("theme");
    return saved && themes[saved] ? saved : "light";
  });

  useEffect(() => {
    localStorage.setItem("theme", currentTheme);
  }, [currentTheme]);

  return {
    theme: currentTheme,
    themeConfig: themes[currentTheme],
    setTheme: setCurrentTheme,
    allThemes: themes,
  };
}
