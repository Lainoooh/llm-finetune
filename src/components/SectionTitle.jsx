export function SectionTitle({ title, desc, actions, S }) {
  return (
    <div style={{ ...S.row, marginBottom: 16 }}>
      <div>
        <div style={{ fontWeight: 800, color: S.page.color }}>{title}</div>
        {desc ? <div style={{ color: S.page.background === "#0a0a0a" ? "#9ca3af" : "#64748b", fontSize: 13, marginTop: 4 }}>{desc}</div> : null}
      </div>
      {actions ? <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{actions}</div> : null}
    </div>
  );
}
