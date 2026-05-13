import { useState } from "react";

export function ThemeSwitcher({ currentTheme, onThemeChange, themes, S }) {
  const [open, setOpen] = useState(false);

  const themeIcons = {
    light: "☀️",
    dark: "🌙",
  };

  return (
    <div style={{ marginTop: "auto", position: "relative" }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "12px 14px",
          border: "1px solid",
          borderColor: S.sidebar.background === "#fff" ? "#e5e7eb" : "#2d2d2d",
          borderRadius: 12,
          background: S.sidebar.background === "#fff" ? "#f9fafb" : "#2d2d2d",
          cursor: "pointer",
          transition: "all 0.2s",
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 16,
          }}
        >
          {themeIcons[currentTheme]}
        </div>
        <div style={{ flex: 1, textAlign: "left" }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: S.page.color }}>主题设置</div>
          <div style={{ fontSize: 11, color: S.sidebar.background === "#fff" ? "#9ca3af" : "#6b7280", marginTop: 2 }}>
            {themes[currentTheme].name}
          </div>
        </div>
        <div style={{ fontSize: 12, color: S.sidebar.background === "#fff" ? "#9ca3af" : "#6b7280" }}>
          {open ? "▲" : "▼"}
        </div>
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            bottom: "100%",
            left: 0,
            right: 0,
            marginBottom: 8,
            background: S.sidebar.background === "#fff" ? "#fff" : "#2d2d2d",
            border: "1px solid",
            borderColor: S.sidebar.background === "#fff" ? "#e5e7eb" : "#3d3d3d",
            borderRadius: 12,
            padding: 8,
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            zIndex: 100,
          }}
        >
          <div style={{ fontSize: 11, color: S.sidebar.background === "#fff" ? "#6b7280" : "#9ca3af", padding: "8px 12px", fontWeight: 600 }}>
            选择主题
          </div>
          {Object.entries(themes).map(([key, config]) => (
            <button
              key={key}
              onClick={() => {
                onThemeChange(key);
                setOpen(false);
              }}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 12px",
                border: 0,
                borderRadius: 8,
                background: currentTheme === key ? (S.sidebar.background === "#fff" ? "#f3f4f6" : "#374151") : "transparent",
                cursor: "pointer",
                transition: "all 0.2s",
                marginBottom: 4,
              }}
              onMouseEnter={(e) => {
                if (currentTheme !== key) {
                  e.currentTarget.style.background = S.sidebar.background === "#fff" ? "#f9fafb" : "#2d2d2d";
                }
              }}
              onMouseLeave={(e) => {
                if (currentTheme !== key) {
                  e.currentTarget.style.background = "transparent";
                }
              }}
            >
              <div style={{ fontSize: 20 }}>{themeIcons[key]}</div>
              <div style={{ flex: 1, textAlign: "left" }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: S.page.color }}>{config.name}</div>
              </div>
              {currentTheme === key && (
                <div style={{ fontSize: 16, color: "#667eea" }}>✓</div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
