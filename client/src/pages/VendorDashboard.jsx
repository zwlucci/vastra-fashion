import { AlertTriangle, Banknote, Boxes, PackageCheck, Plus, RotateCcw, X } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { NavLink, Navigate, useParams } from "react-router-dom";
import { api, getErrorMessage } from "../api/client.js";
import { ProductForm } from "../components/ProductForm.jsx";
import { ProductImage } from "../components/ProductImage.jsx";
import { VendorOrderTable } from "../components/VendorOrderTable.jsx";
import { VendorProductTable } from "../components/VendorProductTable.jsx";
import { money } from "../utils/format.js";
import { useMessages } from "../context/MessageContext.jsx";

const vendorSections = [["income", "Income", Banknote], ["products", "Products", Boxes], ["orders", "Orders for Your Products", PackageCheck], ["returned-products", "Returned Products", RotateCcw]];

function Pagination({ page, total, onChange }) {
  const pages = Math.max(1, Math.ceil(total / 10));
  if (pages <= 1) return null;
  return <div className="mt-4 flex items-center justify-between gap-3"><p className="text-sm text-neutral-500">Page {page} of {pages}</p><div className="flex gap-2"><button className="btn-secondary" disabled={page <= 1} onClick={() => onChange(page - 1)} type="button">Previous</button><button className="btn-secondary" disabled={page >= pages} onClick={() => onChange(page + 1)} type="button">Next</button></div></div>;
}

