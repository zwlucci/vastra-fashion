import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "../api/client.js";

const AuthContext = createContext(null);

function deviceToken() {
  const storageKey = "vastra_device_token";
  let token = localStorage.getItem(storageKey);
  if (!token) {
    token = crypto.randomUUID ? crypto.randomUUID() : Array.from(crypto.getRandomValues(new Uint8Array(32)), (value) => value.toString(16).padStart(2, "0")).join("");
    localStorage.setItem(storageKey, token);
  }
  return token;
}

function readStoredUser() {
  const raw = localStorage.getItem("vastra_user");
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    localStorage.removeItem("vastra_user");
    localStorage.removeItem("vastra_token");
    return null;
  }
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem("vastra_token"));
  const [user, setUser] = useState(readStoredUser);
  const [loading, setLoading] = useState(Boolean(token));

  const persist = useCallback((nextToken, nextUser) => {
    setToken(nextToken);
    setUser(nextUser);
    if (nextToken) {
      localStorage.setItem("vastra_token", nextToken);
      localStorage.setItem("vastra_user", JSON.stringify(nextUser));
    } else {
      localStorage.removeItem("vastra_token");
      localStorage.removeItem("vastra_user");
    }
  }, []);

  useEffect(() => {
    let active = true;
    async function loadMe() {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const { data } = await api.get("/auth/me");
        if (active) persist(token, data.user);
      } catch {
        if (active) persist(null, null);
      } finally {
        if (active) setLoading(false);
      }
    }
    loadMe();
    return () => {
      active = false;
    };
  }, [persist, token]);

  async function login(payload) {
    const { data } = await api.post("/auth/login", { ...payload, deviceToken: deviceToken() });
    if (data.requiresOtp) return data;
    persist(data.token, data.user);
    return { ...data, requiresOtp: false };
  }

  async function verifyLoginOtp(payload) {
    const { data } = await api.post("/auth/login/verify-otp", { ...payload, deviceToken: deviceToken() });
    persist(data.token, data.user);
    return data;
  }

  async function resendLoginOtp(challengeId) {
    const { data } = await api.post("/auth/login/resend-otp", { challengeId });
    return data;
  }

  async function register(payload) {
    const { data } = await api.post("/auth/register", payload);
    return data;
  }

  async function verifyEmail(payload) {
    const { data } = await api.post("/auth/verify-email", payload);
    return data;
  }

  async function resendVerificationOtp(payload) {
    const { data } = await api.post("/auth/resend-verification-otp", payload);
    return data;
  }

  const refreshMe = useCallback(async () => {
    const activeToken = token || localStorage.getItem("vastra_token");
    if (!activeToken) {
      persist(null, null);
      return null;
    }
    const { data } = await api.get("/auth/me");
    persist(activeToken, data.user);
    return data.user;
  }, [persist, token]);

  useEffect(() => {
    const interceptorId = api.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 403 && error.response?.data?.message === "Insufficient role" && localStorage.getItem("vastra_token")) {
          refreshMe().catch(() => {});
        }
        return Promise.reject(error);
      }
    );
    return () => api.interceptors.response.eject(interceptorId);
  }, [refreshMe]);

  async function updateProfile(payload) {
    await api.patch("/auth/me", payload);
    return refreshMe();
  }

  function logout() {
    persist(null, null);
  }

  const value = useMemo(
    () => ({
      token,
      user,
      loading,
      isAuthenticated: Boolean(user),
      login,
      verifyLoginOtp,
      resendLoginOtp,
      register,
      verifyEmail,
      resendVerificationOtp,
      refreshMe,
      updateProfile,
      logout
    }),
    [token, user, loading, refreshMe]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
