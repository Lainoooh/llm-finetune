import { S } from "../styles/styles";

export function SectionTitle({ title, desc, actions }) {
  return (
    <div style={{ ...S.row, marginBottom: 16 }}>
      <div>
        <div style={{ fontWeight: 800 }}>{title}</div>
        {desc ? <div style={{ color: "#64748b", fontSize: 13, marginTop: 4 }}>{desc}</div> : null}
      </div>
      {actions ? <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{actions}</div> : null}
    </div>
  );
}
