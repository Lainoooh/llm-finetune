export function Metric({ label, value, wide }) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
        height: 28,
        minWidth: wide ? 110 : 50,
        border: "1px solid #e2e8f0",
        borderRadius: 8,
        background: "#f8fafc",
        padding: "0 6px",
      }}
    >
      <span style={{ color: "#94a3b8", fontSize: 10, fontWeight: 800 }}>{label}</span>
      <span style={{ fontWeight: 800, fontSize: 12, maxWidth: wide ? 80 : 40, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</span>
    </div>
  );
}
