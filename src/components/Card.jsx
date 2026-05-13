import { S } from "../styles/styles";

export function Card({ children, style }) {
  return <section style={{ ...S.card, ...style }}>{children}</section>;
}
