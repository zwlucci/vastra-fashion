import React, { useEffect, useState } from "react";
import { AlertTriangle, ArrowLeft, X } from "lucide-react";
import { Link } from "react-router-dom";
import { api, getErrorMessage } from "../api/client.js";
import { OrderTable } from "../components/OrderTable.jsx";
import { ProductImage } from "../components/ProductImage.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useMessages } from "../context/MessageContext.jsx";
import { money, statusClass } from "../utils/format.js";

export function Orders() {
  const { user } = useAuth();
  const { socket } = useMessages();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [actingOrderId, setActingOrderId] = useState("");
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [cancelConfirmation, setCancelConfirmation] = useState(null);
  const [returnConfirmation, setReturnConfirmation] = useState(null);
  const [returnReason, setReturnReason] = useState("");
  const [actingReturnItemId, setActingReturnItemId] = useState("");

  async function loadOrders() {
    const { data } = await api.get("/orders");
    setOrders(data.orders);
    setSelectedOrder((current) => current ? data.orders.find((order) => order.id === current.id) || current : current);
  }

  useEffect(() => {
    loadOrders().catch((err) => setError(getErrorMessage(err))).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!socket) return undefined;
    let refreshTimer = null;
    const refresh = () => {
      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => loadOrders().catch(() => {}), 80);
    };
    socket.on("order:created", refresh);
    socket.on("order:status-updated", refresh);
    socket.on("order:user-cancelled", refresh);
    socket.on("order:vendor-cancelled", refresh);
    socket.on("order:updated", refresh);
    return () => {
      window.clearTimeout(refreshTimer);
      socket.off("order:created", refresh);
      socket.off("order:status-updated", refresh);
      socket.off("order:user-cancelled", refresh);
      socket.off("order:vendor-cancelled", refresh);
      socket.off("order:updated", refresh);
    };
  }, [socket]);

  async function runOrderAction(orderId, action) {
    setError("");
    setSuccess("");
    setActingOrderId(orderId);
    try {
      const { data } = await api.patch(`/orders/${orderId}/${action}`, action === "return" ? { reason: "" } : {});
      setOrders((current) => current.map((order) => order.id === orderId ? data.order : order));
      setSelectedOrder((current) => current?.id === orderId ? data.order : current);
      setSuccess(data.message);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setActingOrderId("");
    }
  }

  async function runReturnItem(order, item) {
    if (!order || !item || actingReturnItemId) return;
    setError("");
    setSuccess("");
    setActingReturnItemId(item.id);
    try {
      const { data } = await api.patch(`/orders/${order.id}/items/${item.id}/return`, { reason: returnReason });
      setOrders((current) => current.map((entry) => entry.id === order.id ? data.order : entry));
      setSelectedOrder((current) => current?.id === order.id ? data.order : current);
      setSuccess(data.message);
      setReturnConfirmation(null);
      setReturnReason("");
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setActingReturnItemId("");
    }
  }

  async function openOrderDetails(order) {
    setError("");
    setSelectedOrder(order);
    setDetailsLoading(true);
    try {
      const { data } = await api.get(`/orders/${order.id}`);
      setSelectedOrder(data.order);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setDetailsLoading(false);
    }
  }

  if (selectedOrder) {
    return (
      <section className="mx-auto max-w-7xl space-y-6 px-4 py-10">
        <button className="btn-secondary inline-flex" onClick={() => setSelectedOrder(null)} type="button"><ArrowLeft size={17} /> Back to Order History</button>
        {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">{error}</p>}
        {success && <p className="rounded-md bg-clay/10 p-3 text-sm font-semibold text-clay">{success}</p>}
        <OrderDetails
          acting={actingOrderId === selectedOrder.id}
          canCancel={["user", "admin"].includes(user.role) && ["pending", "processing"].includes(selectedOrder.status) && (!selectedOrder.returnStatus || selectedOrder.returnStatus === "none")}
          loading={detailsLoading}
          onCancel={() => setCancelConfirmation(selectedOrder)}
          onReturnItem={(item) => { setReturnConfirmation({ order: selectedOrder, item }); setReturnReason(""); }}
          actingReturnItemId={actingReturnItemId}
          order={selectedOrder}
        />
        <CancelOrderModal
          order={cancelConfirmation}
          saving={actingOrderId === cancelConfirmation?.id}
          onClose={() => setCancelConfirmation(null)}
          onConfirm={async (order) => { await runOrderAction(order.id, "cancel"); setCancelConfirmation(null); }}
        />
        <ReturnItemModal
          request={returnConfirmation}
          reason={returnReason}
          saving={Boolean(actingReturnItemId)}
          onReasonChange={setReturnReason}
          onClose={() => { if (!actingReturnItemId) setReturnConfirmation(null); }}
          onConfirm={() => runReturnItem(returnConfirmation?.order, returnConfirmation?.item)}
        />
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-7xl space-y-6 px-4 py-10">
      <Link className="btn-secondary inline-flex" to="/profile"><ArrowLeft size={17} /> Back to Profile</Link>
      <div>
        <p className="text-sm font-bold uppercase tracking-wide text-clay">Orders</p>
        <h1 className="text-4xl font-black">Order history</h1>
      </div>
      {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">{error}</p>}
      {success && <p className="rounded-md bg-clay/10 p-3 text-sm font-semibold text-clay">{success}</p>}
      {loading ? <p>Loading orders...</p> : <OrderTable orders={orders} onViewDetails={openOrderDetails} onCancel={["user", "admin"].includes(user.role) ? (id) => runOrderAction(id, "cancel") : undefined} onReturnItem={["user", "admin"].includes(user.role) ? (order, item) => { setReturnConfirmation({ order, item }); setReturnReason(""); } : undefined} actingOrderId={actingOrderId} actingReturnItemId={actingReturnItemId} />}
      <ReturnItemModal
        request={returnConfirmation}
        reason={returnReason}
        saving={Boolean(actingReturnItemId)}
        onReasonChange={setReturnReason}
        onClose={() => { if (!actingReturnItemId) setReturnConfirmation(null); }}
        onConfirm={() => runReturnItem(returnConfirmation?.order, returnConfirmation?.item)}
      />
    </section>
  );
}

function OrderDetails({ order, loading, canCancel, acting, onCancel, onReturnItem, actingReturnItemId }) {
  const timeline = order.timeline?.length ? order.timeline : [{
    id: "fallback",
    statusName: "order placed",
    createdAt: order.createdAt,
    actorRole: "system",
    note: "Order placed"
  }];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-clay">Order details</p>
          <h1 className="break-all text-3xl font-black">Order #{order.id}</h1>
          <p className="mt-1 text-sm text-neutral-500">{new Date(order.createdAt).toLocaleString()}{loading ? " - Refreshing..." : ""}</p>
        </div>
        <span className={`badge ${statusClass(order.returnStatus && order.returnStatus !== "none" ? order.returnStatus : order.status)}`}>
          {order.returnStatus && order.returnStatus !== "none" ? `Return ${order.returnStatus}` : order.status}
        </span>
      </div>

      {canCancel && <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <div>
          <p className="text-sm text-neutral-500">Current status</p>
          <p className="font-black capitalize">{order.status}</p>
        </div>
        <button className="btn-secondary text-red-600" disabled={acting} onClick={onCancel} type="button">{acting ? "Cancelling..." : "Cancel Order"}</button>
      </div>}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Info label="Customer" value={order.customerName} />
        <Info label="Contact number" value={order.phoneNumber || "Not provided"} />
        <Info label="Payment method" value={order.paymentMethod === "cod" ? "Cash on delivery" : order.paymentMethod} />
        <Info label="Payment status" value={order.paymentStatus} />
      </div>
      <Info label="Delivery address" value={order.deliveryAddress || "Not provided"} />

      <section className="space-y-3">
        <h2 className="text-2xl font-black">Ordered products</h2>
        <div className="divide-y divide-neutral-200 overflow-hidden rounded-lg border border-neutral-200 bg-white dark:divide-neutral-800 dark:border-neutral-800 dark:bg-neutral-900">
          {order.items?.map((item) => (
            <div className="grid gap-3 p-4 md:grid-cols-[72px_minmax(0,1fr)_auto]" key={item.id}>
              <ProductImage className="h-24 w-20 rounded bg-neutral-100 object-contain dark:bg-neutral-950" src={item.imageUrl} alt={item.name} />
              <div className="min-w-0">
                <p className="font-black">{item.name}</p>
                <p className="text-sm text-neutral-500">{item.vendorName || item.brand || "VASTRA Vendor"}</p>
                <p className="mt-1 text-sm text-neutral-500">{item.selectedSize ? `Size ${item.selectedSize}` : "Size not selected"} - {item.selectedColor || "Color not selected"} - Quantity {item.quantity}</p>
                {item.returnStatus && item.returnStatus !== "none" && (
                  <p className="mt-2 rounded-md bg-clay/10 p-2 text-sm text-clay">
                    Return {item.returnStatus}{item.returnReason ? ` - ${item.returnReason}` : ""}{item.returnVendorResponse ? ` - Vendor: ${item.returnVendorResponse}` : ""}
                  </p>
                )}
                {order.status === "delivered" && (!item.returnStatus || item.returnStatus === "none") && (() => {
                  const deliveredAt = order.deliveredAt ? new Date(order.deliveredAt).getTime() : 0;
                  const open = deliveredAt && Date.now() - deliveredAt <= 7 * 24 * 60 * 60 * 1000;
                  return open ? <button className="btn-secondary mt-3 h-9 px-3" disabled={actingReturnItemId === item.id} onClick={() => onReturnItem(item)} type="button">{actingReturnItemId === item.id ? "Submitting..." : "Return Item"}</button> : null;
                })()}
              </div>
              <div className="text-left md:text-right">
                <p className="font-semibold">{money(item.priceAtPurchase)} each</p>
                <p className="text-sm text-neutral-500">{money(item.priceAtPurchase * item.quantity)} total</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Info label="Subtotal" value={money(order.subtotalAmount)} />
        <Info label="Shipping" value={money(order.shippingFee || 0)} />
        <Info label="Discount" value={order.discountAmount > 0 ? `${money(order.discountAmount)}${order.couponCode ? ` (${order.couponCode})` : ""}` : "No discount"} />
        <Info label="Final total" value={money(order.totalAmount)} />
      </div>

      <section className="space-y-3">
        <h2 className="text-2xl font-black">Status timeline</h2>
        <div className="space-y-3">
          {timeline.map((entry) => (
            <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900" key={entry.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-black capitalize">{entry.statusName || entry.status}</p>
                  <p className="text-sm text-neutral-500">{entry.actorName || entry.actorRole ? `Updated by ${entry.actorName || entry.actorRole}` : "System update"}</p>
                </div>
                <p className="text-sm text-neutral-500">{entry.createdAt ? new Date(entry.createdAt).toLocaleString() : "Time unavailable"}</p>
              </div>
              {entry.note && <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">{entry.note}</p>}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function CancelOrderModal({ order, saving, onClose, onConfirm }) {
  if (!order) return null;
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 backdrop-blur-sm" onPointerDown={(event) => event.target === event.currentTarget && !saving && onClose()}>
    <div aria-labelledby="user-cancel-title" aria-modal="true" className="panel w-full max-w-md space-y-5 shadow-2xl" role="dialog" onPointerDown={(event) => event.stopPropagation()}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-200"><AlertTriangle size={22} /></span>
          <div><p className="text-sm font-bold uppercase tracking-wide text-clay">Cancel order</p><h2 className="mt-1 text-2xl font-black" id="user-cancel-title">Cancel this order?</h2></div>
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

function ReturnItemModal({ request, reason, saving, onReasonChange, onClose, onConfirm }) {
  if (!request) return null;
  const { item } = request;
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 backdrop-blur-sm" onPointerDown={(event) => event.target === event.currentTarget && !saving && onClose()}>
    <div aria-labelledby="return-item-title" aria-modal="true" className="panel w-full max-w-lg space-y-5 shadow-2xl" role="dialog" onPointerDown={(event) => event.stopPropagation()}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-clay/10 text-clay"><AlertTriangle size={22} /></span>
          <div><p className="text-sm font-bold uppercase tracking-wide text-clay">Return Item</p><h2 className="mt-1 text-2xl font-black" id="return-item-title">Return this item?</h2></div>
        </div>
        <button aria-label="Close" className="btn-secondary h-9 w-9 px-0" disabled={saving} onClick={onClose} type="button"><X size={16} /></button>
      </div>
      <p className="leading-7 text-neutral-600 dark:text-neutral-300">Are you sure you want to request a return for this item? This action will notify the vendor for review.</p>
      <div className="flex gap-3 rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
        <ProductImage className="h-24 w-20 shrink-0 rounded bg-neutral-100 object-contain dark:bg-neutral-950" src={item.imageUrl} alt={item.name} />
        <div className="min-w-0">
          <p className="font-black">{item.name}</p>
          <p className="mt-1 text-sm text-neutral-500">{item.selectedSize ? `Size ${item.selectedSize}` : "Size not selected"} - {item.selectedColor || "Color not selected"}</p>
          <p className="mt-1 text-sm text-neutral-500">Quantity {item.quantity}</p>
        </div>
      </div>
      <label className="block space-y-1 text-sm font-semibold">Return reason<textarea className="w-full" rows="4" value={reason} onChange={(event) => onReasonChange(event.target.value)} placeholder="Optional" /></label>
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button className="btn-secondary" disabled={saving} onClick={onClose} type="button">Cancel</button>
        <button className="btn-primary" disabled={saving} onClick={onConfirm} type="button">{saving ? "Submitting..." : "Confirm Return"}</button>
      </div>
    </div>
  </div>;
}

function Info({ label, value }) {
  return <div className="rounded-lg border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900"><p className="text-xs font-bold uppercase tracking-wide text-neutral-500">{label}</p><p className="mt-1 break-words font-semibold capitalize">{value || "Not provided"}</p></div>;
}
