import { useState, useEffect } from "react";
import { fetchPreview } from "../../api/datasets";

export function DatasetPreviewModal({ subtaskCode, datasetName, onClose, theme }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [jumpPage, setJumpPage] = useState("");
  const [error, setError] = useState(null);

  useEffect(() => {
    loadData();
  }, [page]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchPreview(subtaskCode, datasetName, page, 10);
      setData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleJump = () => {
    const p = parseInt(jumpPage);
    if (p >= 1 && data && p <= Math.ceil(data.total / data.size)) {
      setPage(p);
      setJumpPage("");
    }
  };

  const bg = theme === "dark" ? "#0f172a" : "#fff";
  const border = theme === "dark" ? "#334155" : "#e2e8f0";
  const text = theme === "dark" ? "#e2e8f0" : "#1e293b";
  const label = theme === "dark" ? "#94a3b8" : "#64748b";

  const totalPages = data ? Math.ceil(data.total / data.size) : 0;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: bg,
          borderRadius: 12,
          width: "90%",
          maxWidth: 1200,
          height: "80vh",
          display: "flex",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 左侧面板 */}
        <div
          style={{
            width: 280,
            borderRight: `1px solid ${border}`,
            padding: 20,
            overflowY: "auto",
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: text }}>
            数据集预览
          </div>
          <div style={{ fontSize: 13, color: label, marginBottom: 8 }}>
            数据集: <span style={{ color: text, fontWeight: 500 }}>{datasetName}</span>
          </div>
          {data && (
            <>
              <div style={{ fontSize: 13, color: label, marginBottom: 8 }}>
                格式: <span style={{ color: text }}>{data.formatting}</span>
              </div>
              <div style={{ fontSize: 13, color: label, marginBottom: 8 }}>
                总行数: <span style={{ color: text }}>{data.total.toLocaleString()}</span>
              </div>
              <div style={{ fontSize: 13, color: label, marginBottom: 16 }}>
                文件大小: <span style={{ color: text }}>{(data.fileSize / 1024 / 1024).toFixed(2)} MB</span>
              </div>

              {data.columns && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: label }}>
                    列映射
                  </div>
                  {Object.entries(data.columns).map(([key, value]) => (
                    <div key={key} style={{ fontSize: 12, color: label, marginBottom: 4 }}>
                      {key}: <span style={{ color: text }}>{value}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* 右侧内容 */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div
            style={{
              padding: "16px 20px",
              borderBottom: `1px solid ${border}`,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 600, color: text }}>
              数据预览 {data && `(第 ${page} / ${totalPages} 页)`}
            </div>
            <button
              onClick={onClose}
              style={{
                background: "transparent",
                border: "none",
                fontSize: 20,
                color: label,
                cursor: "pointer",
              }}
            >
              ✕
            </button>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
            {loading && (
              <div style={{ textAlign: "center", padding: 40, color: label }}>加载中...</div>
            )}
            {error && (
              <div style={{ textAlign: "center", padding: 40, color: "#ef4444" }}>{error}</div>
            )}
            {data && !loading && !error && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {data.items.map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: 16,
                      background: theme === "dark" ? "#1e293b" : "#f8fafc",
                      borderRadius: 8,
                      border: `1px solid ${border}`,
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: label }}>
                      #{item.index || (page - 1) * data.size + idx + 1}
                    </div>
                    {Object.entries(item)
                      .filter(([key]) => key !== "index")
                      .map(([key, value]) => (
                        <div key={key} style={{ marginBottom: 8 }}>
                          <div style={{ fontSize: 12, fontWeight: 500, color: label, marginBottom: 2 }}>
                            {key}
                          </div>
                          <div
                            style={{
                              fontSize: 13,
                              color: text,
                              whiteSpace: "pre-wrap",
                              wordBreak: "break-word",
                              lineHeight: 1.5,
                            }}
                          >
                            {typeof value === "string" ? value : JSON.stringify(value, null, 2)}
                          </div>
                        </div>
                      ))}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 分页 */}
          {data && totalPages > 0 && (
            <div
              style={{
                padding: "12px 20px",
                borderTop: `1px solid ${border}`,
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                gap: 12,
              }}
            >
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                style={{
                  padding: "6px 12px",
                  background: "transparent",
                  border: `1px solid ${border}`,
                  borderRadius: 6,
                  fontSize: 13,
                  color: page === 1 ? label : text,
                  cursor: page === 1 ? "not-allowed" : "pointer",
                }}
              >
                上一页
              </button>
              <span style={{ fontSize: 13, color: label }}>
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                style={{
                  padding: "6px 12px",
                  background: "transparent",
                  border: `1px solid ${border}`,
                  borderRadius: 6,
                  fontSize: 13,
                  color: page === totalPages ? label : text,
                  cursor: page === totalPages ? "not-allowed" : "pointer",
                }}
              >
                下一页
              </button>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: 16 }}>
                <span style={{ fontSize: 13, color: label }}>跳转到</span>
                <input
                  value={jumpPage}
                  onChange={(e) => setJumpPage(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleJump()}
                  style={{
                    width: 60,
                    padding: "6px 8px",
                    border: `1px solid ${border}`,
                    borderRadius: 6,
                    fontSize: 13,
                    textAlign: "center",
                    background: bg,
                    color: text,
                  }}
                />
                <button
                  onClick={handleJump}
                  style={{
                    padding: "6px 12px",
                    background: "#667eea",
                    border: "none",
                    borderRadius: 6,
                    fontSize: 13,
                    color: "#fff",
                    cursor: "pointer",
                  }}
                >
                  GO
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
