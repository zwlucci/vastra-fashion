import React, { useState } from "react";
import { ArrowLeft, Check, Eye, X } from "lucide-react";
import { ProductMedia } from "./ProductMedia.jsx";
import { money, statusClass } from "../utils/format.js";

function groupProductImages(product) {
  const images = product?.productMedia?.length ? product.productMedia : product?.productImages || [];
  if (!images.length && product?.imageUrl) return [{ color: "Default", items: [{ url: product.imageUrl, type: "image" }] }];

  const grouped = new Map();
  images.forEach((image) => {
    const color = image.color || "Default";
    if (!grouped.has(color)) grouped.set(color, []);
    if (image.url) grouped.get(color).push({ ...image, type: image.type || "image" });
  });
  return [...grouped.entries()].map(([color, items]) => ({ color, items }));
}

export function AdminProductApprovalTable({ products, onApprove, onReject }) {
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [savingAction, setSavingAction] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const pending = products.filter((product) => product.status === "pending");

  async function handleDecision(action, productId, reason = "") {
    const finalReason = reason.trim();
    if (action === "reject" && finalReason.length < 5) return;
    setSavingAction(action);
    try {
      if (action === "approve") {
        await onApprove(productId);
      } else {
        await onReject(productId, finalReason);
      }
      setSelectedProduct(null);
      setSelectedMedia(null);
      setRejectionReason("");
    } finally {
      setSavingAction("");
    }
  }

  function handleQuickReject(productId) {
    const reason = window.prompt("Share a clear rejection reason for the vendor:");
    if (!reason) return;
    handleDecision("reject", productId, reason);
  }

  if (selectedProduct) {
    const imageGroups = groupProductImages(selectedProduct);

    return (
      <div className="panel space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button className="btn-secondary" onClick={() => { setSelectedProduct(null); setSelectedMedia(null); setRejectionReason(""); }} type="button">
            <ArrowLeft size={16} /> Back to approvals
          </button>
          <span className={`badge ${statusClass(selectedProduct.status)}`}>{selectedProduct.status}</span>
        </div>
        <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="space-y-4">
            <ProductMedia className="aspect-[4/5] w-full rounded-lg object-contain shadow-soft" media={selectedMedia || selectedProduct.productMedia?.[0] || { url: selectedProduct.imageUrl, type: "image" }} alt={selectedProduct.name} controls />
            <div className="space-y-4">
              {imageGroups.map((group) => (
                <div key={group.color}>
                  <p className="mb-2 text-sm font-bold uppercase tracking-wide text-neutral-500">{group.color}</p>
                  <div className="grid grid-cols-3 gap-2">
                    {group.items.map((item, index) => (
                      <button className={`overflow-hidden rounded-md border ${selectedMedia?.url === item.url ? "border-clay" : "border-transparent"}`} onClick={() => setSelectedMedia(item)} type="button" aria-label={`Preview ${group.color} media ${index + 1}`} key={`${item.url}-${index}`}>
                        <ProductMedia className="aspect-square w-full object-cover" media={item} alt={`${group.color} media ${index + 1}`} />
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-5">
            <div>
              <p className="text-sm font-bold uppercase tracking-wide text-clay">{selectedProduct.brand}</p>
              <h3 className="mt-1 text-3xl font-black">{selectedProduct.name}</h3>
              <p className="mt-2 text-xl font-bold">{money(selectedProduct.price)}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="panel"><p className="text-sm text-neutral-500">Category</p><p className="font-semibold">{selectedProduct.category}</p></div>
              <div className="panel"><p className="text-sm text-neutral-500">Gender</p><p className="font-semibold">{selectedProduct.gender}</p></div>
              <div className="panel"><p className="text-sm text-neutral-500">Sizes</p><p className="font-semibold">{selectedProduct.sizes?.join(", ") || "One size"}</p></div>
              <div className="panel"><p className="text-sm text-neutral-500">Colors</p><p className="font-semibold">{selectedProduct.colors?.join(", ") || "Not specified"}</p></div>
            </div>
            <div>
              <h4 className="text-xl font-black">Description</h4>
              <p className="mt-2 leading-7 text-neutral-600 dark:text-neutral-300">{selectedProduct.description}</p>
            </div>
            <label className="block space-y-2">
              <span className="text-sm font-bold">Rejection reason</span>
              <textarea
                className="w-full resize-none"
                rows="4"
                placeholder="Explain what the vendor should revise before approval."
                value={rejectionReason}
                onChange={(event) => setRejectionReason(event.target.value)}
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <button className="btn-primary" disabled={Boolean(savingAction)} onClick={() => handleDecision("approve", selectedProduct.id)} type="button"><Check size={16} /> Approve</button>
              <button className="btn-secondary" disabled={Boolean(savingAction) || rejectionReason.trim().length < 5} onClick={() => handleDecision("reject", selectedProduct.id, rejectionReason)} type="button"><X size={16} /> Reject</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!pending.length) return <div className="panel py-8 text-center text-neutral-500">No pending products.</div>;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {pending.map((product) => (
        <article className="panel flex cursor-pointer gap-4 text-left transition hover:border-clay" onClick={() => { setSelectedProduct(product); setSelectedMedia(product.productMedia?.[0] || { url: product.imageUrl, type: "image" }); setRejectionReason(""); }} tabIndex={0} role="button" key={product.id}>
          <ProductMedia className="h-28 w-24 rounded-md object-cover" media={product.productMedia?.[0] || { url: product.imageUrl, type: "image" }} alt={product.name} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-bold">{product.name}</h3>
              <span className={`badge ${statusClass(product.status)}`}>{product.status}</span>
            </div>
            <p className="text-sm text-neutral-500">{product.brand} · {product.gender} · {product.category} · {money(product.price)}</p>
            <p className="mt-2 line-clamp-2 text-sm">{product.description}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="btn-secondary pointer-events-none"><Eye size={16} /> View details</span>
              <button className="btn-primary" disabled={Boolean(savingAction)} onClick={(event) => { event.stopPropagation(); handleDecision("approve", product.id); }} type="button"><Check size={16} /> Approve</button>
              <button className="btn-secondary" disabled={Boolean(savingAction)} onClick={(event) => { event.stopPropagation(); handleQuickReject(product.id); }} type="button"><X size={16} /> Reject</button>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
