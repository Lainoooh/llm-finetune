export function Card({ children, style, S }) {
  return <section style={{ ...S.card, ...style }}>{children}</section>;
}
