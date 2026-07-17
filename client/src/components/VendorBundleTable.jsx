import { Edit, Eye, Info, Package, Trash2 } from "lucide-react";
import React, { useState } from "react";
import { BundleImageGrid } from "./BundleImageGrid.jsx";
import { DashboardDetailModal } from "./DashboardDetailModal.jsx";
import { ProductImage } from "./ProductImage.jsx";
import { money, statusClass } from "../utils/format.js";

function approvalLabel(bundle) {
  if (bundle.status === "pending") return "Pending approval";
  if (bundle.status === "approved" && Number(bundle.stock || 0) > 0) return "Approved";
  if (bundle.status === "rejected") return "Rejected";
  return "Disabled or unavailable";
}

function Detail({ label, value }) {
  return <div className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800"><p className="text-xs font-bold uppercase tracking-wide text-neutral-500">{label}</p><p className="mt-1 break-words font-semibold">{value || "Not specified"}</p></div>;
}

export function VendorBundleTable({ bundles, onEdit, onDelete }) {
  const [selected, setSelected] = useState(null);
  if (!bundles.length) return <div className="panel py-10 text-center text-neutral-500">No bundled products found.</div>;

  return <>
    <div className="grid gap-4 xl:grid-cols-2">
      {bundles.map((bundle) => (
        <article className="panel flex min-w-0 flex-col overflow-hidden p-0 transition hover:-translate-y-0.5 hover:border-clay" key={bundle.id}>
          <button className="block w-full text-left" onClick={() => setSelected(bundle)} type="button">
            <BundleImageGrid product={bundle} className="aspect-[16/9] w-full" />
          </button>
          <div className="flex flex-1 flex-col p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-clay"><Package size={14} /> Bundle</p>
                <h3 className="truncate text-lg font-black">{bundle.name}</h3>
                <p className="text-sm text-neutral-500">{bundle.bundleComponents?.length || 0} included products</p>
              </div>
              <span className={`badge shrink-0 ${statusClass(bundle.status)}`}>{approvalLabel(bundle)}</span>
            </div>
            <p className="mt-3 line-clamp-2 text-sm text-neutral-600 dark:text-neutral-300">{bundle.bundleComponents?.map((product) => product.name).join(", ") || "No included products"}</p>
            <div className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
              <p><span className="text-neutral-500">Original</span><br /><strong>{money(bundle.bundleOriginalPrice ?? bundle.price)}</strong></p>
              <p><span className="text-neutral-500">Discount</span><br /><strong>{bundle.bundleDiscountPercentage || 0}%</strong></p>
              <p><span className="text-neutral-500">Final</span><br /><strong>{money(bundle.price)}</strong></p>
              <p><span className="text-neutral-500">Stock</span><br /><strong>{bundle.stock}</strong></p>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm"><p><span className="text-neutral-500">Shared sizes</span><br /><strong>{bundle.sizes?.join(", ") || "None"}</strong></p><p><span className="text-neutral-500">Created</span><br /><strong>{new Date(bundle.createdAt).toLocaleDateString()}</strong></p></div>
            {bundle.status === "rejected" && bundle.rejectionReason && <p className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200">{bundle.rejectionReason}</p>}
            <div className="mt-auto flex flex-wrap gap-2 pt-4">
              <button className="btn-secondary flex-1 px-3" onClick={() => setSelected(bundle)} type="button"><Eye size={16} /> View</button>
              {onEdit && bundle.status !== "rejected" && <button aria-label={`Edit ${bundle.name}`} className="btn-secondary h-10 w-10 px-0" onClick={() => onEdit(bundle)} type="button"><Edit size={16} /></button>}
              {onDelete && <button aria-label={`Delete ${bundle.name}`} className="btn-secondary h-10 w-10 px-0 text-red-600" onClick={() => onDelete(bundle.id)} type="button"><Trash2 size={16} /></button>}
            </div>
          </div>
        </article>
      ))}
    </div>
    <DashboardDetailModal open={Boolean(selected)} onClose={() => setSelected(null)} eyebrow="Bundled product" title={selected?.name || "Bundle"} footer={selected && <div className="flex flex-wrap justify-end gap-2">{onEdit && selected.status !== "rejected" && <button className="btn-secondary" onClick={() => { const bundle = selected; setSelected(null); onEdit(bundle); }} type="button"><Edit size={16} /> Edit bundle</button>}{onDelete && <button className="btn-secondary text-red-600" onClick={() => { const id = selected.id; setSelected(null); onDelete(id); }} type="button"><Trash2 size={16} /> Delete bundle</button>}</div>}>
      {selected && <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
        <BundleImageGrid product={selected} className="aspect-square w-full rounded-lg" />
        <div className="min-w-0 space-y-5">
          <div className="flex flex-wrap items-center gap-3"><p className="text-2xl font-black">{money(selected.price)}</p><span className={`badge ${statusClass(selected.status)}`}>{approvalLabel(selected)}</span></div>
          <div className="grid gap-3 sm:grid-cols-2"><Detail label="Included products" value={`${selected.bundleComponents?.length || 0}`} /><Detail label="Original total" value={money(selected.bundleOriginalPrice ?? selected.price)} /><Detail label="Discount" value={`${selected.bundleDiscountPercentage || 0}%`} /><Detail label="Final price" value={money(selected.price)} /><Detail label="Bundle stock" value={selected.stock} /><Detail label="Shared sizes" value={selected.sizes?.join(", ")} /><Detail label="Created" value={new Date(selected.createdAt).toLocaleString()} /><Detail label="Approval" value={approvalLabel(selected)} /></div>
          <div>
            <h3 className="font-black">Included products</h3>
            <div className="mt-3 divide-y divide-neutral-200 rounded-lg border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
              {(selected.bundleComponents || []).map((product) => <div className="flex gap-3 p-3" key={product.id}><ProductImage className="h-16 w-12 shrink-0 rounded bg-neutral-100 object-contain dark:bg-neutral-950" src={product.imageUrl} alt={product.name} /><div className="min-w-0"><p className="font-bold">{product.name}</p><p className="text-sm text-neutral-500">{money(product.price)} - Stock {product.stock}</p><p className="text-xs text-neutral-500">{product.sizes?.join(", ") || "No sizes listed"}</p></div></div>)}
            </div>
          </div>
          <div><h3 className="font-black">Description</h3><p className="mt-2 whitespace-pre-wrap leading-7 text-neutral-600 dark:text-neutral-300">{selected.description || "No description provided."}</p></div>
          {selected.status === "rejected" && selected.rejectionReason && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"><p className="flex items-center gap-2 font-bold"><Info size={16} /> Rejection reason</p><p className="mt-2 text-sm">{selected.rejectionReason}</p></div>}
        </div>
      </div>}
    </DashboardDetailModal>
  </>;
}
