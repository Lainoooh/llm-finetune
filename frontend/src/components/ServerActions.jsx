import Spinner from "./Spinner";

function ActionButton({ onClick, disabled, title, danger, S, children }) {
  const baseColor = S.page.background === "#0a0a0a" ? "#9ca3af" : "#6B7280";
  const hoverBg = danger
    ? (S.page.background === "#0a0a0a" ? "#2d2d2d" : "#FEF2F2")
    : (S.page.background === "#0a0a0a" ? "#2d2d2d" : "#F9FAFB");
  const hoverColor = danger
    ? "#EF4444"
    : (S.page.background === "#0a0a0a" ? "#e5e7eb" : "#004EA2");

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        border: 0,
        background: "transparent",
        cursor: disabled ? "not-allowed" : "pointer",
        padding: 6,
        borderRadius: 6,
        color: baseColor,
        transition: "all 0.2s",
        opacity: disabled ? 0.5 : 1,
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.currentTarget.style.background = hoverBg;
          e.currentTarget.style.color = hoverColor;
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled) {
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.color = baseColor;
        }
      }}
      title={title}
    >
      {children}
    </button>
  );
}

export function ServerActions({ serverId, testing, onTest, onClone, onEdit, onDelete, S }) {
  return (
    <div style={{ display: "flex", gap: 8 }}>
      {/* 连通性检查 */}
      <ActionButton
        onClick={() => onTest(serverId)}
        disabled={testing}
        title="连通性检查"
        S={S}
      >
        {testing ? (
          <Spinner size="small" />
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
        )}
      </ActionButton>

      {/* 复制 */}
      <ActionButton onClick={() => onClone(serverId)} title="复制服务器" S={S}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      </ActionButton>

      {/* 编辑 */}
      <ActionButton onClick={() => onEdit(serverId)} title="编辑" S={S}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
      </ActionButton>

      {/* 删除 */}
      <ActionButton onClick={() => onDelete(serverId)} title="删除" danger S={S}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          <line x1="10" y1="11" x2="10" y2="17" />
          <line x1="14" y1="11" x2="14" y2="17" />
        </svg>
      </ActionButton>
    </div>
  );
}
