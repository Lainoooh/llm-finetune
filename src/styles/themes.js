import { useState, useEffect } from "react";

// 主题配置
export const themes = {
  light: {
    name: "浅色",
    S: {
      page: { height: "100vh", background: "#F8F9FA", color: "#1F2937", fontFamily: "Arial, sans-serif", overflow: "hidden" },
      layout: { display: "flex", height: "100vh" },
      sidebar: { width: 260, height: "100vh", flexShrink: 0, background: "#FFFFFF", borderRight: "1px solid #E5E7EB", boxSizing: "border-box", display: "flex", flexDirection: "column" },
      brand: { color: "#1F2937", borderRadius: 12, padding: 16, marginBottom: 12 },
      navBtn: { width: "100%", textAlign: "left", border: "1px solid transparent", borderRadius: 12, padding: "10px 16px", marginBottom: 4, cursor: "pointer", fontWeight: 600, fontSize: 13, transition: "all 0.2s", background: "transparent", color: "#6B7280" },
      navBtnActive: { background: "#F0F7FF", color: "#004EA2", border: "1px solid #CCE4FF", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" },
      navBtnHover: { background: "#F9FAFB", color: "#111827" },
      main: { height: "100vh", overflow: "auto", flex: 1, boxSizing: "border-box" },
      card: { background: "#FFFFFF", border: "1px solid #E5E7EB", borderRadius: 12, padding: 20, boxShadow: "0 1px 2px rgba(0,0,0,0.05)" },
      row: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" },
      btn: { border: 0, borderRadius: 12, padding: "10px 16px", cursor: "pointer", fontWeight: 600, fontSize: 13, transition: "all 0.2s" },
      btnPrimary: { background: "#004EA2", color: "#FFFFFF" },
      btnPrimaryHover: { background: "#003875" },
      btnSecondary: { background: "#1F2937", color: "#FFFFFF" },
      btnSecondaryHover: { background: "#374151" },
      table: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
      th: { background: "#F9FAFB", color: "#6B7280", textTransform: "uppercase", fontSize: 11, textAlign: "left", padding: "10px 8px", borderBottom: "1px solid #E5E7EB", fontWeight: 700 },
      td: { padding: "10px 8px", borderBottom: "1px solid #E5E7EB", verticalAlign: "middle", color: "#1F2937", textAlign: "left" },
      input: { width: "100%", boxSizing: "border-box", border: "1px solid #D1D5DB", borderRadius: 12, padding: "10px 12px", fontSize: 13, transition: "all 0.2s" },
      envCards: {
        cardBg: "#FFFFFF", cardBorder: "#e2e8f0", cardShadow: "0 1px 3px rgba(0,0,0,0.04)",
        innerBg: "#f8fafc", innerBorder: "#f1f5f9",
        title: "#0f172a", subtitle: "#64748b", value: "#0f172a",
        badgeGreenBg: "#ecfdf5", badgeGreenText: "#047857", badgeGreenBorder: "#a7f3d0",
        badgeBlueBg: "#eff6ff", badgeBlueText: "#1d4ed8", badgeBlueBorder: "#bfdbfe",
        badgeAmberBg: "#fffbeb", badgeAmberText: "#b45309", badgeAmberBorder: "#fde68a",
        badgeSlateBg: "#f8fafc", badgeSlateText: "#475569", badgeSlateBorder: "#e2e8f0",
        progressBarBg: "#f1f5f9", progressBlue: "#2563eb", progressAmber: "#f59e0b",
        iconBg: "#eff6ff", iconColor: "#1d4ed8",
        sectionIconBg: "#0f172a", sectionIconColor: "#FFFFFF",
        skeletonBg: "#e2e8f0",
      },
    },
    statusPalette: {
      online: ["#ecfdf5", "#047857", "#a7f3d0"],
      running: ["#eef2ff", "#4338ca", "#c7d2fe"],
      succeeded: ["#ecfdf5", "#047857", "#a7f3d0"],
      failed: ["#fff1f2", "#be123c", "#fecdd3"],
      draft: ["#f8fafc", "#475569", "#e2e8f0"],
      waiting: ["#fffbeb", "#b45309", "#fde68a"],
      offline: ["#f3f4f6", "#6b7280", "#d1d5db"],
    },
  },
  dark: {
    name: "深色",
    S: {
      page: { height: "100vh", background: "#0a0a0a", color: "#e0e0e0", fontFamily: "Arial, sans-serif", overflow: "hidden" },
      layout: { display: "flex", height: "100vh" },
      sidebar: { width: 260, height: "100vh", flexShrink: 0, background: "#1a1a1a", borderRight: "1px solid #2a2a2a", boxSizing: "border-box", display: "flex", flexDirection: "column" },
      brand: { background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", color: "#fff", borderRadius: 12, padding: 16, marginBottom: 12 },
      navBtn: { width: "100%", textAlign: "left", border: "1px solid transparent", borderRadius: 12, padding: "10px 16px", marginBottom: 4, cursor: "pointer", fontWeight: 600, fontSize: 13, transition: "all 0.2s", background: "transparent", color: "#9ca3af" },
      navBtnActive: { background: "#2a2a2a", color: "#8b5cf6", border: "1px solid #3a3a3a", boxShadow: "0 1px 2px rgba(0,0,0,0.3)" },
      navBtnHover: { background: "#2a2a2a", color: "#f3f4f6" },
      main: { height: "100vh", overflow: "auto", flex: 1, boxSizing: "border-box" },
      card: { background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 12, padding: 20, boxShadow: "0 4px 12px rgba(0,0,0,0.5)" },
      row: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" },
      btn: { border: 0, borderRadius: 12, padding: "10px 16px", cursor: "pointer", fontWeight: 600, fontSize: 13, transition: "all 0.2s" },
      btnPrimary: { background: "#8b5cf6", color: "#FFFFFF" },
      btnPrimaryHover: { background: "#7c3aed" },
      btnSecondary: { background: "#374151", color: "#FFFFFF" },
      btnSecondaryHover: { background: "#4b5563" },
      table: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
      th: { background: "#252525", color: "#999999", textTransform: "uppercase", fontSize: 11, textAlign: "left", padding: "10px 8px", borderBottom: "1px solid #2a2a2a", fontWeight: 600 },
      td: { padding: "10px 8px", borderBottom: "1px solid #252525", verticalAlign: "middle", color: "#e0e0e0", textAlign: "left" },
      input: { width: "100%", boxSizing: "border-box", border: "1px solid #3a3a3a", borderRadius: 12, padding: "10px 12px", fontSize: 13, background: "#252525", color: "#e0e0e0", transition: "border 0.2s" },
      envCards: {
        cardBg: "#1a1a1a", cardBorder: "#2a2a2a", cardShadow: "0 2px 8px rgba(0,0,0,0.3)",
        innerBg: "#252525", innerBorder: "#2d2d2d",
        title: "#f1f5f9", subtitle: "#94a3b8", value: "#e2e8f0",
        badgeGreenBg: "#1b5e20", badgeGreenText: "#4caf50", badgeGreenBorder: "#2e7d32",
        badgeBlueBg: "#0d47a1", badgeBlueText: "#64b5f6", badgeBlueBorder: "#1565c0",
        badgeAmberBg: "#e65100", badgeAmberText: "#ffb74d", badgeAmberBorder: "#ef6c00",
        badgeSlateBg: "#334155", badgeSlateText: "#94a3b8", badgeSlateBorder: "#475569",
        progressBarBg: "#374151", progressBlue: "#3b82f6", progressAmber: "#f59e0b",
        iconBg: "#1e293b", iconColor: "#60a5fa",
        sectionIconBg: "#334155", sectionIconColor: "#e2e8f0",
        skeletonBg: "#374151",
      },
    },
    statusPalette: {
      online: ["#1b5e20", "#4caf50", "#2e7d32"],
      running: ["#0d47a1", "#2196f3", "#1565c0"],
      succeeded: ["#1b5e20", "#4caf50", "#2e7d32"],
      failed: ["#b71c1c", "#f44336", "#c62828"],
      draft: ["#424242", "#9e9e9e", "#616161"],
      waiting: ["#e65100", "#ff9800", "#ef6c00"],
      offline: ["#424242", "#9e9e9e", "#616161"],
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
