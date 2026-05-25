import { request } from "./client";

export async function getDashboardSummary() {
  return request("/dashboard/summary");
}

export async function getLossMetrics(taskCode = "") {
  const search = taskCode ? `?taskCode=${encodeURIComponent(taskCode)}` : "";
  return request(`/metrics/loss${search}`);
}
