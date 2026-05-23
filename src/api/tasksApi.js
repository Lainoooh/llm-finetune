import { request } from "./client";

export async function listTasks(params = {}) {
  const search = new URLSearchParams();
  if (params.keyword) search.set("keyword", params.keyword);
  if (params.status && params.status !== "all") search.set("status", params.status);
  const data = await request(`/tasks${search.toString() ? `?${search}` : ""}`);
  return data.items || [];
}

export async function createTask(payload) {
  return request("/tasks", { method: "POST", body: JSON.stringify(payload) });
}

export async function updateTask(taskCode, payload) {
  return request(`/tasks/${encodeURIComponent(taskCode)}`, { method: "PATCH", body: JSON.stringify(payload) });
}

export async function cloneTask(taskCode, payload = { copySubtasks: true }) {
  return request(`/tasks/${encodeURIComponent(taskCode)}/clone`, { method: "POST", body: JSON.stringify(payload) });
}

export async function deleteTask(taskCode) {
  return request(`/tasks/${encodeURIComponent(taskCode)}`, { method: "DELETE" });
}

export async function getTask(taskCode) {
  return request(`/tasks/${encodeURIComponent(taskCode)}`);
}

export async function listSubtasks(taskCode) {
  const data = await request(`/tasks/${encodeURIComponent(taskCode)}/subtasks`);
  return data.items || [];
}

export async function createSubtask(taskCode, payload) {
  return request(`/tasks/${encodeURIComponent(taskCode)}/subtasks`, { method: "POST", body: JSON.stringify(payload) });
}

export async function updateSubtask(subtaskCode, payload) {
  return request(`/subtasks/${encodeURIComponent(subtaskCode)}`, { method: "PATCH", body: JSON.stringify(payload) });
}

export async function cloneSubtask(subtaskCode) {
  return request(`/subtasks/${encodeURIComponent(subtaskCode)}/clone`, { method: "POST" });
}

export async function deleteSubtask(subtaskCode) {
  return request(`/subtasks/${encodeURIComponent(subtaskCode)}`, { method: "DELETE" });
}

export async function startTask(taskCode) {
  return request(`/tasks/${encodeURIComponent(taskCode)}/start`, { method: "POST" });
}

export async function startSubtask(subtaskCode) {
  return request(`/subtasks/${encodeURIComponent(subtaskCode)}/start`, { method: "POST" });
}

export async function stopSubtask(subtaskCode) {
  return request(`/subtasks/${encodeURIComponent(subtaskCode)}/stop`, { method: "POST" });
}

export async function syncSubtask(subtaskCode) {
  return request(`/subtasks/${encodeURIComponent(subtaskCode)}/sync`, { method: "POST" });
}

export async function evaluateSubtask(subtaskCode) {
  return request(`/subtasks/${encodeURIComponent(subtaskCode)}/evaluate`, { method: "POST" });
}

export async function getSubtaskLogs(subtaskCode, offset = 0) {
  return request(`/subtasks/${encodeURIComponent(subtaskCode)}/logs?offset=${offset}&limit=500`);
}

export async function getRemoteFiles(subtaskCode) {
  return request(`/subtasks/${encodeURIComponent(subtaskCode)}/remote-files`);
}

export async function compareReadiness(taskCode) {
  return request(`/tasks/${encodeURIComponent(taskCode)}/compare-readiness`);
}

export async function compareEval(taskCode) {
  return request(`/tasks/${encodeURIComponent(taskCode)}/compare/eval`);
}

export async function runCompare(taskCode) {
  return request(`/tasks/${encodeURIComponent(taskCode)}/compare/run`, { method: "POST" });
}
