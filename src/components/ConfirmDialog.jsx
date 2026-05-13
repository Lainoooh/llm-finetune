import { Button } from "./Button";

export function ConfirmDialog({ open, title, message, onConfirm, onCancel, confirmText = "确定", cancelText = "取消", danger = false, S }) {
  if (!open) return null;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, zIndex: 100 }}>
      <div style={{ background: S.card.background, borderRadius: 20, padding: 24, width: "min(480px, 100%)", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.3)" }}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: S.page.color, marginBottom: 8 }}>
            {title}
          </div>
          <div style={{ fontSize: 14, color: S.page.background === "#0a0a0a" ? "#9ca3af" : "#64748b", lineHeight: 1.6 }}>
            {message}
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 24 }}>
          <Button secondary onClick={onCancel} S={S}>
            {cancelText}
          </Button>
          <button
            onClick={onConfirm}
            style={{
              ...S.btn,
              background: danger ? "#EF4444" : (S.page.background === "#0a0a0a" ? "#667eea" : "#0f172a"),
              color: "#fff",
              fontWeight: 600,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = danger ? "#DC2626" : (S.page.background === "#0a0a0a" ? "#5568d3" : "#1e293b");
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = danger ? "#EF4444" : (S.page.background === "#0a0a0a" ? "#667eea" : "#0f172a");
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
