export function Field({ label, value, onChange, type = "text", placeholder = "", S, revealable = false, revealed = false, onToggleReveal }) {
  const inputType = revealable ? (revealed ? "text" : "password") : type;
  return (
    <label style={{ display: "block" }}>
      <div style={{ color: S.page.background === "#0a0a0a" ? "#9ca3af" : "#64748b", fontSize: 13, marginBottom: 6 }}>{label}</div>
      <div style={{ position: "relative" }}>
        <input
          type={inputType}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          style={{ ...S.input, paddingRight: revealable ? 44 : S.input.paddingRight }}
        />
        {revealable ? (
          <button
            type="button"
            onClick={onToggleReveal}
            aria-label={revealed ? `隐藏${label}` : `显示${label}`}
            title={revealed ? "隐藏" : "显示"}
            style={{
              position: "absolute",
              right: 10,
              top: "50%",
              transform: "translateY(-50%)",
              border: 0,
              background: "transparent",
              color: S.page.background === "#0a0a0a" ? "#9ca3af" : "#64748b",
              cursor: "pointer",
              padding: 4,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {revealed ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a21.77 21.77 0 0 1 5.06-5.94" />
                <path d="M9.9 4.24A10.45 10.45 0 0 1 12 4c7 0 11 8 11 8a21.78 21.78 0 0 1-2.16 3.19" />
                <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
                <path d="M1 1l22 22" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        ) : null}
      </div>
    </label>
  );
}
