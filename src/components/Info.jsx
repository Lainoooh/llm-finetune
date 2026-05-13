export function Info({ label, value }) {
  return (
    <div style={{ border: "1px solid #e2e8f0", borderRadius: 14, padding: 14, background: "#fff" }}>
      <div style={{ color: "#64748b", fontSize: 12 }}>{label}</div>
      <div style={{ fontWeight: 700, marginTop: 6, wordBreak: "break-all" }}>{value}</div>
    </div>
  );
}
