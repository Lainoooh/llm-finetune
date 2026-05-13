import { S } from "../styles/styles";

export function Field({ label, value, onChange, type = "text" }) {
  return (
    <label style={{ display: "block" }}>
      <div style={{ color: "#64748b", fontSize: 12, marginBottom: 6 }}>{label}</div>
      <input type={type} value={value} onChange={onChange} style={S.input} />
    </label>
  );
}
