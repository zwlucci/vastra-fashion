import React, { useState } from "react";
import { AlertTriangle, Eye, X } from "lucide-react";
import { DashboardDetailModal } from "./DashboardDetailModal.jsx";
import { ProductImage } from "./ProductImage.jsx";
import { StatusConfirmModal } from "./StatusConfirmModal.jsx";
import { money, statusClass } from "../utils/format.js";

const statusProgression = {
  pending: "processing",
  processing: "shipped",
  shipped: "delivered"
};

const statusActionLabels = {
  processing: "Start Processing",
  shipped: "Mark as Shipped",
  delivered: "Mark as Delivered"
};

const cancellableStatuses = ["pending", "processing"];
const codRefusalReasons = [
  "Customer refused to accept the package",
  "Customer refused to pay",
  "Customer was repeatedly unavailable and later refused",
  "Customer said they no longer wanted the order after shipment",
  "Other"
];

export function VendorOrderTable({ orders, onStatusChange, onCancel, onReportRefusal, actingOrderId = "" }) {
  const [selected, setSelected] = useState(null);
  const [statusChange, setStatusChange] = useState(null);
  const [cancelOrder, setCancelOrder] = useState(null);
  const [refusalOrder, setRefusalOrder] = useState(null);
  if (!orders.length) return <div className="panel py-10 text-center text-neutral-500">No delivery orders for your products yet.</div>;

  function nextStatusFor(order) {
    if (order.returnStatus && order.returnStatus !== "none") return null;
    return statusProgression[order.status] || null;
  }

  function requestNextStatus(order) {
    const nextStatus = nextStatusFor(order);
    if (nextStatus) setStatusChange({ orderId: order.id, from: order.status, to: nextStatus });
  }

  function canCancel(order) {
    return cancellableStatuses.includes(order.status) && (!order.returnStatus || order.returnStatus === "none");
  }

  function canReportRefusal(order) {
    return order.paymentMethod === "cod" && order.status === "shipped" && !order.codRefusal && (!order.returnStatus || order.returnStatus === "none");
  }

  return <>
    <div className="grid gap-4 xl:grid-cols-2">
      {orders.map((order) => {
        const itemCount = order.items?.reduce((total, item) => total + item.quantity, 0) || 0;
        const nextStatus = nextStatusFor(order);
        return <article className="panel min-w-0 space-y-4" key={order.id}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-mono text-xs text-neutral-500">ORDER #{order.id.slice(0, 8)}</p>
              <h3 className="mt-1 text-lg font-black">{order.customerName}</h3>
              <p className="break-all text-xs text-neutral-500">{order.customerEmail}</p>
            </div>
            <span className={`badge ${statusClass(order.status)}`}>{order.status}</span>
          </div>
          <div className="grid grid-cols-2 gap-3 rounded-lg bg-neutral-50 p-3 text-sm dark:bg-neutral-950">
            <p><span className="text-neutral-500">Order total</span><br /><strong>{money(order.totalAmount)}</strong></p>
            <p><span className="text-neutral-500">Date</span><br /><strong>{new Date(order.createdAt).toLocaleDateString()}</strong></p>
          </div>
          <p className="line-clamp-2 text-sm text-neutral-600 dark:text-neutral-300">
            <strong>{itemCount} item{itemCount === 1 ? "" : "s"}:</strong> {order.items?.map((item) => `${item.name} x${item.quantity}`).join(", ")}
          </p>
          {order.returnStatus && order.returnStatus !== "none" && <p className="text-xs font-semibold capitalize text-clay">Return {order.returnStatus}</p>}
          <DeliveryActions
            canCancel={canCancel(order)}
            disabled={actingOrderId === order.id}
            nextStatus={nextStatus}
            onCancel={() => setCancelOrder(order)}
            onDetails={() => setSelected(order)}
            onNext={() => requestNextStatus(order)}
            onReportRefusal={canReportRefusal(order) ? () => setRefusalOrder(order) : null}
            order={order}
          />
        </article>;
      })}
    </div>
    <DashboardDetailModal
      open={Boolean(selected)}
      onClose={() => setSelected(null)}
      eyebrow="Vendor order"
      title={`Order #${selected?.id?.slice(0, 8) || ""}`}
      footer={selected && <DeliveryActions
        canCancel={canCancel(selected)}
        disabled={actingOrderId === selected.id}
        nextStatus={nextStatusFor(selected)}
        onCancel={() => setCancelOrder(selected)}
        onNext={() => requestNextStatus(selected)}
        onReportRefusal={canReportRefusal(selected) ? () => setRefusalOrder(selected) : null}
        order={selected}
      />}
    >
      {selected && <div className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Info label="Customer" value={selected.customerName} />
          <Info label="Email" value={selected.customerEmail} />
          <Info label="Status" value={selected.status} capitalize />
          <Info label="Order date" value={new Date(selected.createdAt).toLocaleString()} />
        </div>
        {(selected.phoneNumber || selected.deliveryAddress) && <div className="grid gap-3 sm:grid-cols-2">
          <Info label="Phone" value={selected.phoneNumber || "Not provided"} />
          <Info label="Delivery address" value={selected.deliveryAddress || "Not provided"} />
        </div>}
        <section>
          <h3 className="text-lg font-black">Your items</h3>
          <div className="mt-3 divide-y divide-neutral-200 rounded-lg border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
            {selected.items?.map((item) => <div className="flex gap-3 p-3" key={item.id}>
              <ProductImage className="h-20 w-16 shrink-0 rounded bg-neutral-100 object-contain dark:bg-neutral-950" src={item.imageUrl} alt={item.name} />
              <div className="min-w-0 flex-1">
                <p className="font-bold">{item.name}</p>
                <p className="text-sm text-neutral-500">{item.selectedSize ? `Size ${item.selectedSize} - ` : ""}{item.selectedColor ? `${item.selectedColor} - ` : ""}Quantity {item.quantity}</p>
                <p className="mt-1 font-semibold">{money(item.priceAtPurchase)} each - {money(item.priceAtPurchase * item.quantity)}</p>
              </div>
            </div>)}
          </div>
        </section>
        <div className="flex flex-wrap items-end justify-between gap-3 border-t border-neutral-200 pt-4 dark:border-neutral-800">
          <div>{selected.returnStatus && selected.returnStatus !== "none" && <p className="text-sm font-semibold capitalize text-clay">Return {selected.returnStatus}</p>}</div>
          <div className="text-right">
            <p className="text-sm text-neutral-500">Order total</p>
            <p className="text-2xl font-black">{money(selected.totalAmount)}</p>
          </div>
        </div>
      </div>}
    </DashboardDetailModal>
    <StatusConfirmModal change={statusChange} onCancel={() => setStatusChange(null)} onConfirm={async ({ orderId, to }) => { await onStatusChange(orderId, to); setSelected(null); }} />
    <CancelOrderModal order={cancelOrder} saving={actingOrderId === cancelOrder?.id} onClose={() => setCancelOrder(null)} onConfirm={async (order) => { await onCancel(order.id); setSelected(null); setCancelOrder(null); }} />
    <CodRefusalModal order={refusalOrder} saving={actingOrderId === refusalOrder?.id} onClose={() => setRefusalOrder(null)} onConfirm={async (payload) => { await onReportRefusal(refusalOrder.id, payload); setSelected(null); setRefusalOrder(null); }} />
  </>;
}

