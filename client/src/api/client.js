import axios from "axios";

function apiBaseUrl() {
  const configuredUrl = import.meta.env.VITE_API_URL?.trim();
  if (!configuredUrl) return "/api";

  const url = new URL(configuredUrl);
  const configuredForLoopback = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(url.hostname);
  const browserHostname = typeof window === "undefined" ? "127.0.0.1" : window.location.hostname;
  const browserIsRemote = !["localhost", "127.0.0.1", "::1", "[::1]"].includes(browserHostname);

  if (configuredForLoopback && browserIsRemote) {
    // A remote device's loopback address is not this computer. Vite proxies the
    // API, uploads, and Socket.IO through the frontend's same origin instead.
    return "/api";
  }

  return url.toString().replace(/\/$/, "");
}

export const API_BASE_URL = apiBaseUrl();
export const API_ORIGIN = API_BASE_URL.startsWith("/")
  ? (typeof window === "undefined" ? "" : window.location.origin)
  : API_BASE_URL.replace(/\/api\/?$/, "");

export const api = axios.create({
  baseURL: API_BASE_URL
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("vastra_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export function getErrorMessage(error) {
  return error.response?.data?.message || error.message || "Something went wrong";
}

export function resolveImageUrl(url) {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:")) {
    return url;
  }
  return `${API_ORIGIN}${url.startsWith("/") ? url : `/${url}`}`;
}

export function avatarUrl(user) {
  return user?.profileImageUrl ? resolveImageUrl(user.profileImageUrl) : "";
}
