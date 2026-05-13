import { statusText, statusPalette } from "../styles/styles";

export function Badge({ status }) {
  const [bg, fg, bd] = statusPalette[status] || statusPalette.draft;
  return (
    <span
      style={{
        display: "inline-block",
        background: bg,
        color: fg,
        border: `1px solid ${bd}`,
        borderLeft: `4px solid ${fg}`,
        borderRadius: 6,
        padding: "5px 9px",
        fontSize: 12,
        fontWeight: 700,
        whiteSpace: "nowrap",
      }}
    >
      {statusText[status] || status}
    </span>
  );
}
