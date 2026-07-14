import { Check } from "lucide-react";
import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, getErrorMessage } from "../api/client.js";
import { money } from "../utils/format.js";

export function OrderSuccess() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get(`/orders/${id}`).then(({ data }) => setOrder(data.order)).catch((err) => setError(getErrorMessage(err)));
  }, [id]);

  return (
    <section className="mx-auto max-w-2xl px-4 py-14">
      <div className="panel space-y-5 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-clay/10 text-clay"><Check size={28} /></div>
        {order?.paymentMethod === "card" && <p className="text-sm font-bold uppercase tracking-wide text-clay">Payment successful</p>}
        <h1 className="text-3xl font-black">Order placed successfully</h1>
        {error ? <p className="text-sm text-red-600">{error}</p> : order ? (
          <div className="space-y-2 text-neutral-500">
            <p>Order #{order.id.slice(0, 8)} is confirmed.</p>
            <p className="font-semibold text-ink dark:text-neutral-100">{money(order.totalAmount)}</p>
            <p>{order.paymentMethod === "card" ? "Your payment receipt has been queued for email." : "Your receipt will be emailed after payment is collected on delivery."}</p>
          </div>
        ) : <p className="text-neutral-500">Loading order summary...</p>}
        <div className="flex justify-center gap-3">
          <Link className="btn-secondary" to="/orders">View order</Link>
          <Link className="btn-primary" to="/">Back to Home</Link>
        </div>
      </div>
    </section>
  );
}
