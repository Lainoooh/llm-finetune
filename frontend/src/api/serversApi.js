import { request } from "./client";

function normalizeServerPayload(payload) {
  const accessType = payload.accessType || "jupyter";
  const base = {
    ...payload,
    accessType,
    sshPort: Number(payload.sshPort || 22),
  };
  if (accessType === "jupyter") {
    return {
      ...base,
      host: "",
      user: "",
      password: "",
      sshPort: 22,
      sshKey: "",
      jupyterBaseUrl: payload.jupyterBaseUrl || "",
      token: payload.token || "",
    };
  }
  return {
    ...base,
    jupyterBaseUrl: "",
    token: "",
  };
}

export async function listServers(params = {}) {
  const search = new URLSearchParams();
  if (params.keyword) search.set("keyword", params.keyword);
  if (params.status && params.status !== "all") search.set("status", params.status);
  const data = await request(`/servers${search.toString() ? `?${search}` : ""}`);
  return data.items || [];
}

export async function createServer(payload) {
  return request("/servers", {
    method: "POST",
    body: JSON.stringify(normalizeServerPayload(payload)),
  });
}

export async function updateServer(serverId, payload) {
  return request(`/servers/${encodeURIComponent(serverId)}`, {
    method: "PATCH",
    body: JSON.stringify(normalizeServerPayload(payload)),
  });
}

export async function deleteServer(serverId) {
  return request(`/servers/${encodeURIComponent(serverId)}`, {
    method: "DELETE",
  });
}

export async function probeServer(serverId) {
  return request(`/servers/${encodeURIComponent(serverId)}/probe`, {
    method: "POST",
  });
}

export async function probeDraftServer(draft) {
  return request("/servers/probe-draft", {
    method: "POST",
    body: JSON.stringify(normalizeServerPayload(draft)),
  });
}

export async function getProbeTask(probeCode) {
  return request(`/servers/probes/${encodeURIComponent(probeCode)}`);
}
