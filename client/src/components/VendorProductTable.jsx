import React, { useState } from "react";
import { Edit, Eye, Info, Trash2 } from "lucide-react";
import { DashboardDetailModal } from "./DashboardDetailModal.jsx";
import { ProductImage } from "./ProductImage.jsx";
import { money, statusClass } from "../utils/format.js";

function Detail({ label, children }) {
  return <div className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800"><p className="text-xs font-bold uppercase tracking-wide text-neutral-500">{label}</p><div className="mt-1 font-semibold">{children || "Not specified"}</div></div>;
}

export function VendorProductTable({ products, onEdit, onDelete }) {
  const [selected, setSelected] = useState(null);
  if (!products.length) return <div className="panel py-10 text-center text-neutral-500">No products uploaded yet.</div>;

  return <>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {products.map((product) => (
        <article className="panel flex min-w-0 flex-col overflow-hidden p-0 transition hover:-translate-y-0.5 hover:border-clay" key={product.id}>
          <button className="block w-full bg-neutral-100 text-left dark:bg-neutral-950" onClick={() => setSelected(product)} type="button">
            <ProductImage className="aspect-[4/3] w-full object-contain" src={product.imageUrl} alt={product.name} />
          </button>
          <div className="flex flex-1 flex-col p-4">
            <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="truncate text-lg font-black">{product.name}</h3><p className="text-sm text-neutral-500">{product.category}</p></div><span className={`badge shrink-0 ${statusClass(product.status)}`}>{product.status}</span></div>
            <p className="mt-3 text-xl font-black">{money(product.price)}</p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm"><p><span className="text-neutral-500">Stock</span><br /><strong>{product.stock}</strong></p><p><span className="text-neutral-500">Created</span><br /><strong>{new Date(product.createdAt).toLocaleDateString()}</strong></p></div>
            {product.status === "approved" && product.stock <= 1 && <p className={`mt-3 text-xs font-bold ${product.stock === 0 ? "text-red-500" : "text-amber-500"}`}>{product.stock === 0 ? "Out of stock" : "Low stock"}</p>}
            <div className="mt-auto flex flex-wrap gap-2 pt-4">
              <button className="btn-secondary flex-1 px-3" onClick={() => setSelected(product)} type="button"><Eye size={16} /> View details</button>
              {onEdit && product.status !== "rejected" && <button aria-label={`Edit ${product.name}`} className="btn-secondary h-10 w-10 px-0" onClick={() => onEdit(product)} type="button"><Edit size={16} /></button>}
              {onDelete && <button aria-label={`Delete ${product.name}`} className="btn-secondary h-10 w-10 px-0 text-red-600" onClick={() => onDelete(product.id)} type="button"><Trash2 size={16} /></button>}
            </div>
          </div>
        </article>
      ))}
    </div>
    <DashboardDetailModal open={Boolean(selected)} onClose={() => setSelected(null)} eyebrow="Product details" title={selected?.name || "Product"} footer={selected && <div className="flex flex-wrap justify-end gap-2">{onEdit && selected.status !== "rejected" && <button className="btn-secondary" onClick={() => { const product = selected; setSelected(null); onEdit(product); }} type="button"><Edit size={16} /> Edit product</button>}{onDelete && <button className="btn-secondary text-red-600" onClick={() => { const id = selected.id; setSelected(null); onDelete(id); }} type="button"><Trash2 size={16} /> Delete product</button>}</div>}>
      {selected && <div className="grid gap-6 md:grid-cols-[260px_minmax(0,1fr)]">
        <ProductImage className="aspect-[4/5] w-full rounded-lg bg-neutral-100 object-contain dark:bg-neutral-950" src={selected.imageUrl} alt={selected.name} />
        <div className="min-w-0 space-y-5">
          <div className="flex flex-wrap items-center gap-3"><p className="text-2xl font-black">{money(selected.price)}</p><span className={`badge ${statusClass(selected.status)}`}>{selected.status}</span></div>
          <div className="grid gap-3 sm:grid-cols-2"><Detail label="Category">{selected.category}</Detail><Detail label="Gender">{selected.gender}</Detail><Detail label="Stock">{selected.stock}</Detail><Detail label="Created">{new Date(selected.createdAt).toLocaleString()}</Detail><Detail label="Sizes">{selected.sizes?.join(", ") || "One size"}</Detail><Detail label="Colors">{selected.colors?.join(", ") || "Not specified"}</Detail></div>
          <div><h3 className="font-black">Description</h3><p className="mt-2 whitespace-pre-wrap leading-7 text-neutral-600 dark:text-neutral-300">{selected.description || "No description provided."}</p></div>
          {selected.status === "rejected" && selected.rejectionReason && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"><p className="flex items-center gap-2 font-bold"><Info size={16} /> Rejection reason</p><p className="mt-2 text-sm">{selected.rejectionReason}</p></div>}
        </div>
      </div>}
    </DashboardDetailModal>
  </>;
}
