import React from "react";
import { ProductImage } from "./ProductImage.jsx";
import { money, statusClass } from "../utils/format.js";

const statusOptions = ["pending", "processing", "shipped", "delivered", "cancelled"];

export function OrderTable({ orders, onStatusChange }) {
  if (!orders.length) return <div className="panel py-10 text-center text-neutral-500">No orders yet.</div>;
  const showStatusActions = Boolean(onStatusChange && orders.some((order) => !["delivered", "cancelled"].includes(order.status)));

  return (
    <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-neutral-100 text-xs uppercase text-neutral-500 dark:bg-neutral-800">
            <tr>
              <th className="px-4 py-3">Order</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Items</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3">Status</th>
              {showStatusActions && <th className="px-4 py-3">Update delivery</th>}
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
                <td className="px-4 py-3"><span className={`badge ${statusClass(order.status)}`}>{order.status}</span></td>
                {showStatusActions && (
                  <td className="px-4 py-3">
                    {!['delivered', 'cancelled'].includes(order.status) && (
                      <select aria-label={`Change status for order ${order.id}`} className="min-w-36" value={order.status} onChange={(event) => onStatusChange(order.id, event.target.value)}>
                        {statusOptions.map((status) => <option value={status} key={status}>{status}</option>)}
                      </select>
                    )}
                  </td>
                )}
                <td className="px-4 py-3">{new Date(order.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
