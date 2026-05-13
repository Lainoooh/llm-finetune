import { useState } from "react";

export function Button({ children, secondary, onClick, disabled, S }) {
  const [hover, setHover] = useState(false);

  const getBackground = () => {
    if (disabled) return secondary ? (S.page.background === "#0a0a0a" ? "#252525" : "#fff") : (S.page.background === "#0a0a0a" ? "#667eea" : "#0f172a");
    if (!hover) return secondary ? (S.page.background === "#0a0a0a" ? "#252525" : "#fff") : (S.page.background === "#0a0a0a" ? "#667eea" : "#0f172a");
    // hover 状态
    return secondary ? (S.page.background === "#0a0a0a" ? "#2d2d2d" : "#f8fafc") : (S.page.background === "#0a0a0a" ? "#7c8aed" : "#1e293b");
  };

  return (
    <button
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={() => !disabled && setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        ...S.btn,
        background: getBackground(),
        color: secondary ? S.page.color : "#fff",
        border: secondary ? (S.page.background === "#0a0a0a" ? `1px solid ${S.card.border.split(" ")[2]}` : "1px solid #cbd5e1") : (S.page.background === "#0a0a0a" ? "none" : "1px solid #0f172a"),
        opacity: disabled ? 0.5 : 1,
        transition: "all 0.15s ease",
      }}
    >
      {children}
    </button>
  );
}
