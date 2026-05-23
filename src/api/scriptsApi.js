import { request } from "./client";

export async function listScripts() {
  return request("/scripts");
}

export async function createScript(payload) {
  return request("/scripts", { method: "POST", body: JSON.stringify(payload) });
}

export async function renderScript(scriptKey, params = {}) {
  return request(`/scripts/${encodeURIComponent(scriptKey)}/render`, {
    method: "POST",
    body: JSON.stringify({ params }),
  });
}

export async function testScript(scriptKey, payload) {
  return request(`/scripts/${encodeURIComponent(scriptKey)}/test-run`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