function DeliveryActions({ order, nextStatus, canCancel, disabled, onDetails, onNext, onCancel, onReportRefusal }) {
  return <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
    {onDetails && <button className="btn-secondary flex-1" onClick={onDetails} type="button"><Eye size={16} /> View details</button>}
    <div className="min-w-44 flex-1 rounded-lg border border-neutral-200 p-3 text-sm dark:border-neutral-800">
      <p><span className="text-neutral-500">Current status:</span> <strong className="capitalize">{order.status}</strong></p>
      <p className="mt-1"><span className="text-neutral-500">Next step:</span> {nextStatus ? <strong className="capitalize">{nextStatus}</strong> : "No further delivery updates"}</p>
    </div>
    {nextStatus && <button className="btn-primary" disabled={disabled} onClick={onNext} type="button">{disabled ? "Updating..." : statusActionLabels[nextStatus]}</button>}
    {onReportRefusal && <button className="btn-secondary text-red-600" disabled={disabled} onClick={onReportRefusal} type="button">Mark as Customer Refused Delivery</button>}
    {canCancel && <button className="btn-secondary text-red-600" disabled={disabled} onClick={onCancel} type="button">Cancel Order</button>}
  </div>;
}

function CodRefusalModal({ order, saving, onClose, onConfirm }) {
  const [reason, setReason] = useState(codRefusalReasons[0]);
  const [additionalDetails, setAdditionalDetails] = useState("");
  if (!order) return null;
  const needsDetails = reason === "Other";
  const disabled = saving || (needsDetails && additionalDetails.trim().length < 5);
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 backdrop-blur-sm" onPointerDown={(event) => event.target === event.currentTarget && !saving && onClose()}>
    <div aria-labelledby="cod-refusal-title" aria-modal="true" className="panel w-full max-w-lg space-y-5 shadow-2xl" role="dialog" onPointerDown={(event) => event.stopPropagation()}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-200"><AlertTriangle size={22} /></span>
          <div><p className="text-sm font-bold uppercase tracking-wide text-clay">COD refusal</p><h2 className="mt-1 text-2xl font-black" id="cod-refusal-title">Customer refused delivery?</h2></div>
        </div>
        <button aria-label="Close" className="btn-secondary h-9 w-9 px-0" disabled={saving} onClick={onClose} type="button"><X size={16} /></button>
      </div>
      <p className="leading-7 text-neutral-600 dark:text-neutral-300">This will mark order <span className="font-mono font-bold text-ink dark:text-neutral-100">#{order.id.slice(0, 8)}</span> as delivery refused and add one COD refusal record to the customer account.</p>
      <label className="block text-sm font-semibold">Reason<select className="mt-1 w-full" disabled={saving} value={reason} onChange={(event) => setReason(event.target.value)}>{codRefusalReasons.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
      <label className="block text-sm font-semibold">Additional details<textarea className="mt-1 w-full" disabled={saving} maxLength="500" rows="4" value={additionalDetails} onChange={(event) => setAdditionalDetails(event.target.value)} placeholder="Optional context for admin review" /></label>
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button className="btn-secondary" disabled={saving} onClick={onClose} type="button">Cancel</button>
        <button className="btn-primary bg-red-600 hover:bg-red-700 dark:bg-red-600 dark:text-white dark:hover:bg-red-700" disabled={disabled} onClick={() => onConfirm({ reason, additionalDetails })} type="button">{saving ? "Recording..." : "Record Refusal"}</button>
      </div>
    </div>
  </div>;
}

function CancelOrderModal({ order, saving, onClose, onConfirm }) {
  if (!order) return null;
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 backdrop-blur-sm" onPointerDown={(event) => event.target === event.currentTarget && !saving && onClose()}>
    <div aria-labelledby="vendor-cancel-title" aria-modal="true" className="panel w-full max-w-md space-y-5 shadow-2xl" role="dialog" onPointerDown={(event) => event.stopPropagation()}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-200"><AlertTriangle size={22} /></span>
          <div><p className="text-sm font-bold uppercase tracking-wide text-clay">Cancel order</p><h2 className="mt-1 text-2xl font-black" id="vendor-cancel-title">Cancel this order?</h2></div>
        </div>
        <button aria-label="Close" className="btn-secondary h-9 w-9 px-0" disabled={saving} onClick={onClose} type="button"><X size={16} /></button>
      </div>
      <p className="leading-7 text-neutral-600 dark:text-neutral-300">You are about to cancel order <span className="font-mono font-bold text-ink dark:text-neutral-100">#{order.id.slice(0, 8)}</span>. This cannot be undone.</p>
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button className="btn-secondary" disabled={saving} onClick={onClose} type="button">Keep Order</button>
        <button className="btn-primary bg-red-600 hover:bg-red-700 dark:bg-red-600 dark:text-white dark:hover:bg-red-700" disabled={saving} onClick={() => onConfirm(order)} type="button">{saving ? "Cancelling..." : "Cancel Order"}</button>
      </div>
    </div>
  </div>;
}

function Info({ label, value, capitalize = false }) {
  return <div className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800"><p className="text-xs font-bold uppercase tracking-wide text-neutral-500">{label}</p><p className={`mt-1 break-words font-semibold ${capitalize ? "capitalize" : ""}`}>{value || "Not provided"}</p></div>;
}
