import React from "react";

export default function Spinner({ size = "medium", color }) {
  const sizes = {
    small: 16,
    medium: 24,
    large: 32
  };

  const dimension = sizes[size] || sizes.medium;

  return (
    <div
      style={{
        width: dimension,
        height: dimension,
        border: `${Math.max(2, dimension / 8)}px solid ${color || "#e5e7eb"}`,
        borderTopColor: color || "#667eea",
        borderRadius: "50%",
        animation: "spin 0.8s linear infinite",
        display: "inline-block"
      }}
    >
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
