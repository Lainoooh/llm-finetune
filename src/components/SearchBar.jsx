export function SearchBar({ value, onChange, placeholder, S, onClear }) {
  const handleClear = () => {
    if (onClear) {
      onClear();
    } else {
      onChange({ target: { value: '' } });
    }
  };

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <div style={{
        position: 'absolute',
        left: 12,
        top: '50%',
        transform: 'translateY(-50%)',
        pointerEvents: 'none',
        color: S.page.background === "#0a0a0a" ? "#6b7280" : "#94a3b8",
        display: 'flex',
        alignItems: 'center',
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
      </div>

      <input
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder || "搜索..."}
        style={{
          ...S.input,
          width: '100%',
          fontSize: 14,
          paddingLeft: 40,
          paddingRight: value ? 40 : 12,
          transition: 'all 0.2s',
          border: `1px solid ${S.page.background === "#0a0a0a" ? "#374151" : "#e2e8f0"}`,
        }}
        onFocus={(e) => {
          e.target.style.borderColor = '#667eea';
          e.target.style.boxShadow = S.page.background === "#0a0a0a"
            ? '0 0 0 3px rgba(102, 126, 234, 0.1)'
            : '0 0 0 3px rgba(102, 126, 234, 0.1)';
        }}
        onBlur={(e) => {
          e.target.style.borderColor = S.page.background === "#0a0a0a" ? "#374151" : "#e2e8f0";
          e.target.style.boxShadow = 'none';
        }}
      />

      {value && (
        <button
          onClick={handleClear}
          style={{
            position: 'absolute',
            right: 12,
            top: '50%',
            transform: 'translateY(-50%)',
            border: 0,
            background: 'transparent',
            cursor: 'pointer',
            padding: 4,
            borderRadius: 4,
            color: S.page.background === "#0a0a0a" ? "#6b7280" : "#94a3b8",
            display: 'flex',
            alignItems: 'center',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = S.page.background === "#0a0a0a" ? "#374151" : "#f1f5f9";
            e.currentTarget.style.color = S.page.background === "#0a0a0a" ? "#9ca3af" : "#64748b";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = S.page.background === "#0a0a0a" ? "#6b7280" : "#94a3b8";
          }}
          title="清除搜索"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="m15 9-6 6" />
            <path d="m9 9 6 6" />
          </svg>
        </button>
      )}
    </div>
  );
}
