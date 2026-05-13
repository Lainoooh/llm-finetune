// 方案 2：深色模式（类似 ChatGPT Dark）
export const S = {
  page: { minHeight: "100vh", background: "#1a1a1a", color: "#ececec", fontFamily: "Arial, sans-serif" },
  layout: { display: "flex" },
  sidebar: { width: 288, height: "100vh", flexShrink: 0, background: "#202020", borderRight: "1px solid #2d2d2d", padding: 20, boxSizing: "border-box" },
  brand: { background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", color: "#fff", borderRadius: 16, padding: 16, marginBottom: 24 },
  navBtn: { width: "100%", textAlign: "left", border: 0, borderRadius: 10, padding: "10px 12px", marginBottom: 6, cursor: "pointer", fontWeight: 600, transition: "all 0.2s" },
  main: { height: "100vh", overflow: "auto", flex: 1, padding: 28, boxSizing: "border-box" },
  card: { background: "#202020", border: "1px solid #2d2d2d", borderRadius: 16, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.3)" },
  row: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" },
  btn: { border: 0, borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontWeight: 600, fontSize: 13, transition: "all 0.2s" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  th: { background: "#2d2d2d", color: "#9ca3af", textTransform: "uppercase", fontSize: 11, textAlign: "left", padding: "12px 14px", borderBottom: "1px solid #3d3d3d", fontWeight: 600 },
  td: { padding: "12px 14px", borderBottom: "1px solid #2d2d2d", verticalAlign: "middle" },
  input: { width: "100%", boxSizing: "border-box", border: "1px solid #3d3d3d", borderRadius: 8, padding: "9px 12px", fontSize: 13, background: "#2d2d2d", color: "#ececec", transition: "border 0.2s" },
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
  online: ["#064e3b", "#10b981", "#065f46"],
  running: ["#1e3a8a", "#3b82f6", "#1e40af"],
  succeeded: ["#064e3b", "#10b981", "#065f46"],
  failed: ["#7f1d1d", "#ef4444", "#991b1b"],
  draft: ["#374151", "#9ca3af", "#4b5563"],
  waiting: ["#78350f", "#f59e0b", "#92400e"],
};
