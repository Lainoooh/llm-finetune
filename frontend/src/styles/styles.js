export const S = {
  page: { minHeight: "100vh", background: "#f1f5f9", color: "#0f172a", fontFamily: "Arial, sans-serif" },
  layout: { display: "flex" },
  sidebar: { width: 288, height: "100vh", flexShrink: 0, background: "#fff", borderRight: "1px solid #e2e8f0", padding: 20, boxSizing: "border-box" },
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
  online: ["#ecfdf5", "#047857", "#a7f3d0"],
  running: ["#eef2ff", "#4338ca", "#c7d2fe"],
  succeeded: ["#ecfdf5", "#047857", "#a7f3d0"],
  failed: ["#fff1f2", "#be123c", "#fecdd3"],
  draft: ["#f8fafc", "#475569", "#e2e8f0"],
  waiting: ["#fffbeb", "#b45309", "#fde68a"],
};
