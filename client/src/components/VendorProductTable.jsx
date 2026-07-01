import React, { useEffect, useRef, useState } from "react";
import { Edit, Info, Trash2 } from "lucide-react";
import { ProductImage } from "./ProductImage.jsx";
import { money, statusClass } from "../utils/format.js";

export function VendorProductTable({ products, onEdit, onDelete }) {
  const [openRejectionInfoId, setOpenRejectionInfoId] = useState("");
  const rejectionInfoRef = useRef(null);
  const showActions = Boolean(onEdit || onDelete);

  useEffect(() => {
    if (!openRejectionInfoId) return undefined;
    function closeOnOutsidePointer(event) {
      if (rejectionInfoRef.current && !rejectionInfoRef.current.contains(event.target)) {
        setOpenRejectionInfoId("");
      }
    }
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [openRejectionInfoId]);

  useEffect(() => {
    if (openRejectionInfoId && !products.some((product) => product.id === openRejectionInfoId && product.status === "rejected" && product.rejectionReason)) {
      setOpenRejectionInfoId("");
    }
  }, [openRejectionInfoId, products]);

  if (!products.length) return <div className="panel py-10 text-center text-neutral-500">No products uploaded yet.</div>;

  return (
    <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-neutral-100 text-xs uppercase text-neutral-500 dark:bg-neutral-800">
            <tr>
              <th className="px-4 py-3">Image</th>
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3">Price</th>
              <th className="px-4 py-3">Gender</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Stock</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Created</th>
              {showActions && <th className="px-4 py-3">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr className="border-t border-neutral-200 dark:border-neutral-800" key={product.id}>
                <td className="px-4 py-3"><ProductImage className="h-14 w-12 rounded object-cover" src={product.imageUrl} alt={product.name} /></td>
                <td className="px-4 py-3 font-semibold">{product.name}</td>
                <td className="px-4 py-3">{money(product.price)}</td>
                <td className="px-4 py-3">{product.gender}</td>
                <td className="px-4 py-3">{product.category}</td>
                <td className="px-4 py-3">
                  <div className="space-y-1">
                    <p>{product.stock}</p>
                    {product.status === "approved" && product.stock === 0 && <span className="badge bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200">Out of stock</span>}
                    {product.status === "approved" && product.stock === 1 && <span className="badge bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200">Low stock</span>}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className={`badge ${statusClass(product.status)}`}>{product.status}</span>
                    {product.status === "rejected" && product.rejectionReason && (
                      <div className="relative" ref={openRejectionInfoId === product.id ? rejectionInfoRef : null}>
                        <button aria-controls={`rejection-info-${product.id}`} aria-expanded={openRejectionInfoId === product.id} aria-label={`Rejection reason for ${product.name}`} className="flex h-7 w-7 items-center justify-center rounded-full border border-red-200 text-red-600 hover:bg-red-50 focus:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); setOpenRejectionInfoId((current) => current === product.id ? "" : product.id); }} type="button" title="View rejection reason"><Info size={14} /></button>
                        {openRejectionInfoId === product.id && <div className="absolute right-0 top-9 z-20 w-64 rounded-lg border border-neutral-200 bg-white p-3 text-xs font-normal leading-5 text-neutral-700 shadow-xl dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200" id={`rejection-info-${product.id}`} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()} role="tooltip">{product.rejectionReason}</div>}
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">{new Date(product.createdAt).toLocaleDateString()}</td>
                {showActions && (
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      {onEdit && product.status !== "rejected" && <button className="btn-secondary h-9 w-9 px-0" onClick={() => onEdit(product)} type="button" title="Edit"><Edit size={16} /></button>}
                      {onDelete && <button className="btn-secondary h-9 w-9 px-0 text-red-600" onClick={() => onDelete(product.id)} type="button" title="Delete"><Trash2 size={16} /></button>}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
