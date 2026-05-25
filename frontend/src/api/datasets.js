const BASE = "/api/datasets";

export async function fetchDatasets(subtaskCode) {
  const res = await fetch(`${BASE}/subtasks/${subtaskCode}`);
  if (!res.ok) throw new Error((await res.json()).detail || "获取数据集列表失败");
  return res.json();
}

export async function uploadFile(subtaskCode, file, { filename, overwrite = true } = {}) {
  const form = new FormData();
  form.append("file", file);
  const params = new URLSearchParams();
  if (filename) params.set("filename", filename);
  params.set("overwrite", String(overwrite));
  const res = await fetch(`${BASE}/subtasks/${subtaskCode}/upload?${params}`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) throw new Error((await res.json()).detail || "上传失败");
  return res.json();
}

export async function updateDatasetConfig(subtaskCode, datasetName, config) {
  const res = await fetch(`${BASE}/subtasks/${subtaskCode}/${datasetName}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
  if (!res.ok) throw new Error((await res.json()).detail || "更新配置失败");
  return res.json();
}

export async function syncDataset(subtaskCode, datasetName) {
  const res = await fetch(`${BASE}/subtasks/${subtaskCode}/${datasetName}/sync`, {
    method: "POST",
  });
  if (!res.ok) throw new Error((await res.json()).detail || "同步失败");
  return res.json();
}

export async function syncAllDatasets(subtaskCode) {
  const res = await fetch(`${BASE}/subtasks/${subtaskCode}/sync`, {
    method: "POST",
  });
  if (!res.ok) throw new Error((await res.json()).detail || "同步失败");
  return res.json();
}

export async function fetchPreview(subtaskCode, datasetName, page = 1, size = 10) {
  const res = await fetch(
    `${BASE}/subtasks/${subtaskCode}/${datasetName}/preview?page=${page}&size=${size}`
  );
  if (!res.ok) throw new Error((await res.json()).detail || "获取预览失败");
  return res.json();
}

export function createUploadWs(subtaskCode) {
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  return new WebSocket(`${proto}//${location.host}/api/datasets/ws/upload/${subtaskCode}`);
}
