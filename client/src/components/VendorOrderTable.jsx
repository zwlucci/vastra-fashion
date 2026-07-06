import React, { useState } from "react";
import { Eye } from "lucide-react";
import { DashboardDetailModal } from "./DashboardDetailModal.jsx";
import { ProductImage } from "./ProductImage.jsx";
import { StatusConfirmModal } from "./StatusConfirmModal.jsx";
import { money, statusClass } from "../utils/format.js";

const statusOptions = ["pending", "processing", "shipped", "delivered", "cancelled"];

export function VendorOrderTable({ orders, onStatusChange }) {
  const [selected, setSelected] = useState(null);
  const [statusChange, setStatusChange] = useState(null);
  if (!orders.length) return <div className="panel py-10 text-center text-neutral-500">No delivery orders for your products yet.</div>;

  function requestStatus(order, status) {
    if (status !== order.status) setStatusChange({ orderId: order.id, from: order.status, to: status });
  }

  return <>
    <div className="grid gap-4 xl:grid-cols-2">
      {orders.map((order) => {
        const itemCount = order.items?.reduce((total, item) => total + item.quantity, 0) || 0;
        return <article className="panel min-w-0 space-y-4" key={order.id}>
          <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-mono text-xs text-neutral-500">ORDER #{order.id.slice(0, 8)}</p><h3 className="mt-1 text-lg font-black">{order.customerName}</h3><p className="break-all text-xs text-neutral-500">{order.customerEmail}</p></div><span className={`badge ${statusClass(order.status)}`}>{order.status}</span></div>
          <div className="grid grid-cols-2 gap-3 rounded-lg bg-neutral-50 p-3 text-sm dark:bg-neutral-950"><p><span className="text-neutral-500">Order total</span><br /><strong>{money(order.totalAmount)}</strong></p><p><span className="text-neutral-500">Date</span><br /><strong>{new Date(order.createdAt).toLocaleDateString()}</strong></p></div>
          <p className="line-clamp-2 text-sm text-neutral-600 dark:text-neutral-300"><strong>{itemCount} item{itemCount === 1 ? "" : "s"}:</strong> {order.items?.map((item) => `${item.name} ×${item.quantity}`).join(", ")}</p>
          {order.returnStatus && order.returnStatus !== "none" && <p className="text-xs font-semibold capitalize text-clay">Return {order.returnStatus}</p>}
          <div className="flex flex-wrap gap-2"><button className="btn-secondary flex-1" onClick={() => setSelected(order)} type="button"><Eye size={16} /> View details</button>{!["delivered", "cancelled"].includes(order.status) && <select aria-label={`Change status for order ${order.id}`} className="min-w-36 flex-1" value={order.status} onChange={(event) => requestStatus(order, event.target.value)}>{statusOptions.map((status) => <option value={status} key={status}>{status}</option>)}</select>}</div>
        </article>;
      })}
    </div>
    <DashboardDetailModal open={Boolean(selected)} onClose={() => setSelected(null)} eyebrow="Vendor order" title={`Order #${selected?.id?.slice(0, 8) || ""}`} footer={selected && !["delivered", "cancelled"].includes(selected.status) && <div className="flex flex-wrap items-center justify-end gap-3"><label className="text-sm font-bold" htmlFor="vendor-order-status">Update delivery</label><select id="vendor-order-status" value={selected.status} onChange={(event) => requestStatus(selected, event.target.value)}>{statusOptions.map((status) => <option value={status} key={status}>{status}</option>)}</select></div>}>
      {selected && <div className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Info label="Customer" value={selected.customerName} /><Info label="Email" value={selected.customerEmail} /><Info label="Status" value={selected.status} capitalize /><Info label="Order date" value={new Date(selected.createdAt).toLocaleString()} /></div>
        {(selected.phoneNumber || selected.deliveryAddress) && <div className="grid gap-3 sm:grid-cols-2"><Info label="Phone" value={selected.phoneNumber || "Not provided"} /><Info label="Delivery address" value={selected.deliveryAddress || "Not provided"} /></div>}
        <section><h3 className="text-lg font-black">Your items</h3><div className="mt-3 divide-y divide-neutral-200 rounded-lg border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">{selected.items?.map((item) => <div className="flex gap-3 p-3" key={item.id}><ProductImage className="h-20 w-16 shrink-0 rounded bg-neutral-100 object-contain dark:bg-neutral-950" src={item.imageUrl} alt={item.name} /><div className="min-w-0 flex-1"><p className="font-bold">{item.name}</p><p className="text-sm text-neutral-500">{item.selectedSize ? `Size ${item.selectedSize} · ` : ""}{item.selectedColor ? `${item.selectedColor} · ` : ""}Quantity {item.quantity}</p><p className="mt-1 font-semibold">{money(item.priceAtPurchase)} each · {money(item.priceAtPurchase * item.quantity)}</p></div></div>)}</div></section>
        <div className="flex flex-wrap items-end justify-between gap-3 border-t border-neutral-200 pt-4 dark:border-neutral-800"><div>{selected.returnStatus && selected.returnStatus !== "none" && <p className="text-sm font-semibold capitalize text-clay">Return {selected.returnStatus}</p>}</div><div className="text-right"><p className="text-sm text-neutral-500">Order total</p><p className="text-2xl font-black">{money(selected.totalAmount)}</p></div></div>
      </div>}
    </DashboardDetailModal>
    <StatusConfirmModal change={statusChange} onCancel={() => setStatusChange(null)} onConfirm={async ({ orderId, to }) => { await onStatusChange(orderId, to); setSelected(null); }} />
  </>;
}

function Info({ label, value, capitalize = false }) {
  return <div className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800"><p className="text-xs font-bold uppercase tracking-wide text-neutral-500">{label}</p><p className={`mt-1 break-words font-semibold ${capitalize ? "capitalize" : ""}`}>{value || "Not provided"}</p></div>;
}
