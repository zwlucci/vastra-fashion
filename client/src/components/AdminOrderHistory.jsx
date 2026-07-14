import React, { useEffect, useState } from "react";
import { Eye } from "lucide-react";
import { DashboardDetailModal } from "./DashboardDetailModal.jsx";
import { ProductImage } from "./ProductImage.jsx";
import { StatusConfirmModal } from "./StatusConfirmModal.jsx";
import { money, statusClass } from "../utils/format.js";

const statuses = ["pending", "processing", "shipped", "delivered", "cancelled"];

export function AdminOrderHistory({ orders, onStatusChange, focusedOrderId = "" }) {
  const [selected, setSelected] = useState(null);
  const [statusChange, setStatusChange] = useState(null);
  useEffect(() => { const order = orders.find((item) => item.id === focusedOrderId); if (order) setSelected(order); }, [focusedOrderId, orders]);
  if (!orders.length) return <div className="panel py-10 text-center text-neutral-500">No orders have been placed yet.</div>;

  function askStatus(order, to) { if (to !== order.status) setStatusChange({ orderId: order.id, from: order.status, to }); }
  return <>
    <div className="grid gap-4 xl:grid-cols-2">
      {orders.map((order) => <article className="panel min-w-0 space-y-4" key={order.id}>
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-mono text-xs text-neutral-500">ORDER #{order.id.slice(0, 8)}</p><h3 className="mt-1 text-lg font-black">{order.customerName}</h3><p className="break-all text-xs text-neutral-500">{order.customerEmail}</p></div><span className={`badge ${statusClass(order.status)}`}>{order.status}</span></div>
        <div className="grid grid-cols-2 gap-3 rounded-lg bg-neutral-50 p-3 text-sm dark:bg-neutral-950"><Summary label="Total" value={money(order.totalAmount)} /><Summary label="Payment" value={order.paymentMethod === "cod" ? "Cash on delivery" : order.paymentMethod} /><Summary label="Date" value={new Date(order.createdAt).toLocaleDateString()} /><Summary label="Items" value={`${order.items?.reduce((sum, item) => sum + item.quantity, 0) || 0} total`} /></div>
        <p className="line-clamp-2 text-sm text-neutral-600 dark:text-neutral-300">{order.items?.map((item) => `${item.name} ×${item.quantity}${item.vendorName ? ` — ${item.vendorName}` : ""}`).join(", ")}</p>
        {order.returnStatus && order.returnStatus !== "none" && <p className="text-xs font-semibold capitalize text-clay">Return {order.returnStatus}</p>}
        <button className="btn-secondary w-full" onClick={() => setSelected(order)} type="button"><Eye size={16} /> View details</button>
      </article>)}
    </div>
    <DashboardDetailModal open={Boolean(selected)} onClose={() => setSelected(null)} eyebrow="Admin order history" title={`Order #${selected?.id?.slice(0, 8) || ""}`} footer={selected && <div className="flex flex-wrap items-center justify-end gap-3">{!["delivered", "cancelled"].includes(selected.status) && <><label className="text-sm font-bold" htmlFor="admin-order-status">Update delivery</label><select id="admin-order-status" value={selected.status} onChange={(event) => askStatus(selected, event.target.value)}>{statuses.map((status) => <option value={status} key={status}>{status}</option>)}</select></>}</div>}>
      {selected && <div className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Info label="Customer" value={selected.customerName} /><Info label="Email" value={selected.customerEmail} /><Info label="Phone" value={selected.phoneNumber} /><Info label="Status" value={selected.status} capitalize /></div>
        <div className="grid gap-3 sm:grid-cols-2"><Info label="Delivery address" value={selected.deliveryAddress} /><Info label="Order date" value={new Date(selected.createdAt).toLocaleString()} /><Info label="Payment method" value={selected.paymentMethod === "cod" ? "Cash on delivery" : selected.paymentMethod} capitalize /><Info label="Payment status" value={selected.paymentStatus} capitalize /></div>
        <section><h3 className="text-lg font-black">Order items</h3><div className="mt-3 divide-y divide-neutral-200 rounded-lg border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">{selected.items?.map((item) => <div className="flex gap-3 p-3" key={item.id}><ProductImage className="h-20 w-16 shrink-0 rounded bg-neutral-100 object-contain dark:bg-neutral-950" src={item.imageUrl} alt={item.name} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-start justify-between gap-2"><p className="font-bold">{item.name}</p><p className="font-black">{money(item.priceAtPurchase * item.quantity)}</p></div><p className="text-sm text-neutral-500">Vendor: {item.vendorName || item.brand || "Unknown vendor"}</p><p className="text-sm text-neutral-500">{item.selectedSize ? `Size ${item.selectedSize} · ` : ""}{item.selectedColor ? `${item.selectedColor} · ` : ""}Quantity {item.quantity} · {money(item.priceAtPurchase)} each</p></div></div>)}</div></section>
        <div className="ml-auto max-w-sm space-y-2 border-t border-neutral-200 pt-4 text-sm dark:border-neutral-800"><Price label="Subtotal" value={selected.subtotalAmount} /><Price label="Shipping" value={selected.shippingFee} />{selected.discountAmount > 0 && <Price label={`Discount${selected.couponCode ? ` (${selected.couponCode})` : ""}`} value={-selected.discountAmount} />}<div className="flex justify-between pt-2 text-xl font-black"><span>Total</span><span>{money(selected.totalAmount)}</span></div></div>
        {selected.returnStatus && selected.returnStatus !== "none" && <div className="rounded-lg bg-clay/10 p-4"><p className="font-bold capitalize">Return {selected.returnStatus}</p>{selected.returnReason && <p className="mt-1 text-sm">{selected.returnReason}</p>}</div>}
      </div>}
    </DashboardDetailModal>
    <StatusConfirmModal change={statusChange} onCancel={() => setStatusChange(null)} onConfirm={async ({ orderId, to }) => { await onStatusChange(orderId, to); setSelected(null); }} />
  </>;
}

function Summary({ label, value }) { return <p><span className="text-neutral-500">{label}</span><br /><strong className="capitalize">{value || "—"}</strong></p>; }
function Info({ label, value, capitalize = false }) { return <div className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800"><p className="text-xs font-bold uppercase tracking-wide text-neutral-500">{label}</p><p className={`mt-1 break-words font-semibold ${capitalize ? "capitalize" : ""}`}>{value || "Not provided"}</p></div>; }
function Price({ label, value }) { return <p className="flex justify-between gap-4"><span className="text-neutral-500">{label}</span><strong>{money(value)}</strong></p>; }
