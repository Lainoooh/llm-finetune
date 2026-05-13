import { Card } from "./Card";

export function Stat({ title, value, desc, S }) {
  return (
    <Card S={S}>
      <div style={{ color: S.page.background === "#0a0a0a" ? "#9ca3af" : "#64748b", fontSize: 13 }}>{title}</div>
      <div style={{ fontSize: 28, fontWeight: 800, marginTop: 8, color: S.page.color }}>{value}</div>
      <div style={{ color: S.page.background === "#0a0a0a" ? "#9ca3af" : "#64748b", fontSize: 12, marginTop: 4 }}>{desc}</div>
    </Card>
  );
}
