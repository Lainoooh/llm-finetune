import { useState } from "react";
import { updateDatasetConfig, syncDataset } from "../../api/datasets";

const FORMATS = [
  { value: "alpaca", label: "Alpaca" },
  { value: "sharegpt", label: "ShareGPT" },
];

const DEFAULT_COLUMNS = {
  alpaca: { prompt: "instruction", query: "input", response: "output" },
  sharegpt: { role_tag: "role", content_tag: "content", user_tag: "user", assistant_tag: "assistant" },
};

export function DatasetConfigForm({ subtaskCode, datasetName, config, onClose, onSaved, theme }) {
  const [formatting, setFormatting] = useState(config?.formatting || "alpaca");
  const [fileName, setFileName] = useState(config?.file_name || "");
  const [columns, setColumns] = useState(config?.columns || config?.tags || DEFAULT_COLUMNS.alpaca);
  const [saving, setSaving] = useState(false);

  const handleFormatChange = (fmt) => {
    setFormatting(fmt);
    setColumns(DEFAULT_COLUMNS[fmt] || {});
  };

  const handleColumnChange = (key, value) => {
    setColumns((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        file_name: fileName,
        formatting,
        ...(formatting === "alpaca" ? { columns } : { tags: columns }),
      };
      await updateDatasetConfig(subtaskCode, datasetName, payload);
      await syncDataset(subtaskCode, datasetName);
      onSaved?.();
    } catch (err) {
      console.error("Save failed:", err);
      alert(`保存失败: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const bg = theme === "dark" ? "#1e293b" : "#fff";
  const border = theme === "dark" ? "#334155" : "#e2e8f0";
  const text = theme === "dark" ? "#e2e8f0" : "#1e293b";
  const label = theme === "dark" ? "#94a3b8" : "#64748b";

  const columnFields =
    formatting === "alpaca"
      ? [
          { key: "prompt", label: "Prompt 列" },
          { key: "query", label: "Query 列" },
          { key: "response", label: "Response 列" },
        ]
      : [
          { key: "role_tag", label: "Role 标签" },
          { key: "content_tag", label: "Content 标签" },
          { key: "user_tag", label: "User 标签" },
          { key: "assistant_tag", label: "Assistant 标签" },
        ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, color: text }}>
        编辑数据集配置: {datasetName}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* 文件名 */}
        <div>
          <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6, color: label }}>
            文件名
          </label>
          <input
            value={fileName}
            onChange={(e) => setFileName(e.target.value)}
            style={{
              width: "100%",
              padding: "8px 12px",
              border: `1px solid ${border}`,
              borderRadius: 6,
              fontSize: 13,
              background: bg,
              color: text,
            }}
          />
        </div>

        {/* 格式 */}
        <div>
          <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6, color: label }}>
            格式
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            {FORMATS.map((fmt) => (
              <button
                key={fmt.value}
                onClick={() => handleFormatChange(fmt.value)}
                style={{
                  padding: "8px 16px",
                  border: `1px solid ${formatting === fmt.value ? "#667eea" : border}`,
                  borderRadius: 6,
                  background: formatting === fmt.value ? "#667eea10" : "transparent",
                  color: formatting === fmt.value ? "#667eea" : text,
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                {fmt.label}
              </button>
            ))}
          </div>
        </div>

        {/* 列映射 */}
        <div>
          <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6, color: label }}>
            {formatting === "alpaca" ? "列映射" : "Tags 配置"}
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
            {columnFields.map((field) => (
              <div key={field.key}>
                <div style={{ fontSize: 12, marginBottom: 4, color: label }}>{field.label}</div>
                <input
                  value={columns[field.key] || ""}
                  onChange={(e) => handleColumnChange(field.key, e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    border: `1px solid ${border}`,
                    borderRadius: 6,
                    fontSize: 13,
                    background: bg,
                    color: text,
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 24 }}>
        <button
          onClick={onClose}
          style={{
            padding: "8px 16px",
            background: "transparent",
            color: label,
            border: `1px solid ${border}`,
            borderRadius: 6,
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          取消
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            padding: "8px 16px",
            background: "#667eea",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 500,
            cursor: saving ? "not-allowed" : "pointer",
            opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? "保存中..." : "保存并同步"}
        </button>
      </div>
    </div>
  );
}
