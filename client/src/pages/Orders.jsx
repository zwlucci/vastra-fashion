import React, { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
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
    const refresh = () => loadOrders().catch(() => {});
    socket.on("order:updated", refresh);
    return () => socket.off("order:updated", refresh);
  }, [socket]);

  async function runOrderAction(orderId, action) {
    setError("");
    setSuccess("");
    setActingOrderId(orderId);
    try {
      const { data } = await api.patch(`/orders/${orderId}/${action}`, action === "return" ? { reason: "" } : {});
      setOrders((current) => current.map((order) => order.id === orderId ? data.order : order));
      setSuccess(data.message);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setActingOrderId("");
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
        <OrderDetails order={selectedOrder} loading={detailsLoading} />
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
      {loading ? <p>Loading orders...</p> : <OrderTable orders={orders} onViewDetails={openOrderDetails} onCancel={["user", "admin"].includes(user.role) ? (id) => runOrderAction(id, "cancel") : undefined} onReturn={["user", "admin"].includes(user.role) ? (id) => runOrderAction(id, "return") : undefined} actingOrderId={actingOrderId} />}
    </section>
  );
}

function OrderDetails({ order, loading }) {
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

function Info({ label, value }) {
  return <div className="rounded-lg border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900"><p className="text-xs font-bold uppercase tracking-wide text-neutral-500">{label}</p><p className="mt-1 break-words font-semibold capitalize">{value || "Not provided"}</p></div>;
}
