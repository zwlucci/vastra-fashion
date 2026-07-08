import React, { useEffect, useState } from "react";
import { Check, Eye, X } from "lucide-react";
import { DashboardDetailModal } from "./DashboardDetailModal.jsx";
import { ProductMedia } from "./ProductMedia.jsx";
import { money, statusClass } from "../utils/format.js";

function mediaGroups(product) {
  const media = product?.productMedia?.length ? product.productMedia : product?.productImages || [];
  if (!media.length && product?.imageUrl) return [{ color: "Default", items: [{ url: product.imageUrl, type: "image" }] }];
  const groups = new Map();
  media.forEach((item) => { const color = item.color || "Default"; if (!groups.has(color)) groups.set(color, []); if (item.url) groups.get(color).push({ ...item, type: item.type || "image" }); });
  return [...groups].map(([color, items]) => ({ color, items }));
}

export function AdminProductApprovalTable({ products, onApprove, onReject }) {
  const [selected, setSelected] = useState(null);
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [saving, setSaving] = useState("");
  const [reason, setReason] = useState("");
  const [page, setPage] = useState(1);
  const pending = products.filter((product) => product.status === "pending");
  const pages = Math.max(1, Math.ceil(pending.length / 10));
  const visible = pending.slice((page - 1) * 10, page * 10);
  useEffect(() => { if (page > pages) setPage(pages); }, [page, pages]);

  function open(product) { setSelected(product); setSelectedMedia(product.productMedia?.[0] || { url: product.imageUrl, type: "image" }); setReason(""); }
  async function decide(action, product, rejectionReason = "") {
    if (action === "reject" && rejectionReason.trim().length < 5) return;
    setSaving(action);
    try { action === "approve" ? await onApprove(product.id) : await onReject(product.id, rejectionReason.trim()); setSelected(null); setReason(""); } finally { setSaving(""); }
  }
  function quickReject(product) { const value = window.prompt("Share a clear rejection reason for the vendor:"); if (value) decide("reject", product, value); }

  if (!pending.length) return <div className="panel py-8 text-center text-neutral-500">No pending products.</div>;
  return <>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {visible.map((product) => <article className="panel flex min-w-0 flex-col overflow-hidden p-0" key={product.id}>
        <button className="bg-neutral-100 dark:bg-neutral-950" onClick={() => open(product)} type="button"><ProductMedia className="aspect-[4/3] w-full object-contain" media={product.productMedia?.[0] || { url: product.imageUrl, type: "image" }} alt={product.name} /></button>
        <div className="flex flex-1 flex-col p-4"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><h3 className="truncate text-lg font-black">{product.name}</h3><p className="truncate text-sm text-neutral-500">{product.vendorName || product.vendorBrandName || product.brand || "Vendor"}</p></div><span className={`badge shrink-0 ${statusClass(product.status)}`}>{product.status}</span></div><div className="mt-3 grid grid-cols-2 gap-2 text-sm"><p><span className="text-neutral-500">Category</span><br /><strong>{product.category}</strong></p><p><span className="text-neutral-500">Price</span><br /><strong>{money(product.price)}</strong></p><p className="col-span-2"><span className="text-neutral-500">Submitted</span><br /><strong>{new Date(product.createdAt).toLocaleDateString()}</strong></p></div><div className="mt-auto flex flex-wrap gap-2 pt-4"><button className="btn-secondary flex-1 px-3" onClick={() => open(product)} type="button"><Eye size={16} /> View details</button><button aria-label={`Approve ${product.name}`} className="btn-primary h-10 w-10 px-0" disabled={Boolean(saving)} onClick={() => decide("approve", product)} type="button"><Check size={16} /></button><button aria-label={`Reject ${product.name}`} className="btn-secondary h-10 w-10 px-0 text-red-600" disabled={Boolean(saving)} onClick={() => quickReject(product)} type="button"><X size={16} /></button></div></div>
      </article>)}
    </div>
    {pages > 1 && <div className="mt-5 flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-neutral-500">Page {page} of {pages} · {pending.length} products</p><div className="flex gap-2"><button className="btn-secondary" disabled={page <= 1} onClick={() => setPage(page - 1)} type="button">Previous</button><button className="btn-secondary" disabled={page >= pages} onClick={() => setPage(page + 1)} type="button">Next</button></div></div>}
    <DashboardDetailModal open={Boolean(selected)} onClose={() => setSelected(null)} eyebrow="Product approval" title={selected?.name || "Product"} footer={selected && <div className="flex flex-wrap justify-end gap-2"><button className="btn-primary" disabled={Boolean(saving)} onClick={() => decide("approve", selected)} type="button"><Check size={16} /> Approve</button><button className="btn-secondary text-red-600" disabled={Boolean(saving) || reason.trim().length < 5} onClick={() => decide("reject", selected, reason)} type="button"><X size={16} /> Reject</button></div>}>
      {selected && <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="space-y-4"><ProductMedia className="aspect-[4/5] w-full rounded-lg bg-neutral-100 object-contain dark:bg-neutral-950" media={selectedMedia} alt={selected.name} controls />{mediaGroups(selected).map((group) => <div key={group.color}><p className="mb-2 text-xs font-bold uppercase tracking-wide text-neutral-500">{group.color}</p><div className="grid grid-cols-4 gap-2">{group.items.map((item, index) => <button className={`overflow-hidden rounded-md border ${selectedMedia?.url === item.url ? "border-clay" : "border-transparent"}`} onClick={() => setSelectedMedia(item)} type="button" key={`${item.url}-${index}`}><ProductMedia className="aspect-square w-full object-cover" media={item} alt="Product media" /></button>)}</div></div>)}</div>
        <div className="space-y-5"><div><div className="flex flex-wrap items-center gap-3"><p className="text-2xl font-black">{money(selected.price)}</p><span className={`badge ${statusClass(selected.status)}`}>{selected.status}</span></div><p className="mt-2 text-sm text-neutral-500">Submitted by <strong className="text-current">{selected.vendorName || selected.vendorBrandName || selected.brand || "Vendor"}</strong> on {new Date(selected.createdAt).toLocaleString()}</p></div><div className="grid gap-3 sm:grid-cols-2"><Detail label="Brand" value={selected.brand} /><Detail label="Category" value={selected.category} /><Detail label="Gender" value={selected.gender} /><Detail label="Stock" value={selected.stock} /><Detail label="Sizes" value={selected.sizes?.join(", ") || "One size"} /><Detail label="Colors" value={selected.colors?.join(", ") || "Not specified"} /></div><div><h3 className="font-black">Description</h3><p className="mt-2 whitespace-pre-wrap leading-7 text-neutral-600 dark:text-neutral-300">{selected.description || "No description provided."}</p></div><label className="block space-y-2"><span className="text-sm font-bold">Rejection reason</span><textarea className="w-full resize-none" rows="4" placeholder="Explain what the vendor should revise before approval." value={reason} onChange={(event) => setReason(event.target.value)} /></label></div>
      </div>}
    </DashboardDetailModal>
  </>;
}

function Detail({ label, value }) { return <div className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800"><p className="text-xs font-bold uppercase tracking-wide text-neutral-500">{label}</p><p className="mt-1 font-semibold">{value || "Not specified"}</p></div>; }
