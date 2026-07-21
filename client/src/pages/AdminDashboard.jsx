import React, { useCallback, useEffect, useState } from "react";
import { BarChart3, ClipboardList, FileCheck2, Grid2X2, Mail, MessageSquare, PackageCheck, Percent, Shirt, Star, Store, Trash2, UserRound, UserX, X } from "lucide-react";
import { Link, NavLink, Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api, getErrorMessage } from "../api/client.js";
import { AdminCouponManager } from "../components/AdminCouponManager.jsx";
import { AdminProductApprovalTable } from "../components/AdminProductApprovalTable.jsx";
import { AdminUsersTable } from "../components/AdminUsersTable.jsx";
import { AdminOrderHistory } from "../components/AdminOrderHistory.jsx";
import { AdminNewsletterBroadcast } from "../components/AdminNewsletterBroadcast.jsx";
import { AdminVendorApplications } from "../components/AdminVendorApplications.jsx";
import { AdminHomepageCategories } from "../components/AdminHomepageCategories.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useMessages } from "../context/MessageContext.jsx";
import { useNotification } from "../context/NotificationContext.jsx";

const sections = [
  ["stat-viewer", "Stat Viewer", BarChart3],
  ["coupons", "Coupon Management", Percent],
  ["homepage-categories", "Homepage Categories", Grid2X2],
  ["newsletter-broadcast", "Newsletter Broadcast", Mail],
  ["product-approvals", "Product Approvals", PackageCheck],
  ["vendor-applications", "Vendor Applications", FileCheck2],
  ["users", "Users", UserRound],
  ["vendors", "Vendors", Store],
  ["order-history", "Order History", ClipboardList],
  ["contact-messages", "Contact Messages", MessageSquare],
  ["user-reviews", "User Reviews", Star],
  ["product-reviews", "Product Reviews", Star],
  ["vendor-reviews", "Vendor Reviews", Store]
];

const dashboardScopeSections = {
  all: "all",
  coupons: "coupons",
  "homepage-categories": "homepage-categories",
  newsletter: "newsletter-broadcast",
  "newsletter-broadcast": "newsletter-broadcast",
  products: "product-approvals",
  "vendor-applications": "vendor-applications",
  users: "users",
  vendors: "vendors",
  orders: "order-history",
  "contact-messages": "contact-messages",
  "user-reviews": "user-reviews",
  "product-reviews": "product-reviews",
  "vendor-reviews": "vendor-reviews"
};

function MetricSection({ title, metrics }) {
  return <section className="space-y-3"><div className="flex items-center gap-3"><h2 className="text-lg font-black">{title}</h2><div className="h-px flex-1 bg-neutral-200 dark:bg-neutral-800" /></div><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{metrics.map(([label, value]) => <div className="panel min-w-0 p-5" key={label}><p className="text-sm font-semibold text-neutral-500">{label}</p><p className="mt-2 truncate text-2xl font-black" title={String(value ?? "No data yet")}>{value ?? "No data yet"}</p></div>)}</div></section>;
}

function Pager({ meta, page, setPage, noun = "items" }) {
  if (!meta) return null;
  return <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200 pt-4 dark:border-neutral-800"><p className="text-sm text-neutral-500">Page {meta.page} of {meta.totalPages} · {meta.total} {noun}</p><div className="flex gap-2"><button className="btn-secondary" disabled={page <= 1} onClick={() => setPage(page - 1)} type="button">Previous</button><button className="btn-secondary" disabled={page >= meta.totalPages} onClick={() => setPage(page + 1)} type="button">Next</button></div></div>;
}

