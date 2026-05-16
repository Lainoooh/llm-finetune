/**
 * API service layer for the BSE Annual Report Inquiry frontend.
 * Wraps all backend REST API calls.
 */

const API_BASE = import.meta.env.VITE_API_BASE || '';

export function getToken() {
  return localStorage.getItem('auth_token') || '';
}

export function setToken(token) {
  if (token) {
    localStorage.setItem('auth_token', token);
  } else {
    localStorage.removeItem('auth_token');
  }
}

function headers() {
  const h = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...headers(), ...(options.headers || {}) },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

// ============================================================
// Auth
// ============================================================

export async function login(username, password) {
  const data = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  setToken(data.token);
  return data;
}

export async function register(username, password, email) {
  return request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, password, email }),
  });
}

export async function getMe() {
  return request('/api/auth/me');
}

export function logout() {
  setToken('');
}

// ============================================================
// Models
// ============================================================

export async function listActiveModels() {
  return request('/api/models/active');
}

export async function listAllModels() {
  return request('/api/models/');
}

export async function createModel(data) {
  return request('/api/models/', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateModel(modelId, data) {
  return request(`/api/models/${modelId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteModel(modelId) {
  return request(`/api/models/${modelId}`, { method: 'DELETE' });
}

export async function listParentModels() {
  return request('/api/models/parents');
}

export async function getModelChildren(parentId) {
  return request(`/api/models/parent/${parentId}/children`);
}

export async function batchSaveModels(data) {
  return request('/api/models/batch', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// ============================================================
// Conversations
// ============================================================

export async function listConversations() {
  return request('/api/conversations/');
}

export async function createConversation(title) {
  return request('/api/conversations/', {
    method: 'POST',
    body: JSON.stringify({ title }),
  });
}

export async function deleteConversation(convId) {
  return request(`/api/conversations/${convId}`, { method: 'DELETE' });
}

export async function listMessages(convId) {
  return request(`/api/conversations/${convId}/messages`);
}

export async function sendMessage(convId, { role, content, type, task_id, metadata }) {
  return request(`/api/conversations/${convId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ role, content, type, task_id, metadata }),
  });
}

// ============================================================
// Tasks
// ============================================================

export async function listTasks(convId) {
  return request(`/api/conversations/${convId}/tasks`);
}

export async function createTask(convId, { company_name, report_year, model_id, metrics_json }) {
  return request(`/api/conversations/${convId}/tasks`, {
    method: 'POST',
    body: JSON.stringify({ company_name, report_year, model_id, metrics_json }),
  });
}

export async function getTask(taskId) {
  return request(`/api/tasks/${taskId}`);
}

export async function deleteTask(taskId) {
  return request(`/api/tasks/${taskId}`, { method: 'DELETE' });
}

