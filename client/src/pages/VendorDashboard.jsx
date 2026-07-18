import { AlertTriangle, Banknote, Boxes, PackageCheck, PackagePlus, Plus, RotateCcw, X } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { NavLink, Navigate, useParams } from "react-router-dom";
import { api, getErrorMessage } from "../api/client.js";
import { ProductForm } from "../components/ProductForm.jsx";
import { ProductImage } from "../components/ProductImage.jsx";
import { VendorOrderTable } from "../components/VendorOrderTable.jsx";
import { VendorBundleForm } from "../components/VendorBundleForm.jsx";
import { VendorBundleTable } from "../components/VendorBundleTable.jsx";
import { VendorProductTable } from "../components/VendorProductTable.jsx";
import { money } from "../utils/format.js";
import { useMessages } from "../context/MessageContext.jsx";

const vendorSections = [["income", "Income", Banknote], ["products", "Products", Boxes], ["bundled-products", "Bundled Products", PackagePlus], ["orders", "Orders for Your Products", PackageCheck], ["returned-products", "Returned Products", RotateCcw]];

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
  const [bundles, setBundles] = useState([]);
  const [bundleMeta, setBundleMeta] = useState(null);
  const [bundleIndicators, setBundleIndicators] = useState({});
  const [orders, setOrders] = useState([]);
  const [returns, setReturns] = useState([]);
  const [returnMeta, setReturnMeta] = useState(null);
  const [dashboardUpdates, setDashboardUpdates] = useState({});
  const [income, setIncome] = useState({ totalIncome: 0, totalOrders: 0, totalItems: 0, returnedOrders: 0, inventory: {}, recentOrders: [] });
  const [editing, setEditing] = useState(null);
  const [editingBundle, setEditingBundle] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [showBundleForm, setShowBundleForm] = useState(false);
  const [message, setMessage] = useState("");
  const [deletingProduct, setDeletingProduct] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const productFormRef = useRef(null);
  const bundleFormRef = useRef(null);
  const [productPage, setProductPage] = useState(1);
  const [bundlePage, setBundlePage] = useState(1);
  const [bundleSearch, setBundleSearch] = useState("");
  const [bundleStatus, setBundleStatus] = useState("all");
  const [orderPage, setOrderPage] = useState(1);
  const [returnPage, setReturnPage] = useState(1);
  const [returnDecision, setReturnDecision] = useState(null);
  const [savingReturn, setSavingReturn] = useState(false);
  const [actingOrderId, setActingOrderId] = useState("");

  async function loadProducts() {
    const { data } = await api.get("/vendor/products");
    setProducts(data.products);
  }

  async function loadBundles(page = bundlePage, search = bundleSearch, status = bundleStatus) {
    const params = new URLSearchParams({ page: String(page), limit: "10" });
    if (search.trim()) params.set("search", search.trim());
    if (status !== "all") params.set("status", status);
    const { data } = await api.get(`/vendor/bundled-products?${params.toString()}`);
    setBundles(data.products || []);
    setBundleMeta(data.meta || null);
    setBundleIndicators(data.indicators || {});
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
    Promise.all([loadProducts(), loadBundles(), loadOrders(), loadIncome(), loadReturns(), loadDashboardUpdates()]);
  }, []);

  useEffect(() => { setProductPage(1); setBundlePage(1); setOrderPage(1); setReturnPage(1); api.patch(`/vendor/dashboard-updates/${section}/seen`).then(({ data }) => setDashboardUpdates(data.updates || {})).catch(() => {}); }, [section]);
  useEffect(() => { if (section === "returned-products") loadReturns(returnPage).catch(() => {}); }, [returnPage, section]);
  useEffect(() => { if (section === "bundled-products") loadBundles(bundlePage, bundleSearch, bundleStatus).catch(() => {}); }, [bundlePage, bundleSearch, bundleStatus, section]);

  useEffect(() => {
    if (editing && showForm) productFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [editing, showForm]);

  useEffect(() => {
    if (editingBundle && showBundleForm) bundleFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [editingBundle, showBundleForm]);

  useEffect(() => {
    if (!socket) return undefined;
    const refreshProducts = () => loadProducts().catch(() => {});
    const refreshBundles = () => loadBundles().catch(() => {});
    const refreshOrders = () => Promise.all([loadOrders(), loadIncome()]).catch(() => {});
    let refreshTimer = null;
    const scheduleOrderRefresh = () => {
      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => {
        refreshOrders();
        loadReturns().catch(() => {});
        loadDashboardUpdates().catch(() => {});
      }, 80);
    };
    function handleDashboardUpdate({ scope }) {
      if (scope === "products") {
        refreshProducts();
        refreshBundles();
      }
      if (scope === "bundled-products") refreshBundles();
      if (scope === "orders") scheduleOrderRefresh();
    }
    socket.on("dashboard:updated", handleDashboardUpdate);
    socket.on("order:created", scheduleOrderRefresh);
    socket.on("order:status-updated", scheduleOrderRefresh);
    socket.on("order:user-cancelled", scheduleOrderRefresh);
    socket.on("order:vendor-cancelled", scheduleOrderRefresh);
    socket.on("order:updated", scheduleOrderRefresh);
    return () => {
      window.clearTimeout(refreshTimer);
      socket.off("dashboard:updated", handleDashboardUpdate);
      socket.off("order:created", scheduleOrderRefresh);
      socket.off("order:status-updated", scheduleOrderRefresh);
      socket.off("order:user-cancelled", scheduleOrderRefresh);
      socket.off("order:vendor-cancelled", scheduleOrderRefresh);
      socket.off("order:updated", scheduleOrderRefresh);
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

  async function submitBundle(payload) {
    setMessage("");
    try {
      if (editingBundle) {
        await api.put(`/vendor/bundled-products/${editingBundle.id}`, payload);
        setMessage("Bundle updated.");
      } else {
        await api.post("/vendor/bundled-products", payload);
        setMessage("Bundle submitted for approval.");
      }
      setEditingBundle(null);
      setShowBundleForm(false);
      setBundlePage(1);
      await Promise.all([loadBundles(1), loadProducts()]);
    } catch (error) {
      setMessage(getErrorMessage(error));
    }
  }

  function requestDeleteProduct(id) {
    const product = products.find((item) => item.id === id) || bundles.find((item) => item.id === id);
    setDeletingProduct(product || { id, name: "this product" });
  }

  function beginEditProduct(product) {
    setMessage("");
    setEditing(product);
    setShowForm(true);
  }

  function beginEditBundle(bundle) {
    setMessage("");
    setEditingBundle(bundle);
    setShowBundleForm(true);
  }

  async function confirmDeleteProduct() {
    if (!deletingProduct) return;
    setDeleting(true);
    setMessage("");
    try {
      await api.delete(`/products/${deletingProduct.id}`);
      setProducts((current) => current.filter((product) => product.id !== deletingProduct.id));
      setBundles((current) => current.filter((bundle) => bundle.id !== deletingProduct.id));
      setDeletingProduct(null);
      setMessage(deletingProduct.isBundle ? "Bundle deleted." : "Product deleted.");
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setDeleting(false);
    }
  }

  async function updateOrderStatus(id, status) {
    setMessage("");
    setActingOrderId(id);
    try {
      await api.patch(`/vendor/orders/${id}/status`, { status });
      setMessage("Delivery status updated.");
      await Promise.all([loadOrders(), loadIncome()]);
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setActingOrderId("");
    }
  }

  async function cancelVendorOrder(id) {
    setMessage("");
    setActingOrderId(id);
    try {
      const { data } = await api.patch(`/vendor/orders/${id}/cancel`);
      setMessage(data.message || "Order cancelled.");
      await Promise.all([loadOrders(), loadIncome(), loadDashboardUpdates()]);
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setActingOrderId("");
    }
  }

  function startReturnDecision(request, status) {
    setReturnDecision({ request, status });
    setMessage("");
  }

  async function reportCodRefusal(id, payload) {
    setMessage("");
    setActingOrderId(id);
    try {
      const { data } = await api.patch(`/vendor/orders/${id}/cod-refusal`, payload);
      setMessage(data.message || "COD refusal recorded.");
      await Promise.all([loadOrders(), loadIncome(), loadDashboardUpdates()]);
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setActingOrderId("");
    }
  }

  async function submitReturnDecision() {
    if (!returnDecision) return;
    setSavingReturn(true);
    setMessage("");
    try {
      await api.patch(`/vendor/returns/${returnDecision.request.id}/decision`, { status: returnDecision.status });
      setMessage(`Return ${returnDecision.status === "approved" ? "accepted" : "rejected"}.`);
      setReturns((current) => current.map((request) => request.id === returnDecision.request.id ? { ...request, status: returnDecision.status, decidedAt: new Date().toISOString() } : request));
      setReturnDecision(null);
      await Promise.all([loadReturns(returnPage), loadOrders(), loadIncome(), loadDashboardUpdates()]);
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
        {section === "bundled-products" && <button className="btn-primary" onClick={() => { setEditingBundle(null); setShowBundleForm((value) => !value); }} type="button">
          <PackagePlus size={18} /> Create Bundle
        </button>}
      </div>
      {message && <p className="rounded-md bg-clay/10 p-3 text-sm text-clay">{message}</p>}
      <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside><nav aria-label="Vendor dashboard sections" className="flex gap-2 overflow-x-auto rounded-xl border border-neutral-200 bg-white p-2 dark:border-neutral-800 dark:bg-neutral-900 lg:sticky lg:top-24 lg:flex-col">{vendorSections.map(([key, label, Icon]) => <NavLink className={({ isActive }) => `relative flex shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 pr-8 text-sm font-bold transition ${isActive ? "bg-clay text-white" : "hover:bg-neutral-100 dark:hover:bg-neutral-800"}`} key={key} to={`/vendor/dashboard/${key}`}><Icon size={17} />{label}{dashboardUpdates[key] > 0 && <span className="absolute right-3 h-2.5 w-2.5 rounded-full bg-red-500" aria-label={`${dashboardUpdates[key]} unseen updates`} />}</NavLink>)}</nav></aside>
        <main className="min-w-0 space-y-5">
          <div><p className="text-sm font-bold uppercase tracking-wide text-clay">Dashboard section</p><h2 className="text-3xl font-black">{sectionTitle}</h2></div>
      {section === "products" && (showForm || editing) && <div className="scroll-mt-24" ref={productFormRef}><ProductForm initialProduct={editing} onSubmit={submitProduct} submitLabel={editing ? "Update product" : "Submit product"} /></div>}
      {section === "bundled-products" && (showBundleForm || editingBundle) && <div className="scroll-mt-24" ref={bundleFormRef}><VendorBundleForm products={products} initialBundle={editingBundle} onSubmit={submitBundle} submitLabel={editingBundle ? "Update bundle" : "Create bundle"} /></div>}
      {section === "income" && <div className="space-y-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-clay">Income</p>
          <h2 className="text-2xl font-black">Delivered sales</h2>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">Income counts delivered orders for your products only, minus approved returned items.</p>
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
            <p className="text-sm text-neutral-500">Returned orders</p>
            <p className="mt-1 text-3xl font-black">{income.returnedOrders ?? 0}</p>
          </div>
        </div>
        <div className="panel">
          <h3 className="text-xl font-black">Inventory</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {[["Low stock", income.inventory?.lowStock ?? 0], ["Low-stock bundles", income.inventory?.lowStockBundles ?? 0], ["Out of stock", income.inventory?.outOfStock ?? 0], ["Unavailable bundles", income.inventory?.unavailableBundles ?? 0], ["Recently added products", income.inventory?.recentlyAddedProducts ?? 0]].map(([label, value]) => (
              <div className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800" key={label}>
                <p className="text-xs font-bold uppercase tracking-wide text-neutral-500">{label}</p>
                <p className="mt-1 text-2xl font-black">{value}</p>
              </div>
            ))}
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
      {section === "bundled-products" && <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {[["Pending bundle approvals", bundleIndicators.pending || 0], ["Approved bundles", bundleIndicators.approved || 0], ["Rejected bundles", bundleIndicators.rejected || 0], ["Low-stock bundles", bundleIndicators.low_stock || 0], ["Unavailable bundles", bundleIndicators.unavailable || 0]].map(([label, value]) => <div className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800" key={label}><p className="text-xs font-bold uppercase tracking-wide text-neutral-500">{label}</p><p className="mt-1 text-2xl font-black">{value}</p></div>)}
        </div>
        <div className="flex flex-wrap gap-3 rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
          <input className="min-w-[220px] flex-1" placeholder="Search bundles" value={bundleSearch} onChange={(event) => { setBundleSearch(event.target.value); setBundlePage(1); }} />
          <select className="min-w-[180px]" value={bundleStatus} onChange={(event) => { setBundleStatus(event.target.value); setBundlePage(1); }}>
            <option value="all">All statuses</option>
            <option value="pending">Pending approval</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
        <VendorBundleTable bundles={bundles} onEdit={beginEditBundle} onDelete={requestDeleteProduct} />
        {bundleMeta && <Pagination page={bundlePage} total={bundleMeta.total} onChange={setBundlePage} />}
      </div>}
      {section === "orders" && <div className="space-y-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-clay">Delivery</p>
          <h2 className="text-2xl font-black">Orders for your products</h2>
        </div>
        <VendorOrderTable orders={pagedOrders} onStatusChange={updateOrderStatus} onCancel={cancelVendorOrder} onReportRefusal={reportCodRefusal} actingOrderId={actingOrderId} />
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
            <p className="text-sm text-neutral-500">Order #{returnDecision.request.orderId.slice(0, 8)} - {returnDecision.request.item?.name}</p>
            <div className="rounded-lg border border-neutral-200 p-3 text-sm dark:border-neutral-800">
              <p className="font-bold">Customer return reason</p>
              <ReturnReason request={returnDecision.request} />
            </div>
            <p className="text-sm text-neutral-600 dark:text-neutral-300">
              {returnDecision.status === "approved" ? "Are you sure you want to accept this return request?" : "Are you sure you want to reject this return request?"}
            </p>
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button className="btn-secondary" disabled={savingReturn} onClick={() => setReturnDecision(null)} type="button">Cancel</button>
              <button className="btn-primary" disabled={savingReturn} onClick={submitReturnDecision} type="button">{savingReturn ? "Saving..." : "Confirm decision"}</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function ReturnedProducts({ returns, meta, page, setPage, onDecision }) {
  const [filter, setFilter] = useState("all");
  const filters = ["all", "requested", "approved", "rejected"];
  const filteredReturns = filter === "all" ? returns : returns.filter((request) => request.status === filter);
  if (!returns.length) return <div className="panel py-10 text-center text-neutral-500">No returned products need attention.</div>;
  const totalPages = meta?.totalPages || 1;
  return <div className="space-y-4">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm font-bold uppercase tracking-wide text-clay">Returns</p><h2 className="text-2xl font-black">Returned Products</h2></div><div className="flex flex-wrap gap-2">{filters.map((name) => <button className={`rounded-lg px-3 py-2 text-sm font-bold capitalize ${filter === name ? "bg-clay text-white" : "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"}`} key={name} onClick={() => setFilter(name)} type="button">{name}</button>)}</div></div>
    {!filteredReturns.length && <div className="panel py-8 text-center text-neutral-500">No {filter} return requests on this page.</div>}
    <div className="grid gap-4 xl:grid-cols-2">
      {filteredReturns.map((request) => <article className="panel space-y-4" key={request.id}>
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-mono text-xs text-neutral-500">ORDER #{request.orderId.slice(0, 8)}</p><h3 className="text-lg font-black">{request.customerName}</h3><p className="text-xs text-neutral-500">{request.customerEmail}</p><p className="mt-1 font-mono text-xs text-neutral-500">RETURN #{request.id.slice(0, 8)}</p></div><span className="badge bg-clay/10 text-clay">Return {request.status}</span></div>
        <div className="divide-y divide-neutral-200 rounded-lg border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
          <div className="flex gap-3 p-3"><ProductImage className="h-20 w-16 shrink-0 rounded bg-neutral-100 object-contain dark:bg-neutral-950" src={request.item.imageUrl} alt={request.item.name} /><div className="min-w-0"><p className="font-bold">{request.item.name}</p><p className="text-sm text-neutral-500">{request.item.selectedSize ? `Size ${request.item.selectedSize} - ` : ""}{request.item.selectedColor ? `${request.item.selectedColor} - ` : ""}Quantity {request.item.quantity}</p><p className="text-xs text-neutral-500">{request.item.vendorName || request.item.brand || "Your product"}</p><p className="font-semibold">{money(request.item.priceAtPurchase * request.item.quantity)}</p></div></div>
        </div>
        <div className="grid gap-3 text-sm sm:grid-cols-2"><Info label="Purchased" value={request.orderCreatedAt ? new Date(request.orderCreatedAt).toLocaleDateString() : "Not available"} /><Info label="Delivered" value={request.deliveredAt ? new Date(request.deliveredAt).toLocaleDateString() : "Not available"} /><Info label="Requested" value={request.requestedAt ? new Date(request.requestedAt).toLocaleDateString() : "Not available"} /><Info label="Contact" value={request.phoneNumber || "Not provided"} /><ReturnReasonCard request={request} /><Info label="Order total" value={money(request.totalAmount)} /></div>
        {request.deliveryAddress && <Info label="Delivery address" value={request.deliveryAddress} />}
        {request.status === "requested" && <div className="flex flex-wrap gap-2"><button className="btn-primary" onClick={() => onDecision(request, "approved")} type="button">Accept Return</button><button className="btn-secondary text-red-600" onClick={() => onDecision(request, "rejected")} type="button">Reject Return</button></div>}
      </article>)}
    </div>
    {totalPages > 1 && <Pagination page={page} total={meta.total} onChange={setPage} />}
  </div>;
}

function Info({ label, value }) {
  return <div className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800"><p className="text-xs font-bold uppercase tracking-wide text-neutral-500">{label}</p><p className="mt-1 break-words font-semibold">{value}</p></div>;
}

function ReturnReason({ request }) {
  if (request.customerReasonCategory) {
    return <div className="mt-2 space-y-1">
      <p><span className="font-semibold">Reason:</span> {request.customerReasonCategory}</p>
      {request.customerReasonDetails && <p><span className="font-semibold">Details:</span> {request.customerReasonDetails}</p>}
    </div>;
  }
  return <p className="mt-2">{request.customerReason || "Reason not provided"}</p>;
}

function ReturnReasonCard({ request }) {
  return <div className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
    <p className="text-xs font-bold uppercase tracking-wide text-neutral-500">Reason</p>
    <ReturnReason request={request} />
  </div>;
}
