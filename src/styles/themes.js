import { useState, useEffect } from "react";

// 主题配置
export const themes = {
  light: {
    name: "浅色",
    S: {
      page: { minHeight: "100vh", background: "#f1f5f9", color: "#0f172a", fontFamily: "Arial, sans-serif" },
      layout: { display: "flex" },
      sidebar: { width: 288, height: "100vh", flexShrink: 0, background: "#fff", borderRight: "1px solid #e2e8f0", padding: 20, boxSizing: "border-box", display: "flex", flexDirection: "column" },
      brand: { background: "#0f172a", color: "#fff", borderRadius: 18, padding: 16, marginBottom: 24 },
      navBtn: { width: "100%", textAlign: "left", border: 0, borderRadius: 12, padding: "10px 12px", marginBottom: 6, cursor: "pointer", fontWeight: 600 },
      main: { height: "100vh", overflow: "auto", flex: 1, padding: 28, boxSizing: "border-box" },
      card: { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 18, padding: 20, boxShadow: "0 1px 2px rgba(15,23,42,0.05)" },
      row: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" },
      btn: { border: 0, borderRadius: 10, padding: "8px 12px", cursor: "pointer", fontWeight: 700, fontSize: 12 },
      table: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
      th: { background: "#f8fafc", color: "#64748b", textTransform: "uppercase", fontSize: 11, textAlign: "left", padding: "12px 14px", borderBottom: "1px solid #e2e8f0" },
      td: { padding: "12px 14px", borderBottom: "1px solid #e2e8f0", verticalAlign: "middle" },
      input: { width: "100%", boxSizing: "border-box", border: "1px solid #cbd5e1", borderRadius: 10, padding: "9px 10px", fontSize: 13 },
    },
    statusPalette: {
      online: ["#ecfdf5", "#047857", "#a7f3d0"],
      running: ["#eef2ff", "#4338ca", "#c7d2fe"],
      succeeded: ["#ecfdf5", "#047857", "#a7f3d0"],
      failed: ["#fff1f2", "#be123c", "#fecdd3"],
      draft: ["#f8fafc", "#475569", "#e2e8f0"],
      waiting: ["#fffbeb", "#b45309", "#fde68a"],
    },
  },
  dark: {
    name: "深色",
    S: {
      page: { minHeight: "100vh", background: "#0a0a0a", color: "#e0e0e0", fontFamily: "Arial, sans-serif" },
      layout: { display: "flex" },
      sidebar: { width: 288, height: "100vh", flexShrink: 0, background: "#1a1a1a", borderRight: "1px solid #2a2a2a", padding: 20, boxSizing: "border-box", display: "flex", flexDirection: "column" },
      brand: { background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", color: "#fff", borderRadius: 16, padding: 16, marginBottom: 24 },
      navBtn: { width: "100%", textAlign: "left", border: 0, borderRadius: 10, padding: "10px 12px", marginBottom: 6, cursor: "pointer", fontWeight: 600, transition: "all 0.2s" },
      main: { height: "100vh", overflow: "auto", flex: 1, padding: 28, boxSizing: "border-box" },
      card: { background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 16, padding: 20, boxShadow: "0 4px 12px rgba(0,0,0,0.5)" },
      row: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" },
      btn: { border: 0, borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontWeight: 600, fontSize: 13, transition: "all 0.2s" },
      table: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
      th: { background: "#252525", color: "#999999", textTransform: "uppercase", fontSize: 11, textAlign: "left", padding: "12px 14px", borderBottom: "1px solid #2a2a2a", fontWeight: 600 },
      td: { padding: "12px 14px", borderBottom: "1px solid #252525", verticalAlign: "middle", color: "#e0e0e0" },
      input: { width: "100%", boxSizing: "border-box", border: "1px solid #3a3a3a", borderRadius: 8, padding: "9px 12px", fontSize: 13, background: "#252525", color: "#e0e0e0", transition: "border 0.2s" },
    },
    statusPalette: {
      online: ["#1b5e20", "#4caf50", "#2e7d32"],
      running: ["#0d47a1", "#2196f3", "#1565c0"],
      succeeded: ["#1b5e20", "#4caf50", "#2e7d32"],
      failed: ["#b71c1c", "#f44336", "#c62828"],
      draft: ["#424242", "#9e9e9e", "#616161"],
      waiting: ["#e65100", "#ff9800", "#ef6c00"],
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
