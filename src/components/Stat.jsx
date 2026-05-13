import { Card } from "./Card";

export function Stat({ title, value, desc }) {
  return (
    <Card>
      <div style={{ color: "#64748b", fontSize: 13 }}>{title}</div>
      <div style={{ fontSize: 28, fontWeight: 800, marginTop: 8 }}>{value}</div>
      <div style={{ color: "#64748b", fontSize: 12, marginTop: 4 }}>{desc}</div>
    </Card>
  );
}