export async function uploadReport(taskId, file) {
  const formData = new FormData();
  formData.append('file', file);
  const token = getToken();
  const authHeaders = {};
  if (token) authHeaders['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}/api/tasks/${taskId}/upload`, {
    method: 'POST',
    headers: authHeaders,
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

/**
 * Upload a PDF file temporarily (before task creation).
 * Uses XMLHttpRequest for real upload progress tracking.
 * @param {File} file
 * @param {(progress: number) => void} onProgress - 0~100
 * @returns {Promise<{temp_file_id, file_name, file_path, file_size}>}
 */
export function uploadTemp(file, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE}/api/upload-temp`);
    const token = getToken();
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    xhr.upload.onprogress = (evt) => {
      if (evt.lengthComputable && onProgress) {
        onProgress(Math.min(Math.round((evt.loaded / evt.total) * 95), 95));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try { resolve(JSON.parse(xhr.responseText)); }
        catch { reject(new Error('Invalid JSON response')); }
      } else {
        try {
          const err = JSON.parse(xhr.responseText);
          reject(new Error(err.detail || `HTTP ${xhr.status}`));
        } catch { reject(new Error(`HTTP ${xhr.status}`)); }
      }
    };
    xhr.onerror = () => reject(new Error('Network error'));
    xhr.onabort = () => reject(new Error('Upload aborted'));

    const formData = new FormData();
    formData.append('file', file);
    xhr.send(formData);
  });
}

export async function linkTempFile(taskId, tempFileId, fileName) {
  return request(`/api/tasks/${taskId}/link-temp-file`, {
    method: 'POST',
    body: JSON.stringify({ temp_file_id: tempFileId, file_name: fileName }),
  });
}

// ============================================================
// Workflow
// ============================================================

export async function startWorkflow(taskId) {
  return request(`/api/tasks/${taskId}/start`, { method: 'POST' });
}

export async function cancelWorkflow(taskId) {
  return request(`/api/tasks/${taskId}/cancel`, { method: 'POST' });
}

export async function getWorkflowStatus(taskId) {
  return request(`/api/tasks/${taskId}/workflow`);
}

export async function resumeWorkflow(taskId, { step_index, decision, confirmed_ids, rejected_ids, modified_data }) {
  return request(`/api/tasks/${taskId}/resume`, {
    method: 'POST',
    body: JSON.stringify({ step_index, decision, confirmed_ids, rejected_ids, modified_data }),
  });
}

export async function getStepData(taskId, stepIndex) {
  return request(`/api/tasks/${taskId}/steps/${stepIndex}/data`);
}

// ============================================================
// Risk Signals
// ============================================================

export async function getTaskSignals(taskId) {
  return request(`/api/tasks/${taskId}/signals`);
}

export async function updateSignal(taskId, signalId, { is_triggered }) {
  return request(`/api/tasks/${taskId}/signals/${signalId}`, {
    method: 'PUT',
    body: JSON.stringify({ is_triggered }),
  });
}

export async function batchUpdateSignals(taskId, { triggered_ids }) {
  return request(`/api/tasks/${taskId}/signals/batch-update`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(triggered_ids),
  });
}

// ============================================================
// Inquiry Letter
// ============================================================

export async function getInquiryLetter(taskId) {
  return request(`/api/tasks/${taskId}/inquiry-letter`);
}

// ============================================================
// Indicators
// ============================================================

export async function getTaskIndicators(taskId) {
  return request(`/api/tasks/${taskId}/indicators`);
}

export async function listIndicatorDefinitions() {
  return request('/api/indicators');
}

// ============================================================
// RDU Risk Definitions
// ============================================================

export async function listRduRisks(params = {}) {
  const qs = new URLSearchParams();
  if (params.category_id) qs.set('category_id', params.category_id);
  if (params.keyword) qs.set('keyword', params.keyword);
  const q = qs.toString();
  return request(`/api/rdu-risks${q ? '?' + q : ''}`);
}

export async function createRduRisk(data) {
  return request('/api/rdu-risks', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateRduRisk(signalId, data) {
  return request(`/api/rdu-risks/${signalId}`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function deleteRduRisk(signalId) {
  return request(`/api/rdu-risks/${signalId}`, { method: 'DELETE' });
}

// ============================================================
// RDU Metrics (Standard)
// ============================================================

export async function listRduMetrics(params = {}) {
  const qs = new URLSearchParams();
  if (params.category_id) qs.set('category_id', params.category_id);
  if (params.keyword) qs.set('keyword', params.keyword);
  const q = qs.toString();
  return request(`/api/rdu/metrics${q ? '?' + q : ''}`);
}

export async function createRduMetric(data) {
  return request('/api/rdu/metrics', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateRduMetric(metricId, data) {
  return request(`/api/rdu/metrics/${metricId}`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function deleteRduMetric(metricId) {
  return request(`/api/rdu/metrics/${metricId}`, { method: 'DELETE' });
}

// ============================================================
// Categories
// ============================================================

export async function listCategories(params = {}) {
  const qs = new URLSearchParams();
  if (params.tree) qs.set('tree', '1');
  if (params.level !== undefined) qs.set('level', params.level);
  if (params.parent_id) qs.set('parent_id', params.parent_id);
  const q = qs.toString();
  return request(`/api/categories${q ? '?' + q : ''}`);
}

export async function createCategory(data) {
  return request('/api/categories', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateCategory(catId, data) {
  return request(`/api/categories/${catId}`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function deleteCategory(catId) {
  return request(`/api/categories/${catId}`, { method: 'DELETE' });
}
