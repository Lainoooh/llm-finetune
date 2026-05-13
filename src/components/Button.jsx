import { S } from "../styles/styles";

export function Button({ children, secondary, onClick, disabled }) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      style={{
        ...S.btn,
        background: secondary ? "#fff" : "#0f172a",
        color: secondary ? "#334155" : "#fff",
        border: secondary ? "1px solid #cbd5e1" : "1px solid #0f172a",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {children}
    </button>
  );
}
