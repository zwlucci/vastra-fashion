import { ArrowRight, X } from "lucide-react";
import React, { useState } from "react";

export function StatusConfirmModal({ change, onCancel, onConfirm }) {
  const [saving, setSaving] = useState(false);
  if (!change) return null;

  async function confirm() {
    setSaving(true);
    try {
      await onConfirm(change);
      onCancel();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm" onPointerDown={(event) => event.target === event.currentTarget && !saving && onCancel()}>
      <div aria-labelledby="status-confirm-title" aria-modal="true" className="panel w-full max-w-md space-y-5 shadow-2xl" role="dialog" onPointerDown={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div><p className="text-sm font-bold uppercase tracking-wide text-clay">Confirm delivery update</p><h2 className="mt-1 text-2xl font-black" id="status-confirm-title">Change order status?</h2></div>
          <button aria-label="Close" className="btn-secondary h-9 w-9 px-0" disabled={saving} onClick={onCancel} type="button"><X size={16} /></button>
        </div>
        <p className="text-sm text-neutral-500">Order #{change.orderId.slice(0, 8)}</p>
        <div className="flex items-center justify-center gap-3 rounded-lg bg-neutral-100 p-4 font-bold capitalize dark:bg-neutral-950">
          <span>{change.from}</span><ArrowRight className="text-clay" size={18} /><span>{change.to}</span>
        </div>
        <div className="flex justify-end gap-3">
          <button className="btn-secondary" disabled={saving} onClick={onCancel} type="button">Cancel</button>
          <button className="btn-primary" disabled={saving} onClick={confirm} type="button">{saving ? "Updating..." : "Confirm update"}</button>
        </div>
      </div>
    </div>
  );
}