function EntityReviewList({ type, reviews, meta, loading, page, setPage, onDelete }) {
  if (loading) return <p className="py-8 text-center text-sm text-neutral-500">Loading reviews...</p>;
  return <div>{reviews.map((review) => <article className="border-b border-neutral-200 py-4 first:pt-0 last:border-0 dark:border-neutral-800" key={review.id}><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{review.userName} · {review.rating}/5</p><p className="text-sm text-neutral-500">{type === "product" ? "Product" : "Vendor"}: {review.entityName} · {new Date(review.createdAt).toLocaleDateString()}</p></div><button className="btn-secondary h-9 px-3 text-red-600" onClick={() => onDelete(review)} type="button"><Trash2 size={14} /> Delete</button></div><p className="mt-3 whitespace-pre-wrap text-sm leading-6">{review.body}</p></article>)}{!reviews.length && <p className="py-8 text-center text-sm text-neutral-500">No {type} reviews yet.</p>}<Pager meta={meta} page={page} setPage={setPage} noun="reviews" /></div>;
}

function CodRefusalReviewModal({ review, revocationReason, setRevocationReason, saving, onClose, onRevoke }) {
  if (!review) return null;
  return <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/45 px-4 py-8 backdrop-blur-sm">
    <div className="panel w-full max-w-3xl space-y-5 shadow-2xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-clay">Admin review</p>
          <h2 className="mt-1 text-2xl font-black">COD refusal records</h2>
          <p className="mt-1 text-sm text-neutral-500">{review.user?.name} - {review.user?.email}</p>
        </div>
        <button className="btn-secondary h-9 w-9 px-0" disabled={saving} onClick={onClose} title="Close" type="button"><X size={16} /></button>
      </div>
      <div className="rounded-lg border border-neutral-200 p-3 text-sm dark:border-neutral-800">
        <p className="font-bold">Current COD status: {review.user?.codPolicy?.statusLabel || "Available"}</p>
        <p className="mt-1 text-neutral-500">Active refusals: {review.user?.codPolicy?.activeRefusalCount || 0} of {review.user?.codPolicy?.refusalLimit || 3}</p>
      </div>
      <div className="max-h-[52vh] space-y-3 overflow-y-auto pr-1">
        {review.records.map((record) => <article className="rounded-lg border border-neutral-200 p-4 text-sm dark:border-neutral-800" key={record.id}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-mono text-xs text-neutral-500">ORDER #{record.orderId.slice(0, 8)}</p>
              <h3 className="mt-1 font-black">{record.reason}</h3>
              <p className="mt-1 text-neutral-500">Reported by {record.reportedByVendorName} on {new Date(record.createdAt).toLocaleString()}</p>
            </div>
            <span className={`badge ${record.active ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200" : "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-200"}`}>{record.active ? "Active" : "Revoked"}</span>
          </div>
          {record.additionalDetails && <p className="mt-3 rounded-lg bg-neutral-50 p-3 dark:bg-neutral-950">{record.additionalDetails}</p>}
          {!record.active && <p className="mt-3 text-neutral-500">Revoked by {record.revokedByAdminName || "admin"}: {record.revocationReason}</p>}
          {record.active && <div className="mt-4 space-y-2">
            <label className="block text-sm font-semibold">Admin revocation reason<textarea className="mt-1 w-full" maxLength="800" rows="3" value={revocationReason} onChange={(event) => setRevocationReason(event.target.value)} placeholder="Why is this refusal record incorrect?" /></label>
            <button className="btn-secondary text-red-600" disabled={saving || revocationReason.trim().length < 5} onClick={() => onRevoke(record)} type="button">{saving ? "Revoking..." : "Revoke Record"}</button>
          </div>}
        </article>)}
        {!review.records.length && <p className="rounded-lg border border-dashed border-neutral-300 p-4 text-sm text-neutral-500 dark:border-neutral-700">No COD refusal records for this account.</p>}
      </div>
    </div>
  </div>;
}

