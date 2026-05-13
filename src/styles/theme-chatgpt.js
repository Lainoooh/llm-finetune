// 方案 1：ChatGPT 浅色风格（柔和灰色调）
export const S = {
  page: { minHeight: "100vh", background: "#f7f7f8", color: "#2d3748", fontFamily: "Arial, sans-serif" },
  layout: { display: "flex" },
  sidebar: { width: 288, height: "100vh", flexShrink: 0, background: "#fff", borderRight: "1px solid #e5e7eb", padding: 20, boxSizing: "border-box" },
  brand: { background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", color: "#fff", borderRadius: 16, padding: 16, marginBottom: 24 },
  navBtn: { width: "100%", textAlign: "left", border: 0, borderRadius: 10, padding: "10px 12px", marginBottom: 6, cursor: "pointer", fontWeight: 600, transition: "all 0.2s" },
  main: { height: "100vh", overflow: "auto", flex: 1, padding: 28, boxSizing: "border-box" },
  card: { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" },
  row: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" },
  btn: { border: 0, borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontWeight: 600, fontSize: 13, transition: "all 0.2s" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  th: { background: "#f9fafb", color: "#6b7280", textTransform: "uppercase", fontSize: 11, textAlign: "left", padding: "12px 14px", borderBottom: "1px solid #e5e7eb", fontWeight: 600 },
  td: { padding: "12px 14px", borderBottom: "1px solid #f3f4f6", verticalAlign: "middle" },
  input: { width: "100%", boxSizing: "border-box", border: "1px solid #d1d5db", borderRadius: 8, padding: "9px 12px", fontSize: 13, transition: "border 0.2s" },
};

export const statusText = {
  online: "在线",
  running: "训练中",
  succeeded: "成功",
  failed: "失败",
  draft: "草稿",
  waiting: "等待完成",
};

export const statusPalette = {
  online: ["#d1fae5", "#059669", "#a7f3d0"],
  running: ["#dbeafe", "#2563eb", "#bfdbfe"],
  succeeded: ["#d1fae5", "#059669", "#a7f3d0"],
  failed: ["#fee2e2", "#dc2626", "#fecaca"],
  draft: ["#f3f4f6", "#6b7280", "#e5e7eb"],
  waiting: ["#fef3c7", "#d97706", "#fde68a"],
};
