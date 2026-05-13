export function Button({ children, secondary, onClick, disabled, S }) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      style={{
        ...S.btn,
        background: secondary ? (S.page.background === "#1a1a1a" ? "#2d2d2d" : "#fff") : (S.page.background === "#1a1a1a" ? "#667eea" : (S.page.background === "#f0f9ff" ? "#0ea5e9" : "#10a37f")),
        color: secondary ? S.page.color : "#fff",
        border: secondary ? `1px solid ${S.card.border.split(" ")[2]}` : "none",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {children}
    </button>
  );
}