function RevokeVendorAccessModal({ vendor, saving, onClose, onConfirm }) {
  if (!vendor) return null;
  return <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/45 px-4 py-8 backdrop-blur-sm">
    <div className="panel w-full max-w-xl space-y-5 shadow-2xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-clay">Vendor access</p>
          <h2 className="mt-1 text-2xl font-black">Revoke Vendor Access</h2>
          <p className="mt-1 break-all text-sm text-neutral-500">{vendor.name} - {vendor.email}</p>
        </div>
        <button className="btn-secondary h-9 w-9 px-0" disabled={saving} onClick={onClose} title="Close" type="button"><X size={16} /></button>
      </div>
      <div className="space-y-3 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
        <p>This vendor will lose access to vendor-specific features, including the vendor dashboard and vendor-only API actions.</p>
        <p>The account will remain active as a normal customer. Order history, wishlist, profile information, and other user-level data will be retained.</p>
        <p>Existing products, bundles, orders, messages, income records, and return records will stay stored. The revoked vendor cannot add or edit products, but admins can continue viewing and managing those products.</p>
      </div>
      <div className="flex flex-wrap justify-end gap-3 border-t border-neutral-200 pt-4 dark:border-neutral-800">
        <button className="btn-secondary" disabled={saving} onClick={onClose} type="button">Cancel</button>
        <button className="btn-primary bg-red-600 hover:bg-red-700" disabled={saving} onClick={onConfirm} type="button"><UserX size={16} /> {saving ? "Revoking..." : "Confirm Revoke"}</button>
      </div>
    </div>
  </div>;
}

