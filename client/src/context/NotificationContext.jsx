import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client.js";
import { useAuth } from "./AuthContext.jsx";
import { useMessages } from "./MessageContext.jsx";

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const { socket } = useMessages();
  const [notice, setNotice] = useState(null);
  const [orderNotifications, setOrderNotifications] = useState([]);
  const [unreadOrderCount, setUnreadOrderCount] = useState(0);
  const [notificationsLoading, setNotificationsLoading] = useState(false);

  function showNotice(message, tone = "warning", action = null) {
    setNotice({ message, tone, action });
    window.clearTimeout(showNotice.timer);
    showNotice.timer = window.setTimeout(() => setNotice(null), action ? 7000 : 3200);
  }

  const refreshOrderNotifications = useCallback(async () => {
    if (!isAuthenticated) {
      setOrderNotifications([]);
      setUnreadOrderCount(0);
      return;
    }
    setNotificationsLoading(true);
    try {
      const { data } = await api.get("/order-notifications");
      setOrderNotifications(data.notifications || []);
      setUnreadOrderCount(data.unreadCount || 0);
    } finally {
      setNotificationsLoading(false);
    }
  }, [isAuthenticated]);

  const markOrderNotificationRead = useCallback(async (id) => {
    const { data } = await api.patch(`/order-notifications/${id}/read`);
    setOrderNotifications((current) => current.map((item) => item.id === id ? data.notification : item));
    setUnreadOrderCount((current) => Math.max(0, current - 1));
  }, []);

  const markAllOrderNotificationsRead = useCallback(async () => {
    await api.patch("/order-notifications/read-all");
    setOrderNotifications((current) => current.map((item) => ({ ...item, read: true })));
    setUnreadOrderCount(0);
  }, []);

  useEffect(() => {
    refreshOrderNotifications().catch(() => {});
  }, [refreshOrderNotifications]);

  useEffect(() => {
    if (!socket) return undefined;
    const handleNew = ({ notification, count }) => {
      setOrderNotifications((current) => [notification, ...current.filter((item) => item.id !== notification.id)].slice(0, 40));
      setUnreadOrderCount(count || 0);
    };
    const handleCount = ({ count }) => setUnreadOrderCount(count || 0);
    socket.on("order-notification:new", handleNew);
    socket.on("order-notifications:updated", handleCount);
    return () => {
      socket.off("order-notification:new", handleNew);
      socket.off("order-notifications:updated", handleCount);
    };
  }, [socket]);

  const value = useMemo(() => ({
    showNotice,
    orderNotifications,
    unreadOrderCount,
    notificationsLoading,
    refreshOrderNotifications,
    markOrderNotificationRead,
    markAllOrderNotificationsRead
  }), [markAllOrderNotificationsRead, markOrderNotificationRead, notificationsLoading, orderNotifications, refreshOrderNotifications, unreadOrderCount]);

  return (
    <NotificationContext.Provider value={value}>
      {children}
      {notice && (
        <div className="fixed right-4 top-20 z-50 max-w-sm rounded-lg border border-neutral-200 bg-white p-4 text-sm font-semibold shadow-soft dark:border-neutral-800 dark:bg-neutral-900" role="dialog" aria-live="polite">
          <p className={notice.tone === "error" ? "text-red-600" : "text-clay"}>{notice.message}</p>
          {notice.action && <Link className="btn-primary mt-3" to={notice.action.to} onClick={() => setNotice(null)}>{notice.action.label}</Link>}
        </div>
      )}
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  return useContext(NotificationContext);
}
