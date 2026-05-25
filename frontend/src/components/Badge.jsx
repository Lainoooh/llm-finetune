import { statusText } from "../styles/themes";

export function Badge({ status, statusPalette }) {
  const [bg, fg, bd] = statusPalette[status] || statusPalette.draft;
  return (
    <span
      style={{
        display: "inline-block",
        background: bg,
        color: fg,
        border: `1px solid ${bd}`,
        borderLeft: `3px solid ${fg}`,
        borderRadius: 5,
        padding: "3px 7px",
        fontSize: 11,
        fontWeight: 700,
        whiteSpace: "nowrap",
      }}
    >
      {statusText[status] || status}
    </span>
  );
}