export function AdminDashboard() {
  const { section = "stat-viewer" } = useParams();
  const valid = sections.some(([key]) => key === section);
  const { refreshMe } = useAuth();
  const { socket } = useMessages();
  const { showNotice } = useNotification();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [data, setData] = useState({ stats: null, products: [], users: [], vendors: [], orders: [], messages: [], reviews: [], entityReviews: [] });
  const [meta, setMeta] = useState(null);
  const [page, setPage] = useState(1);
  const [vendorPage, setVendorPage] = useState(1);
  const [vendorMeta, setVendorMeta] = useState(null);
  const [orderPage, setOrderPage] = useState(1);
  const [search, setSearch] = useState("");
  const [vendorSearch, setVendorSearch] = useState("");
  const [sort, setSort] = useState("newest");
  const [vendorSort, setVendorSort] = useState("newest");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [dashboardUpdates, setDashboardUpdates] = useState({});
  const [codReview, setCodReview] = useState(null);
  const [codReviewSaving, setCodReviewSaving] = useState(false);
  const [codRevocationReason, setCodRevocationReason] = useState("");
  const [vendorRevocationTarget, setVendorRevocationTarget] = useState(null);
  const [vendorRevocationSaving, setVendorRevocationSaving] = useState(false);

  const loadDashboardUpdates = useCallback(async () => {
    const response = await api.get("/admin/dashboard-updates");
    setDashboardUpdates(response.data.updates || {});
  }, []);

  const markSectionSeen = useCallback(async (sectionKey) => {
    const response = await api.patch(`/admin/dashboard-updates/${sectionKey}/seen`);
    setDashboardUpdates(response.data.updates || {});
  }, []);

  const loadSection = useCallback(async () => {
    if (!valid || ["coupons", "homepage-categories", "newsletter-broadcast", "vendor-applications"].includes(section)) { setLoading(false); return; }
    setLoading(true);
    try {
      if (section === "stat-viewer") { const response = await api.get("/admin/stats"); setData((current) => ({ ...current, stats: response.data.stats })); }
      if (section === "product-approvals") { const response = await api.get("/admin/products"); setData((current) => ({ ...current, products: response.data.products })); }
      if (section === "users") {
        const response = await api.get(`/admin/users?role=user&page=${page}&limit=10&search=${encodeURIComponent(search)}&sort=${sort}`);
        setData((current) => ({ ...current, users: response.data.users }));
        setMeta(response.data.meta);
      }
      if (section === "vendors") {
        const response = await api.get(`/admin/users?role=vendor&page=${vendorPage}&limit=10&search=${encodeURIComponent(vendorSearch)}&sort=${vendorSort}`);
        setData((current) => ({ ...current, vendors: response.data.users }));
        setVendorMeta(response.data.meta);
      }
      if (section === "order-history") { const response = await api.get("/admin/orders"); setData((current) => ({ ...current, orders: response.data.orders || [] })); }
      if (section === "contact-messages") { const response = await api.get(`/admin/contact-messages?page=${page}&limit=5`); setData((current) => ({ ...current, messages: response.data.messages })); setMeta(response.data.meta); }
      if (section === "user-reviews") { const response = await api.get("/admin/reviews"); setData((current) => ({ ...current, reviews: response.data.reviews || [] })); }
      if (["product-reviews", "vendor-reviews"].includes(section)) { const type = section.startsWith("product") ? "product" : "vendor"; const response = await api.get(`/admin/entity-reviews?type=${type}&page=${page}&limit=5`); setData((current) => ({ ...current, entityReviews: response.data.reviews || [] })); setMeta(response.data.meta); }
    } catch (err) { setError(getErrorMessage(err)); } finally { setLoading(false); }
  }, [page, search, section, sort, valid, vendorPage, vendorSearch, vendorSort]);

  useEffect(() => { setPage(1); setVendorPage(1); setOrderPage(1); setMeta(null); setVendorMeta(null); setError(""); markSectionSeen(section).catch(() => {}); }, [markSectionSeen, section]);
  useEffect(() => { if (section !== "order-history") return; const orderId = searchParams.get("orderId"); const index = data.orders.findIndex((order) => order.id === orderId); if (index >= 0) setOrderPage(Math.floor(index / 10) + 1); }, [data.orders, searchParams, section]);
  useEffect(() => { loadSection(); loadDashboardUpdates().catch(() => {}); }, [loadSection, loadDashboardUpdates]);
  useEffect(() => {
    if (!socket) return undefined;
    const refresh = ({ scope } = {}) => {
      const updatedSection = dashboardScopeSections[scope] || scope;
      loadSection();
      if (updatedSection === section || updatedSection === "all") {
        markSectionSeen(section).catch(() => {});
      } else {
        loadDashboardUpdates().catch(() => {});
      }
    };
    socket.on("dashboard:updated", refresh);
    return () => socket.off("dashboard:updated", refresh);
  }, [socket, loadSection, loadDashboardUpdates, markSectionSeen, section]);

  async function decideProduct(id, status, reason) { await api.patch(`/admin/products/${id}/${status}`, status === "reject" ? { reason } : {}); await loadSection(); }
  async function promoteUser(id) { try { await api.patch(`/admin/users/${id}/role`, { role: "vendor" }); setNotice("User promoted to vendor."); await loadSection(); } catch (err) { setError(getErrorMessage(err)); } }
  async function revokeVendorAccess() {
    if (!vendorRevocationTarget) return;
    setVendorRevocationSaving(true);
    setError("");
    setNotice("");
    try {
      const { data: response } = await api.patch(`/admin/users/${vendorRevocationTarget.id}/revoke-vendor-access`);
      setVendorRevocationTarget(null);
      setNotice(response.message || "Vendor access revoked.");
      showNotice("Vendor access revoked.", "success");
      await Promise.all([loadSection(), refreshMe().catch(() => null)]);
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message);
      showNotice(message, "error");
    } finally {
      setVendorRevocationSaving(false);
    }
  }
  async function reviewCodRefusals(user) {
    setCodRevocationReason("");
    setCodReview({ user, records: [] });
    try {
      const { data: response } = await api.get(`/admin/users/${user.id}/cod-refusals`);
      setCodReview(response);
    } catch (err) {
      setError(getErrorMessage(err));
      setCodReview(null);
    }
  }
  async function revokeCodRefusal(record) {
    if (!codReview?.user) return;
    setCodReviewSaving(true);
    try {
      await api.patch(`/admin/users/${codReview.user.id}/cod-refusals/${record.id}/revoke`, { revocationReason: codRevocationReason });
      const { data: response } = await api.get(`/admin/users/${codReview.user.id}/cod-refusals`);
      setCodReview(response);
      setCodRevocationReason("");
      setNotice("COD refusal record revoked.");
      await loadSection();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setCodReviewSaving(false);
    }
  }
  async function toggleReviewPin(review) { await api.patch(`/admin/reviews/${review.id}/pin`, { pinned: !review.pinned }); await loadSection(); }
  async function deleteEntityReview(review) { await api.delete(`/admin/entity-reviews/${review.entityType}/${review.id}`); await loadSection(); }
  async function openContactChat(id) { try { const { data: response } = await api.post(`/admin/contact-messages/${id}/conversation`); navigate(`/messages?conversationId=${response.conversation.id}`); } catch (err) { setError(getErrorMessage(err)); } }

  if (!valid) return <Navigate to="/admin/dashboard/stat-viewer" replace />;
  const title = sections.find(([key]) => key === section)?.[1];
  return <section className="mx-auto max-w-7xl px-4 py-10">
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-bold uppercase tracking-wide text-clay">Admin</p><h1 className="text-4xl font-black">Admin Dashboard</h1></div><Link className="btn-primary" to="/admin/wardrobe"><Shirt size={17} /> Wardrobe dashboard</Link></div>
    {(notice || error) && <p className={`mb-5 rounded-md p-3 text-sm ${error ? "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-200" : "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-200"}`}>{error || notice}</p>}
    <CodRefusalReviewModal review={codReview} revocationReason={codRevocationReason} setRevocationReason={setCodRevocationReason} saving={codReviewSaving} onClose={() => setCodReview(null)} onRevoke={revokeCodRefusal} />
    <RevokeVendorAccessModal vendor={vendorRevocationTarget} saving={vendorRevocationSaving} onClose={() => setVendorRevocationTarget(null)} onConfirm={revokeVendorAccess} />
    <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
      <aside><nav aria-label="Admin dashboard sections" className="flex gap-2 overflow-x-auto rounded-xl border border-neutral-200 bg-white p-2 dark:border-neutral-800 dark:bg-neutral-900 lg:sticky lg:top-24 lg:flex-col">{sections.map(([key, label, Icon]) => <NavLink className={({ isActive }) => `relative flex shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 pr-8 text-sm font-bold transition ${isActive ? "bg-clay text-white" : "hover:bg-neutral-100 dark:hover:bg-neutral-800"}`} key={key} to={`/admin/dashboard/${key}`}><Icon size={17} />{label}{dashboardUpdates[key] > 0 && <span className="absolute right-3 h-2.5 w-2.5 rounded-full bg-red-500" aria-label={`${dashboardUpdates[key]} unseen updates`} />}</NavLink>)}</nav></aside>
      <main className="min-w-0"><div className="mb-5"><p className="text-sm font-bold uppercase tracking-wide text-clay">Dashboard section</p><h2 className="text-3xl font-black">{title}</h2></div>
        {loading ? <p className="panel text-sm text-neutral-500">Loading {title.toLowerCase()}...</p> : <>
          {section === "stat-viewer" && data.stats && <div className="space-y-7 rounded-2xl border border-neutral-200 bg-neutral-50/60 p-4 dark:border-neutral-800 dark:bg-neutral-950/40 sm:p-6"><MetricSection title="Needs Attention" metrics={[["Pending Approvals", data.stats.pending_approvals ?? 0], ["Pending Vendor Applications", data.stats.pending_vendor_applications ?? 0], ["Pending Bundle Approvals", data.stats.pending_bundle_approvals ?? 0], ["Active Orders", data.stats.active_orders ?? 0], ["Unread Chats", data.stats.unread_chats ?? 0]]} /><MetricSection title="Growth" metrics={[["New Users This Week", data.stats.new_users_this_week ?? 0], ["New Vendors This Week", data.stats.new_vendors_this_week ?? 0], ["Total Approved Products", data.stats.total_approved_products ?? 0], ["Approved Bundles", data.stats.approved_bundles ?? 0], ["Rejected Bundles", data.stats.rejected_bundles ?? 0]]} /><MetricSection title="Performance" metrics={[["Top Selling Product", data.stats.top_selling_product], ["Most Wishlisted Product", data.stats.most_wishlisted_product], ["Popular Category", data.stats.popular_category]]} /></div>}
          {section === "coupons" && <AdminCouponManager />}
          {section === "homepage-categories" && <AdminHomepageCategories />}
          {section === "newsletter-broadcast" && <AdminNewsletterBroadcast />}
          {section === "vendor-applications" && <AdminVendorApplications />}
          {section === "product-approvals" && <AdminProductApprovalTable products={data.products} onApprove={(id) => decideProduct(id, "approve")} onReject={(id, reason) => decideProduct(id, "reject", reason)} />}
          {section === "users" && <AdminUsersTable title="Users" users={data.users} onPromote={promoteUser} onReviewCod={reviewCodRefusals} meta={meta} page={page} setPage={setPage} search={search} setSearch={(value) => { setSearch(value); setPage(1); }} sort={sort} setSort={(value) => { setSort(value); setPage(1); }} />}
          {section === "vendors" && <AdminUsersTable title="Vendors" users={data.vendors} onPromote={promoteUser} onRevokeVendorAccess={setVendorRevocationTarget} onReviewCod={reviewCodRefusals} meta={vendorMeta} page={vendorPage} setPage={setVendorPage} search={vendorSearch} setSearch={(value) => { setVendorSearch(value); setVendorPage(1); }} sort={vendorSort} setSort={(value) => { setVendorSort(value); setVendorPage(1); }} />}
          {section === "order-history" && <div><AdminOrderHistory orders={data.orders.slice((orderPage - 1) * 10, orderPage * 10)} focusedOrderId={searchParams.get("orderId") || ""} /><Pager meta={{ page: orderPage, totalPages: Math.max(1, Math.ceil(data.orders.length / 10)), total: data.orders.length }} page={orderPage} setPage={setOrderPage} noun="orders" /></div>}
          {section === "contact-messages" && <div className="panel">{data.messages.map((item) => <div className="border-b border-neutral-200 py-4 first:pt-0 last:border-0 dark:border-neutral-800" key={item.id}><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{item.subject}</p><p className="text-sm text-neutral-500">{item.name} · {item.email}</p></div><button className="btn-secondary h-9 px-3" onClick={() => openContactChat(item.id)} type="button"><MessageSquare size={16} /> Chat</button></div><p className="mt-2 text-sm">{item.message}</p></div>)}{!data.messages.length && <p className="text-sm text-neutral-500">No contact messages.</p>}<Pager meta={meta} page={page} setPage={setPage} noun="messages" /></div>}
          {section === "user-reviews" && <div className="panel"><div className="max-h-[620px] space-y-3 overflow-auto">{data.reviews.map((review) => <div className="border-b border-neutral-200 pb-3 last:border-0 dark:border-neutral-800" key={review.id}><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{review.user.name}</p><p className="text-sm text-neutral-500">{new Date(review.createdAt).toLocaleDateString()}</p></div><button className={review.pinned ? "btn-primary h-9 px-3" : "btn-secondary h-9 px-3"} onClick={() => toggleReviewPin(review)} type="button">{review.pinned ? "Unpin" : "Pin"}</button></div><p className="mt-2 text-sm">{review.body}</p></div>)}{!data.reviews.length && <p className="text-sm text-neutral-500">No reviews yet.</p>}</div></div>}
          {["product-reviews", "vendor-reviews"].includes(section) && <div className="panel"><EntityReviewList type={section.startsWith("product") ? "product" : "vendor"} reviews={data.entityReviews} meta={meta} loading={false} page={page} setPage={setPage} onDelete={deleteEntityReview} /></div>}
        </>}
      </main>
    </div>
  </section>;
}
