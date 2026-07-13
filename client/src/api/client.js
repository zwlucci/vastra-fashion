import axios from "axios";

const browserHostname = typeof window === "undefined" ? "127.0.0.1" : window.location.hostname;
const apiPort = import.meta.env.VITE_API_PORT || "5000";

function apiBaseUrl() {
  const configuredUrl = import.meta.env.VITE_API_URL?.trim();
  if (!configuredUrl) return `http://${browserHostname}:${apiPort}/api`;

  const url = new URL(configuredUrl);
  const configuredForLoopback = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(url.hostname);
  const browserIsRemote = !["localhost", "127.0.0.1", "::1", "[::1]"].includes(browserHostname);

  if (configuredForLoopback && browserIsRemote) {
    url.hostname = browserHostname;
  }

  return url.toString().replace(/\/$/, "");
}

export const API_BASE_URL = apiBaseUrl();
export const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, "");

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
