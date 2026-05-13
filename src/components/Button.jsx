export function Button({ children, secondary, onClick, disabled, S }) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      style={{
        ...S.btn,
        background: secondary ? (S.page.background === "#0a0a0a" ? "#252525" : "#fff") : (S.page.background === "#0a0a0a" ? "#667eea" : "#667eea"),
        color: secondary ? S.page.color : "#fff",
        border: secondary ? `1px solid ${S.card.border.split(" ")[2]}` : "none",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {children}
    </button>
  );
}