export function VendorDashboard() {
  const { section = "income" } = useParams();
  const validSection = vendorSections.some(([key]) => key === section);
  const { socket } = useMessages();
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [returns, setReturns] = useState([]);
  const [returnMeta, setReturnMeta] = useState(null);
  const [dashboardUpdates, setDashboardUpdates] = useState({});
  const [income, setIncome] = useState({ totalIncome: 0, totalOrders: 0, totalItems: 0, recentOrders: [] });
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState("");
  const [deletingProduct, setDeletingProduct] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const productFormRef = useRef(null);
  const [productPage, setProductPage] = useState(1);
  const [orderPage, setOrderPage] = useState(1);
  const [returnPage, setReturnPage] = useState(1);
  const [returnDecision, setReturnDecision] = useState(null);
  const [returnReason, setReturnReason] = useState("");
  const [savingReturn, setSavingReturn] = useState(false);

  async function loadProducts() {
    const { data } = await api.get("/vendor/products");
    setProducts(data.products);
  }

  async function loadOrders() {
    const { data } = await api.get("/vendor/orders");
    setOrders(data.orders);
  }

  async function loadReturns(page = returnPage) {
    const { data } = await api.get(`/vendor/returns?page=${page}&limit=10`);
    setReturns(data.returns || []);
    setReturnMeta(data.meta || null);
  }

  async function loadDashboardUpdates() {
    const { data } = await api.get("/vendor/dashboard-updates");
    setDashboardUpdates(data.updates || {});
  }

  async function loadIncome() {
    const { data } = await api.get("/vendor/income");
    setIncome(data.income);
  }

  useEffect(() => {
    Promise.all([loadProducts(), loadOrders(), loadIncome(), loadReturns(), loadDashboardUpdates()]);
  }, []);

  useEffect(() => { setProductPage(1); setOrderPage(1); setReturnPage(1); api.patch(`/vendor/dashboard-updates/${section}/seen`).then(({ data }) => setDashboardUpdates(data.updates || {})).catch(() => {}); }, [section]);
  useEffect(() => { if (section === "returned-products") loadReturns(returnPage).catch(() => {}); }, [returnPage, section]);

  useEffect(() => {
    if (editing && showForm) productFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [editing, showForm]);

  useEffect(() => {
    if (!socket) return undefined;
    const refreshProducts = () => loadProducts().catch(() => {});
    const refreshOrders = () => Promise.all([loadOrders(), loadIncome()]).catch(() => {});
    function handleDashboardUpdate({ scope }) {
      if (scope === "products") refreshProducts();
      if (scope === "orders") { refreshOrders(); loadReturns().catch(() => {}); loadDashboardUpdates().catch(() => {}); }
    }
    socket.on("dashboard:updated", handleDashboardUpdate);
    return () => {
      socket.off("dashboard:updated", handleDashboardUpdate);
    };
  }, [socket]);

  async function submitProduct(payload) {
    setMessage("");
    try {
      if (editing) {
        await api.put(`/products/${editing.id}`, payload);
        setMessage("Product updated.");
      } else {
        await api.post("/products", payload);
        setMessage("Product submitted for approval.");
      }
      setEditing(null);
      setShowForm(false);
      await loadProducts();
    } catch (error) {
      setMessage(getErrorMessage(error));
    }
  }

  function requestDeleteProduct(id) {
    const product = products.find((item) => item.id === id);
    setDeletingProduct(product || { id, name: "this product" });
  }

  function beginEditProduct(product) {
    setMessage("");
    setEditing(product);
    setShowForm(true);
  }

  async function confirmDeleteProduct() {
    if (!deletingProduct) return;
    setDeleting(true);
    setMessage("");
    try {
      await api.delete(`/products/${deletingProduct.id}`);
      setProducts((current) => current.filter((product) => product.id !== deletingProduct.id));
      setDeletingProduct(null);
      setMessage("Product deleted.");
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setDeleting(false);
    }
  }

  async function updateOrderStatus(id, status) {
    setMessage("");
    try {
      await api.patch(`/vendor/orders/${id}/status`, { status });
      setMessage("Delivery status updated.");
      await Promise.all([loadOrders(), loadIncome()]);
    } catch (error) {
      setMessage(getErrorMessage(error));
    }
  }

  function startReturnDecision(order, status) {
    setReturnDecision({ order, status });
    setReturnReason("");
    setMessage("");
  }

  async function submitReturnDecision() {
    if (!returnDecision) return;
    if (returnReason.trim().length < 5) {
      setMessage("Add a reason with at least 5 characters.");
      return;
    }
    setSavingReturn(true);
    setMessage("");
    try {
      await api.patch(`/vendor/returns/${returnDecision.order.id}/decision`, { status: returnDecision.status, reason: returnReason.trim() });
      setMessage(`Return ${returnDecision.status === "approved" ? "accepted" : "rejected"}.`);
      setReturnDecision(null);
      await Promise.all([loadReturns(returnPage), loadOrders(), loadDashboardUpdates()]);
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setSavingReturn(false);
    }
  }

  if (!validSection) return <Navigate to="/vendor/dashboard/income" replace />;
  const sectionTitle = vendorSections.find(([key]) => key === section)?.[1];
  const pagedProducts = products.slice((productPage - 1) * 10, productPage * 10);
  const pagedOrders = orders.slice((orderPage - 1) * 10, orderPage * 10);

  return (
    <section className="mx-auto max-w-7xl space-y-6 px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-clay">Vendor</p>
          <h1 className="text-4xl font-black">Vendor Dashboard</h1>
        </div>
        {section === "products" && <button className="btn-primary" onClick={() => { setEditing(null); setShowForm((value) => !value); }} type="button">
          <Plus size={18} /> Add product
        </button>}
      </div>
      {message && <p className="rounded-md bg-clay/10 p-3 text-sm text-clay">{message}</p>}
      <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside><nav aria-label="Vendor dashboard sections" className="flex gap-2 overflow-x-auto rounded-xl border border-neutral-200 bg-white p-2 dark:border-neutral-800 dark:bg-neutral-900 lg:sticky lg:top-24 lg:flex-col">{vendorSections.map(([key, label, Icon]) => <NavLink className={({ isActive }) => `relative flex shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 pr-8 text-sm font-bold transition ${isActive ? "bg-clay text-white" : "hover:bg-neutral-100 dark:hover:bg-neutral-800"}`} key={key} to={`/vendor/dashboard/${key}`}><Icon size={17} />{label}{dashboardUpdates[key] > 0 && <span className="absolute right-3 h-2.5 w-2.5 rounded-full bg-red-500" aria-label={`${dashboardUpdates[key]} unseen updates`} />}</NavLink>)}</nav></aside>
        <main className="min-w-0 space-y-5">
          <div><p className="text-sm font-bold uppercase tracking-wide text-clay">Dashboard section</p><h2 className="text-3xl font-black">{sectionTitle}</h2></div>
      {section === "products" && (showForm || editing) && <div className="scroll-mt-24" ref={productFormRef}><ProductForm initialProduct={editing} onSubmit={submitProduct} submitLabel={editing ? "Update product" : "Submit product"} /></div>}
      {section === "income" && <div className="space-y-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-clay">Income</p>
          <h2 className="text-2xl font-black">Delivered sales</h2>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">Income counts delivered orders for your products only.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="panel">
            <p className="text-sm text-neutral-500">Total income</p>
            <p className="mt-1 text-3xl font-black">{money(income.totalIncome)}</p>
          </div>
          <div className="panel">
            <p className="text-sm text-neutral-500">Delivered orders</p>
            <p className="mt-1 text-3xl font-black">{income.totalOrders}</p>
          </div>
          <div className="panel">
            <p className="text-sm text-neutral-500">Items sold</p>
            <p className="mt-1 text-3xl font-black">{income.totalItems}</p>
          </div>
        </div>
        <div className="panel">
          <h3 className="text-xl font-black">Recent income</h3>
          {income.recentOrders?.length ? (
            <div className="mt-4 divide-y divide-neutral-200 dark:divide-neutral-800">
              {income.recentOrders.map((order) => (
                <div className="flex flex-wrap items-center justify-between gap-3 py-3" key={order.id}>
                  <div>
                    <p className="font-semibold">{order.customerName}</p>
                    <p className="text-xs text-neutral-500">{order.id.slice(0, 8)} · {new Date(order.createdAt).toLocaleDateString()}</p>
                  </div>
                  <p className="font-black">{money(order.amount)}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-neutral-500">No delivered income yet.</p>
          )}
        </div>
      </div>}
      {section === "products" && <div><VendorProductTable products={pagedProducts} onEdit={beginEditProduct} onDelete={requestDeleteProduct} /><Pagination page={productPage} total={products.length} onChange={setProductPage} /></div>}
      {section === "orders" && <div className="space-y-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-clay">Delivery</p>
          <h2 className="text-2xl font-black">Orders for your products</h2>
        </div>
        <VendorOrderTable orders={pagedOrders} onStatusChange={updateOrderStatus} />
        <Pagination page={orderPage} total={orders.length} onChange={setOrderPage} />
      </div>}
      {section === "returned-products" && <ReturnedProducts returns={returns} meta={returnMeta} page={returnPage} setPage={setReturnPage} onDecision={startReturnDecision} />}
        </main>
      </div>
      {deletingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 backdrop-blur-sm">
          <div className="panel w-full max-w-md space-y-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-200">
                  <AlertTriangle size={22} />
                </span>
                <div>
                  <p className="text-sm font-bold uppercase tracking-wide text-clay">Confirm deletion</p>
                  <h2 className="mt-1 text-2xl font-black">Delete product?</h2>
                </div>
              </div>
              <button className="btn-secondary h-9 w-9 px-0" disabled={deleting} onClick={() => setDeletingProduct(null)} type="button" title="Close">
                <X size={16} />
              </button>
            </div>
            <p className="leading-7 text-neutral-600 dark:text-neutral-300">
              You are about to delete <span className="font-bold text-ink dark:text-neutral-100">{deletingProduct.name}</span>. This action cannot be undone.
            </p>
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button className="btn-secondary" disabled={deleting} onClick={() => setDeletingProduct(null)} type="button">Cancel</button>
              <button className="btn-primary bg-red-600 hover:bg-red-700 dark:bg-red-600 dark:text-white dark:hover:bg-red-700" disabled={deleting} onClick={confirmDeleteProduct} type="button">
                {deleting ? "Deleting..." : "Delete product"}
              </button>
            </div>
          </div>
        </div>
      )}
      {returnDecision && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 backdrop-blur-sm">
          <div className="panel w-full max-w-lg space-y-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-bold uppercase tracking-wide text-clay">Return decision</p>
                <h2 className="mt-1 text-2xl font-black">{returnDecision.status === "approved" ? "Accept return" : "Reject return"}</h2>
              </div>
              <button className="btn-secondary h-9 w-9 px-0" disabled={savingReturn} onClick={() => setReturnDecision(null)} type="button" title="Close"><X size={16} /></button>
            </div>
            <p className="text-sm text-neutral-500">Order #{returnDecision.order.id.slice(0, 8)} · {returnDecision.order.items?.map((item) => item.name).join(", ")}</p>
            <label className="block space-y-1 text-sm font-semibold">Reason<textarea className="w-full" rows="5" value={returnReason} onChange={(event) => setReturnReason(event.target.value)} /></label>
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button className="btn-secondary" disabled={savingReturn} onClick={() => setReturnDecision(null)} type="button">Cancel</button>
              <button className="btn-primary" disabled={savingReturn || returnReason.trim().length < 5} onClick={submitReturnDecision} type="button">{savingReturn ? "Saving..." : "Confirm decision"}</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function ReturnedProducts({ returns, meta, page, setPage, onDecision }) {
  if (!returns.length) return <div className="panel py-10 text-center text-neutral-500">No returned products need attention.</div>;
  const totalPages = meta?.totalPages || 1;
  return <div className="space-y-4">
    <div><p className="text-sm font-bold uppercase tracking-wide text-clay">Returns</p><h2 className="text-2xl font-black">Returned Products</h2></div>
    <div className="grid gap-4 xl:grid-cols-2">
      {returns.map((order) => <article className="panel space-y-4" key={order.id}>
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-mono text-xs text-neutral-500">ORDER #{order.id.slice(0, 8)}</p><h3 className="text-lg font-black">{order.customerName}</h3><p className="text-xs text-neutral-500">{order.customerEmail}</p></div><span className="badge bg-clay/10 text-clay">Return {order.returnStatus}</span></div>
        <div className="divide-y divide-neutral-200 rounded-lg border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
          {order.items?.map((item) => <div className="flex gap-3 p-3" key={item.id}><ProductImage className="h-20 w-16 shrink-0 rounded bg-neutral-100 object-contain dark:bg-neutral-950" src={item.imageUrl} alt={item.name} /><div className="min-w-0"><p className="font-bold">{item.name}</p><p className="text-sm text-neutral-500">{item.selectedSize ? `Size ${item.selectedSize} · ` : ""}{item.selectedColor ? `${item.selectedColor} · ` : ""}Quantity {item.quantity}</p><p className="font-semibold">{money(item.priceAtPurchase * item.quantity)}</p></div></div>)}
        </div>
        <div className="grid gap-3 text-sm sm:grid-cols-2"><Info label="Delivered" value={order.deliveredAt ? new Date(order.deliveredAt).toLocaleDateString() : "Not available"} /><Info label="Requested" value={order.returnRequestedAt ? new Date(order.returnRequestedAt).toLocaleDateString() : "Not available"} /><Info label="Reason" value={order.returnReason || "No reason provided"} /><Info label="Order total" value={money(order.totalAmount)} /></div>
        {order.returnVendorReason && <p className="rounded-lg bg-clay/10 p-3 text-sm"><strong>Vendor reason:</strong> {order.returnVendorReason}</p>}
        {order.returnStatus === "requested" && <div className="flex flex-wrap gap-2"><button className="btn-primary" onClick={() => onDecision(order, "approved")} type="button">Accept Return</button><button className="btn-secondary text-red-600" onClick={() => onDecision(order, "rejected")} type="button">Reject Return</button></div>}
      </article>)}
    </div>
    {totalPages > 1 && <Pagination page={page} total={meta.total} onChange={setPage} />}
  </div>;
}

function Info({ label, value }) {
  return <div className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800"><p className="text-xs font-bold uppercase tracking-wide text-neutral-500">{label}</p><p className="mt-1 break-words font-semibold">{value}</p></div>;
}
