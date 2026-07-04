import React, { useState } from "react";
import { ProductImage } from "./ProductImage.jsx";
import { StatusConfirmModal } from "./StatusConfirmModal.jsx";
import { money, statusClass } from "../utils/format.js";

const statusOptions = ["pending", "processing", "shipped", "delivered", "cancelled"];

export function OrderTable({ orders, onStatusChange, onCancel, onReturn, actingOrderId = "" }) {
  const [statusChange, setStatusChange] = useState(null);
  if (!orders.length) return <div className="panel py-10 text-center text-neutral-500">No orders yet.</div>;
  const showStatusActions = Boolean(onStatusChange && orders.some((order) => !["delivered", "cancelled"].includes(order.status)));
  const showUserActions = Boolean(onCancel || onReturn);

  return (
    <>
    <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="bg-neutral-100 text-xs uppercase text-neutral-500 dark:bg-neutral-800">
            <tr>
              <th className="px-4 py-3">Order</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Items</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Payment</th>
              {showStatusActions && <th className="px-4 py-3">Update delivery</th>}
              {showUserActions && <th className="px-4 py-3">Actions</th>}
              <th className="px-4 py-3">Date</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr className="border-t border-neutral-200 dark:border-neutral-800" key={order.id}>
                <td className="px-4 py-3 font-mono text-xs">{order.id.slice(0, 8)}</td>
                <td className="px-4 py-3">{order.customerName || "You"}</td>
                <td className="px-4 py-3">
                  <div className="space-y-2">
                    {order.items?.map((item) => (
                      <div className="flex items-center gap-3" key={item.id}>
                        <ProductImage className="h-10 w-8 rounded object-cover" src={item.imageUrl} alt={item.name} />
                        <span>{item.name}{item.selectedSize ? ` · ${item.selectedSize}` : ""}{item.selectedColor ? ` · ${item.selectedColor}` : ""} x{item.quantity}</span>
                      </div>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3 font-semibold">{money(order.totalAmount)}</td>
                <td className="px-4 py-3"><span className={`badge ${statusClass(order.status)}`}>{order.status}</span>{order.returnStatus && order.returnStatus !== "none" && <p className="mt-2 text-xs font-semibold capitalize text-clay">Return {order.returnStatus}</p>}</td>
                <td className="px-4 py-3"><p className="font-semibold capitalize">{order.paymentMethod === "cod" ? "Cash on delivery" : order.paymentMethod}</p><p className="text-xs capitalize text-neutral-500">{order.status === "cancelled" ? "Order Cancelled" : order.paymentStatus}</p></td>
                {showStatusActions && (
                  <td className="px-4 py-3">
                    {!['delivered', 'cancelled'].includes(order.status) && (
                      <select aria-label={`Change status for order ${order.id}`} className="min-w-36" value={order.status} onChange={(event) => event.target.value !== order.status && setStatusChange({ orderId: order.id, from: order.status, to: event.target.value })}>
                        {statusOptions.map((status) => <option value={status} key={status}>{status}</option>)}
                      </select>
                    )}
                  </td>
                )}
                {showUserActions && <td className="px-4 py-3">
                  <div className="flex min-w-36 flex-col items-start gap-2">
                    {["pending", "processing"].includes(order.status) && <button className="btn-secondary h-9 px-3" disabled={actingOrderId === order.id} onClick={() => onCancel(order.id)} type="button">Cancel Order</button>}
                    {order.status === "delivered" && order.returnStatus === "none" && (() => {
                      const deliveredAt = order.deliveredAt ? new Date(order.deliveredAt).getTime() : 0;
                      const open = deliveredAt && Date.now() - deliveredAt <= 7 * 24 * 60 * 60 * 1000;
                      return open
                        ? <button className="btn-secondary h-9 px-3" disabled={actingOrderId === order.id} onClick={() => onReturn(order.id)} type="button">Return Order</button>
                        : <span className="text-xs text-neutral-500">Return window closed</span>;
                    })()}
                    {order.returnStatus && order.returnStatus !== "none" && <span className="text-xs font-semibold capitalize text-clay">Return {order.returnStatus}</span>}
                  </div>
                </td>}
                <td className="px-4 py-3">{new Date(order.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
    <StatusConfirmModal change={statusChange} onCancel={() => setStatusChange(null)} onConfirm={({ orderId, to }) => onStatusChange(orderId, to)} />
    </>
  );
}
