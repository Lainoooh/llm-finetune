import { useState } from "react";

export function Button({ children, secondary, onClick, disabled, S }) {
  const [hover, setHover] = useState(false);

  const isLight = S.page.background === "#F8F9FA";

  const getStyle = () => {
    if (secondary) {
      // 次要按钮
      if (disabled) {
        return {
          background: isLight ? "#F3F4F6" : "#252525",
          color: isLight ? "#9CA3AF" : "#6B7280",
          border: isLight ? "1px solid #E5E7EB" : "1px solid #3a3a3a",
        };
      }
      if (hover) {
        return {
          background: isLight ? "#F3F4F6" : "#2d2d2d",
          color: isLight ? "#111827" : "#f3f4f6",
          border: isLight ? "1px solid #D1D5DB" : "1px solid #3a3a3a",
        };
      }
      return {
        background: isLight ? "#FFFFFF" : "#252525",
        color: S.page.color,
        border: isLight ? "1px solid #D1D5DB" : "1px solid #3a3a3a",
      };
    } else {
      // 主按钮
      if (disabled) {
        return {
          background: isLight ? "#9CA3AF" : "#4B5563",
          color: "#FFFFFF",
          border: "none",
        };
      }
      if (hover) {
        return {
          background: isLight ? S.btnPrimaryHover.background : S.btnPrimaryHover.background,
          color: "#FFFFFF",
          border: "none",
        };
      }
      return {
        background: isLight ? S.btnPrimary.background : S.btnPrimary.background,
        color: "#FFFFFF",
        border: "none",
      };
    }
  };

  return (
    <button
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={() => !disabled && setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        ...S.btn,
        ...getStyle(),
        opacity: disabled ? 0.6 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      {children}
    </button>
  );
}
