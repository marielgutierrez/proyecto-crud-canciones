const API_URL = import.meta.env.VITE_API_URL || "";

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, options);
  const contentType = response.headers.get("content-type") || "";
  
  if (!contentType.includes("application/json")) {
    throw new Error("El servidor no devolvió JSON (revisa VITE_API_URL)");
  }

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Request failed");
  }
  return data;
}

export const api = {
  health: () => request("/api/health"),
  list: () => request("/api/songs"),
  create: (formData) => request("/api/songs", { method: "POST", body: formData }),
  update: (id, formData) => request(`/api/songs/${id}`, { method: "PUT", body: formData }),
  remove: (id) => request(`/api/songs/${id}`, { method: "DELETE" }),
};
