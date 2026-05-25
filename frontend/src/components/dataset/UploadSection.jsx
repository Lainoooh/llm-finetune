import { useState, useRef } from "react";
import { uploadFile } from "../../api/datasets";

export function UploadSection({ subtaskCode, onUploadComplete, theme }) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef();

  const handleFiles = async (files) => {
    if (!files.length || uploading) return;

    for (const file of files) {
      setUploading(true);
      setProgress({ name: file.name, percent: 0 });

      try {
        await uploadFile(subtaskCode, file, {
          onProgress: (percent) => setProgress({ name: file.name, percent }),
        });
        onUploadComplete?.();
      } catch (err) {
        console.error("Upload failed:", err);
        alert(`上传失败: ${err.message}`);
      } finally {
        setUploading(false);
        setProgress(null);
      }
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(Array.from(e.dataTransfer.files));
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => setDragOver(false);

  const handleFileSelect = (e) => {
    handleFiles(Array.from(e.target.files));
    e.target.value = "";
  };

  const bg = theme === "dark" ? "#1e293b" : "#f8fafc";
  const border = theme === "dark" ? "#334155" : "#e2e8f0";
  const borderColor = dragOver ? "#667eea" : border;

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: theme === "dark" ? "#e2e8f0" : "#1e293b" }}>
        上传数据集文件
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          style={{
            padding: "8px 16px",
            background: "#667eea",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 500,
            cursor: uploading ? "not-allowed" : "pointer",
            opacity: uploading ? 0.6 : 1,
          }}
        >
          本地文件上传
        </button>
        <button
          disabled
          style={{
            padding: "8px 16px",
            background: theme === "dark" ? "#334155" : "#e2e8f0",
            color: theme === "dark" ? "#64748b" : "#94a3b8",
            border: "none",
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 500,
            cursor: "not-allowed",
          }}
          title="训练样本库开发中"
        >
          训练样本库 🔒
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".json,.jsonl,.csv,.parquet"
          onChange={handleFileSelect}
          style={{ display: "none" }}
        />
      </div>

      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        style={{
          padding: 24,
          border: `2px dashed ${borderColor}`,
          borderRadius: 8,
          background: dragOver ? (theme === "dark" ? "#1e293b80" : "#f1f5f980") : bg,
          textAlign: "center",
          transition: "all 0.2s",
        }}
      >
        <div style={{ fontSize: 13, color: theme === "dark" ? "#94a3b8" : "#64748b" }}>
          {uploading && progress ? (
            <>
              <div style={{ marginBottom: 8 }}>正在上传 {progress.name}...</div>
              <div style={{ width: "100%", height: 6, background: border, borderRadius: 3, overflow: "hidden" }}>
                <div
                  style={{
                    width: `${progress.percent}%`,
                    height: "100%",
                    background: "#667eea",
                    transition: "width 0.2s",
                  }}
                />
              </div>
              <div style={{ marginTop: 4, fontSize: 12 }}>{Math.round(progress.percent)}%</div>
            </>
          ) : (
            <>拖拽文件到此处，或点击上方按钮选择文件</>
          )}
        </div>
      </div>

      <div style={{ marginTop: 8, fontSize: 12, color: theme === "dark" ? "#64748b" : "#94a3b8" }}>
        支持格式: .json, .jsonl, .csv, .parquet
      </div>
    </div>
  );
}
