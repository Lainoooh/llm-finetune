export function Field({ label, value, onChange, type = "text", S }) {
  return (
    <label style={{ display: "block" }}>
      <div style={{ color: S.page.background === "#1a1a1a" ? "#9ca3af" : "#64748b", fontSize: 12, marginBottom: 6 }}>{label}</div>
      <input type={type} value={value} onChange={onChange} style={S.input} />
    </label>
  );
}
