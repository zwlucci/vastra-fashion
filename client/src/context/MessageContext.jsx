import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";
import { api, API_ORIGIN } from "../api/client.js";
import { useAuth } from "./AuthContext.jsx";

const MessageContext = createContext(null);

export function MessageProvider({ children }) {
  const { isAuthenticated, token } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [socket, setSocket] = useState(null);

  const refreshUnreadCount = useCallback(async () => {
    if (!isAuthenticated) {
      setUnreadCount(0);
      return;
    }
    const { data } = await api.get("/messages/unread-count");
    setUnreadCount(data.count || 0);
  }, [isAuthenticated]);

  useEffect(() => {
    refreshUnreadCount().catch(() => setUnreadCount(0));
  }, [refreshUnreadCount]);

  useEffect(() => {
    if (!isAuthenticated || !token) {
      setUnreadCount(0);
      setSocket((current) => {
        current?.disconnect();
        return null;
      });
      return undefined;
    }

    const nextSocket = io(API_ORIGIN, {
      auth: { token },
      transports: ["websocket", "polling"]
    });

    nextSocket.on("unread:updated", ({ count }) => {
      setUnreadCount(count || 0);
    });

    setSocket(nextSocket);

    return () => {
      nextSocket.disconnect();
      setSocket(null);
    };
  }, [isAuthenticated, token]);

  const value = useMemo(() => ({
    unreadCount,
    socket,
    setUnreadCount,
    refreshUnreadCount
  }), [refreshUnreadCount, socket, unreadCount]);

  return <MessageContext.Provider value={value}>{children}</MessageContext.Provider>;
}

export function useMessages() {
  return useContext(MessageContext);
}
