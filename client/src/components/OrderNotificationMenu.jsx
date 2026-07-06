import { Bell, CheckCheck, Package } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useNotification } from "../context/NotificationContext.jsx";
import { notificationTarget } from "../utils/notificationTarget.js";

export function OrderNotificationMenu() {
  const { isAuthenticated, user } = useAuth();
  const { orderNotifications, unreadOrderCount, notificationsLoading, markOrderNotificationRead, markAllOrderNotificationsRead } = useNotification();
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const closeOutside = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [open]);

  if (!isAuthenticated) return null;

  return (
    <div className="relative" ref={rootRef}>
      <button className="btn-secondary relative h-10 w-10 px-0" onClick={() => setOpen((value) => !value)} type="button" title="Order notifications" aria-expanded={open} aria-label="Order notifications">
        <Bell size={18} />
        {unreadOrderCount > 0 && <span className="absolute -right-1 -top-1 rounded-full bg-clay px-1.5 text-xs font-bold text-white">{unreadOrderCount > 99 ? "99+" : unreadOrderCount}</span>}
      </button>
      {open && (
        <div className="absolute right-0 top-12 z-40 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-2xl dark:border-neutral-800 dark:bg-neutral-950">
          <div className="flex items-center justify-between border-b border-neutral-200 p-3 dark:border-neutral-800"><div><p className="font-black">Order updates</p><p className="text-xs text-neutral-500">Purchases, status changes and returns</p></div>{unreadOrderCount > 0 && <button className="text-xs font-bold text-clay hover:underline" onClick={() => markAllOrderNotificationsRead().catch(() => {})} type="button"><CheckCheck className="mr-1 inline" size={14} />Read all</button>}</div>
          <div className="max-h-96 overflow-y-auto">
            {notificationsLoading && !orderNotifications.length ? <p className="p-5 text-sm text-neutral-500">Loading updates...</p> : orderNotifications.length ? orderNotifications.map((item) => (
              <Link className={`block border-b border-neutral-100 p-3 last:border-0 hover:bg-neutral-50 dark:border-neutral-900 dark:hover:bg-neutral-900 ${item.read ? "" : "bg-clay/5"}`} key={item.id} to={notificationTarget(item, user?.role)} onClick={() => { setOpen(false); if (!item.read) markOrderNotificationRead(item.id).catch(() => {}); }}>
                <div className="flex gap-3"><span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-clay/10 text-clay"><Package size={16} /></span><div className="min-w-0"><div className="flex items-start justify-between gap-2"><p className="text-sm font-bold">{item.title}</p>{!item.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-clay" />}</div><p className="mt-1 text-xs leading-5 text-neutral-500">{item.message}</p><p className="mt-1 text-[11px] text-neutral-400">{new Date(item.createdAt).toLocaleString()}</p></div></div>
              </Link>
            )) : <p className="p-5 text-center text-sm text-neutral-500">No order updates yet.</p>}
          </div>
          <Link className="block border-t border-neutral-200 p-3 text-center text-sm font-bold text-clay dark:border-neutral-800" to={user?.role === "vendor" ? "/vendor/dashboard/orders" : "/orders"} onClick={() => setOpen(false)}>View all orders</Link>
        </div>
      )}
    </div>
  );
}
