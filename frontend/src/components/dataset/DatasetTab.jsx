import { useState, useEffect } from "react";
import { UploadSection } from "./UploadSection";
import { SyncStatusPanel } from "./SyncStatusPanel";
import { DatasetSelector } from "./DatasetSelector";
import { DatasetPreviewModal } from "./DatasetPreviewModal";
import { DatasetConfigForm } from "./DatasetConfigForm";
import { fetchDatasets, syncDataset, syncAllDatasets } from "../../api/datasets";

export function DatasetTab({ subtaskCode, theme }) {
  const [datasets, setDatasets] = useState({});
  const [loading, setLoading] = useState(true);
  const [trainDataset, setTrainDataset] = useState("");
  const [evalDataset, setEvalDataset] = useState("");
  const [previewDataset, setPreviewDataset] = useState(null);
  const [editingDataset, setEditingDataset] = useState(null);
  const [syncing, setSyncing] = useState({});

  useEffect(() => {
    loadDatasets();
  }, []);

  const loadDatasets = async () => {
    try {
      const result = await fetchDatasets(subtaskCode);
      setDatasets(result.datasets || {});
      
      // Auto-select first dataset for train/eval if not set
      const keys = Object.keys(result.datasets || {});
      if (keys.length > 0) {
        if (!trainDataset && keys.includes("train_data")) setTrainDataset("train_data");
        else if (!trainDataset && keys.length > 0) setTrainDataset(keys[0]);
        
        if (!evalDataset && keys.includes("eval_data")) setEvalDataset("eval_data");
        else if (!evalDataset && keys.length > 1) setEvalDataset(keys[1]);
      }
    } catch (err) {
      console.error("Failed to load datasets:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleUploadComplete = () => {
    loadDatasets();
  };

  const handleSync = async (name) => {
    setSyncing((prev) => ({ ...prev, [name]: true }));
    try {
      await syncDataset(subtaskCode, name);
      await loadDatasets();
    } catch (err) {
      console.error("Sync failed:", err);
      alert(`同步失败: ${err.message}`);
    } finally {
      setSyncing((prev) => ({ ...prev, [name]: false }));
    }
  };

  const handleSyncAll = async () => {
    setSyncing({ all: true });
    try {
      await syncAllDatasets(subtaskCode);
      await loadDatasets();
    } catch (err) {
      console.error("Sync all failed:", err);
      alert(`同步失败: ${err.message}`);
    } finally {
      setSyncing({});
    }
  };

  const handleEdit = (name, config) => {
    setEditingDataset({ name, config });
  };

  const handlePreview = (name) => {
    setPreviewDataset(name);
  };

  const handleConfigSaved = () => {
    setEditingDataset(null);
    loadDatasets();
  };

  const bg = theme === "dark" ? "#0f172a" : "#fff";
  const border = theme === "dark" ? "#334155" : "#e2e8f0";
  const text = theme === "dark" ? "#e2e8f0" : "#1e293b";
  const label = theme === "dark" ? "#94a3b8" : "#64748b";

  if (loading) {
    return <div style={{ padding: 24, textAlign: "center", color: label }}>加载中...</div>;
  }

  return (
    <div style={{ padding: 24 }}>
      {/* 上传区域 */}
      <UploadSection subtaskCode={subtaskCode} onUploadComplete={handleUploadComplete} theme={theme} />

      {/* 同步状态面板 */}
      <SyncStatusPanel
        datasets={datasets}
        syncing={syncing}
        onEdit={handleEdit}
        onPreview={handlePreview}
        onSync={handleSync}
        onSyncAll={handleSyncAll}
        theme={theme}
      />

      {/* 数据集选择器 */}
      {Object.keys(datasets).length > 0 && (
        <div style={{ marginTop: 32, padding: 20, background: bg, border: `1px solid ${border}`, borderRadius: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: text }}>
            数据集配置
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6, color: label }}>
                训练集
              </label>
              <DatasetSelector
                datasets={datasets}
                value={trainDataset}
                onChange={setTrainDataset}
                placeholder="选择训练数据集"
                theme={theme}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6, color: label }}>
                评测集
              </label>
              <DatasetSelector
                datasets={datasets}
                value={evalDataset}
                onChange={setEvalDataset}
                placeholder="选择评测数据集"
                theme={theme}
              />
            </div>
          </div>
        </div>
      )}

      {/* 预览弹窗 */}
      {previewDataset && (
        <DatasetPreviewModal
          subtaskCode={subtaskCode}
          datasetName={previewDataset}
          onClose={() => setPreviewDataset(null)}
          theme={theme}
        />
      )}

      {/* 编辑配置弹窗 */}
      {editingDataset && (
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
          onClick={() => setEditingDataset(null)}
        >
          <div
            style={{
              background: bg,
              borderRadius: 12,
              width: "90%",
              maxWidth: 600,
              maxHeight: "80vh",
              overflow: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <DatasetConfigForm
              subtaskCode={subtaskCode}
              datasetName={editingDataset.name}
              config={editingDataset.config}
              onClose={() => setEditingDataset(null)}
              onSaved={handleConfigSaved}
              theme={theme}
            />
          </div>
        </div>
      )}
    </div>
  );
}
