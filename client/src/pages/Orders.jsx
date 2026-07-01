import React, { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { api, getErrorMessage } from "../api/client.js";
import { OrderTable } from "../components/OrderTable.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useMessages } from "../context/MessageContext.jsx";

export function Orders() {
  const { user } = useAuth();
  const { socket } = useMessages();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadOrders() {
    const { data } = await api.get("/orders");
    setOrders(data.orders);
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

  async function updateStatus(orderId, status) {
    setError("");
    try {
      await api.patch(`/admin/orders/${orderId}/status`, { status });
      await loadOrders();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  return (
    <section className="mx-auto max-w-7xl space-y-6 px-4 py-10">
      <Link className="btn-secondary inline-flex" to="/profile"><ArrowLeft size={17} /> Back to Profile</Link>
      <div>
        <p className="text-sm font-bold uppercase tracking-wide text-clay">Orders</p>
        <h1 className="text-4xl font-black">Order history</h1>
      </div>
      {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">{error}</p>}
      {loading ? <p>Loading orders...</p> : <OrderTable orders={orders} onStatusChange={user.role === "admin" ? updateStatus : undefined} />}
    </section>
  );
}
