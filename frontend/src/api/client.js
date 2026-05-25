export async function request(path, options = {}) {
  const headers = {
    ...(options.body instanceof FormData ? {} : { "content-type": "application/json" }),
    ...(options.headers || {}),
  };
  const response = await fetch(`/api${path}`, {
    headers,
    ...options,
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message = data?.detail || data?.message || `HTTP ${response.status}`;
    throw new Error(typeof message === "string" ? message : JSON.stringify(message));
  }
  return data;
}
