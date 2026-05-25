export function SyncStatusPanel({ datasets, onEdit, onPreview, onSync, theme }) {
  if (!datasets || Object.keys(datasets).length === 0) {
    return (
      <div style={{ padding: 16, textAlign: "center", color: theme === "dark" ? "#64748b" : "#94a3b8", fontSize: 13 }}>
        暂无数据集，请先上传文件
      </div>
    );
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case "synced":
        return "✅";
      case "syncing":
        return "🔄";
      case "error":
        return "❌";
      default:
        return "⚠️";
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case "synced":
        return "已同步";
      case "syncing":
        return "同步中";
      case "error":
        return "同步失败";
      default:
        return "未同步";
    }
  };

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: theme === "dark" ? "#e2e8f0" : "#1e293b" }}>
        数据集列表
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {Object.entries(datasets).map(([name, config]) => {
          const status = config.syncStatus || "unsynced";
          const isDisabled = status === "syncing";

          return (
            <div
              key={name}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 16px",
                background: theme === "dark" ? "#1e293b" : "#f8fafc",
                border: `1px solid ${theme === "dark" ? "#334155" : "#e2e8f0"}`,
                borderRadius: 8,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1 }}>
                <span style={{ fontSize: 16 }}>{getStatusIcon(status)}</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: theme === "dark" ? "#e2e8f0" : "#1e293b" }}>
                    {name}
                  </div>
                  <div style={{ fontSize: 12, color: theme === "dark" ? "#64748b" : "#94a3b8" }}>
                    {config.file_name} · {getStatusText(status)}
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => onEdit(name, config)}
                  disabled={isDisabled}
                  style={{
                    padding: "6px 12px",
                    background: "transparent",
                    color: theme === "dark" ? "#94a3b8" : "#64748b",
                    border: `1px solid ${theme === "dark" ? "#334155" : "#e2e8f0"}`,
                    borderRadius: 6,
                    fontSize: 12,
                    cursor: isDisabled ? "not-allowed" : "pointer",
                    opacity: isDisabled ? 0.5 : 1,
                  }}
                >
                  编辑
                </button>
                <button
                  onClick={() => onPreview(name)}
                  disabled={isDisabled}
                  style={{
                    padding: "6px 12px",
                    background: "transparent",
                    color: theme === "dark" ? "#94a3b8" : "#64748b",
                    border: `1px solid ${theme === "dark" ? "#334155" : "#e2e8f0"}`,
                    borderRadius: 6,
                    fontSize: 12,
                    cursor: isDisabled ? "not-allowed" : "pointer",
                    opacity: isDisabled ? 0.5 : 1,
                  }}
                >
                  预览
                </button>
                <button
                  onClick={() => onSync(name)}
                  disabled={isDisabled}
                  style={{
                    padding: "6px 12px",
                    background: status === "synced" ? "transparent" : "#667eea",
                    color: status === "synced" ? (theme === "dark" ? "#94a3b8" : "#64748b") : "#fff",
                    border: status === "synced" ? `1px solid ${theme === "dark" ? "#334155" : "#e2e8f0"}` : "none",
                    borderRadius: 6,
                    fontSize: 12,
                    cursor: isDisabled ? "not-allowed" : "pointer",
                    opacity: isDisabled ? 0.5 : 1,
                  }}
                >
                  {status === "syncing" ? "同步中..." : "同步"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
