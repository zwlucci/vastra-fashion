import { Plus, Tag, Trash2 } from "lucide-react";
import React, { useEffect, useState } from "react";
import { api, getErrorMessage } from "../api/client.js";

export function AdminCouponManager() {
  const [coupons, setCoupons] = useState([]);
  const [form, setForm] = useState({ code: "", discountType: "percentage", discountValue: "", enabled: true });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function loadCoupons() {
    const { data } = await api.get("/admin/coupons");
    setCoupons(data.coupons || []);
  }

  useEffect(() => { loadCoupons().catch((err) => setError(getErrorMessage(err))); }, []);

  async function create(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { data } = await api.post("/admin/coupons", { ...form, code: form.code.trim().toUpperCase(), discountValue: Number(form.discountValue) });
      setCoupons((current) => [data.coupon, ...current]);
      setForm({ code: "", discountType: "percentage", discountValue: "", enabled: true });
    } catch (err) { setError(getErrorMessage(err)); } finally { setBusy(false); }
  }

  async function toggle(coupon) {
    const { data } = await api.patch(`/admin/coupons/${coupon.id}`, { enabled: !coupon.enabled });
    setCoupons((current) => current.map((item) => item.id === coupon.id ? data.coupon : item));
  }

  async function disable(coupon) {
    if (!window.confirm(`Disable coupon ${coupon.code}? Existing orders will keep their discount record.`)) return;
    const { data } = await api.delete(`/admin/coupons/${coupon.id}`);
    setCoupons((current) => current.map((item) => item.id === coupon.id ? data.coupon : item));
  }

  return (
    <section className="panel p-5">
      <div className="mb-5"><p className="text-sm font-bold uppercase tracking-wide text-clay">Promotions</p><h2 className="text-2xl font-black">Coupon management</h2></div>
      {error && <p className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">{error}</p>}
      <form className="grid gap-3 rounded-xl bg-neutral-50 p-4 dark:bg-neutral-900 sm:grid-cols-[1fr_170px_140px_auto]" onSubmit={create}>
        <label className="text-sm font-semibold">Coupon code<input className="mt-1 w-full uppercase" required maxLength={32} value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} placeholder="SUMMER20" /></label>
        <label className="text-sm font-semibold">Discount type<select className="mt-1 w-full" value={form.discountType} onChange={(event) => setForm({ ...form, discountType: event.target.value })}><option value="percentage">Percentage</option><option value="fixed">Fixed NPR</option></select></label>
        <label className="text-sm font-semibold">Value<input className="mt-1 w-full" required min="0.01" max={form.discountType === "percentage" ? 100 : undefined} step="0.01" type="number" value={form.discountValue} onChange={(event) => setForm({ ...form, discountValue: event.target.value })} /></label>
        <button className="btn-primary self-end" disabled={busy} type="submit"><Plus size={16} /> {busy ? "Creating..." : "Create"}</button>
      </form>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {coupons.map((coupon) => <article className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800" key={coupon.id}><div className="flex items-start justify-between gap-3"><div><p className="flex items-center gap-2 font-black"><Tag size={16} className="text-clay" />{coupon.code}</p><p className="mt-1 text-sm text-neutral-500">{coupon.discountType === "percentage" ? `${coupon.discountValue}% off` : `NPR ${coupon.discountValue.toLocaleString()} off`}</p></div><span className={`rounded-full px-2 py-1 text-xs font-bold ${coupon.enabled ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300" : "bg-neutral-100 text-neutral-500 dark:bg-neutral-800"}`}>{coupon.enabled ? "Enabled" : "Disabled"}</span></div><div className="mt-4 flex gap-2"><button className="btn-secondary h-9 flex-1 px-3" onClick={() => toggle(coupon).catch((err) => setError(getErrorMessage(err)))} type="button">{coupon.enabled ? "Disable" : "Enable"}</button><button className="btn-secondary h-9 px-3 text-red-600" disabled={!coupon.enabled} onClick={() => disable(coupon).catch((err) => setError(getErrorMessage(err)))} type="button" title="Safely disable coupon"><Trash2 size={15} /></button></div></article>)}
        {!coupons.length && <p className="py-6 text-sm text-neutral-500">No coupons created yet.</p>}
      </div>
    </section>
  );
}
