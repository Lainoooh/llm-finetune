export function Header({ S }) {
  return (
    <div style={{
      height: 56,
      background: S.page.background === "#F8F9FA" ? "rgba(255, 255, 255, 0.8)" : "rgba(26, 26, 26, 0.8)",
      backdropFilter: "blur(12px)",
      display: 'flex',
      alignItems: 'center',
      padding: '0 24px',
      zIndex: 30,
      justifyContent: 'space-between',
      borderBottom: `1px solid ${S.page.background === "#F8F9FA" ? "#e5e7eb" : "#2a2a2a"}`,
      position: 'sticky',
      top: 0,
      boxShadow: S.page.background === "#F8F9FA" ? "0 1px 2px rgba(0,0,0,0.05)" : "0 1px 2px rgba(0,0,0,0.3)"
    }}>
      <div style={{
        fontSize: 16,
        fontWeight: 700,
        color: S.page.color,
        letterSpacing: '0.3px'
      }}>
        模型微调管理
      </div>
    </div>
  );
}
