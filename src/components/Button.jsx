export function Button({ children, secondary, onClick, disabled, S }) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      style={{
        ...S.btn,
        background: secondary ? (S.page.background === "#0a0a0a" ? "#252525" : "#fff") : (S.page.background === "#0a0a0a" ? "#667eea" : "#0f172a"),
        color: secondary ? S.page.color : "#fff",
        border: secondary ? (S.page.background === "#0a0a0a" ? `1px solid ${S.card.border.split(" ")[2]}` : "1px solid #cbd5e1") : (S.page.background === "#0a0a0a" ? "none" : "1px solid #0f172a"),
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {children}
    </button>
  );
}
