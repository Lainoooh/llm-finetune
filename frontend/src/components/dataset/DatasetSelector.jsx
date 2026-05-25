import { useState, useRef, useEffect } from "react";

export function DatasetSelector({ datasets, value, onChange, placeholder, theme }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();

  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const options = Object.keys(datasets || {});
  const selected = value || placeholder || "选择数据集";

  const bg = theme === "dark" ? "#1e293b" : "#fff";
  const border = theme === "dark" ? "#334155" : "#e2e8f0";
  const text = theme === "dark" ? "#e2e8f0" : "#1e293b";
  const label = theme === "dark" ? "#94a3b8" : "#64748b";

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: "100%",
          padding: "8px 12px",
          border: `1px solid ${border}`,
          borderRadius: 6,
          background: bg,
          color: value ? text : label,
          fontSize: 13,
          textAlign: "left",
          cursor: "pointer",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span>{selected}</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && options.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            background: bg,
            border: `1px solid ${border}`,
            borderRadius: 6,
            boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
            zIndex: 10,
            maxHeight: 200,
            overflowY: "auto",
          }}
        >
          {options.map((opt) => (
            <div
              key={opt}
              onClick={() => {
                onChange(opt);
                setOpen(false);
              }}
              style={{
                padding: "8px 12px",
                fontSize: 13,
                color: text,
                cursor: "pointer",
                background: opt === value ? "#667eea10" : "transparent",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#667eea20";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = opt === value ? "#667eea10" : "transparent";
              }}
            >
              {opt}
            </div>
          ))}
        </div>
      )}

      {open && options.length === 0 && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            background: bg,
            border: `1px solid ${border}`,
            borderRadius: 6,
            padding: "12px",
            fontSize: 13,
            color: label,
            textAlign: "center",
          }}
        >
          暂无数据集
        </div>
      )}
    </div>
  );
}
