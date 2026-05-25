// 方案 3：清新蓝绿风格（现代感）
export const S = {
  page: { minHeight: "100vh", background: "#f0f9ff", color: "#1e293b", fontFamily: "Arial, sans-serif" },
  layout: { display: "flex" },
  sidebar: { width: 288, height: "100vh", flexShrink: 0, background: "#fff", borderRight: "1px solid #e0f2fe", padding: 20, boxSizing: "border-box" },
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
  online: ["#ccfbf1", "#0d9488", "#99f6e4"],
  running: ["#dbeafe", "#0284c7", "#bae6fd"],
  succeeded: ["#ccfbf1", "#0d9488", "#99f6e4"],
  failed: ["#fee2e2", "#dc2626", "#fecaca"],
  draft: ["#f1f5f9", "#64748b", "#e2e8f0"],
  waiting: ["#fef3c7", "#d97706", "#fde68a"],
};
