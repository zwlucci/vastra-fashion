import React, { createContext, useContext, useMemo, useState } from "react";
import { Link } from "react-router-dom";

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const [notice, setNotice] = useState(null);

  function showNotice(message, tone = "warning", action = null) {
    setNotice({ message, tone, action });
    window.clearTimeout(showNotice.timer);
    showNotice.timer = window.setTimeout(() => setNotice(null), action ? 7000 : 3200);
  }

  const value = useMemo(() => ({ showNotice }), []);

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
