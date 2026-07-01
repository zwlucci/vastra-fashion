import React, { useEffect, useState } from "react";
import { MessageSquare, Shirt, Trash2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { api, getErrorMessage } from "../api/client.js";
import { AdminProductApprovalTable } from "../components/AdminProductApprovalTable.jsx";
import { AdminUsersTable } from "../components/AdminUsersTable.jsx";
import { useMessages } from "../context/MessageContext.jsx";

function MetricSection({ title, metrics }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-3"><h2 className="text-lg font-black">{title}</h2><div className="h-px flex-1 bg-neutral-200 dark:bg-neutral-800" /></div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {metrics.map(([label, value]) => <div className="panel min-w-0 p-5" key={label}><p className="text-sm font-semibold text-neutral-500">{label}</p><p className="mt-2 truncate text-2xl font-black" title={String(value ?? "No data yet")}>{value ?? "No data yet"}</p></div>)}
      </div>
    </section>
  );
}

function AdminEntityReviewList({ type, reviews, meta, loading, page, setPage, onDelete }) {
  if (loading) return <p className="py-8 text-center text-sm text-neutral-500">Loading {type} reviews...</p>;
  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {reviews.map((review) => <article className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800" key={review.id}><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{review.userName} · {review.rating}/5</p><p className="text-sm text-neutral-500">{type === "product" ? "Product" : "Vendor"}: {review.entityName} · {new Date(review.createdAt).toLocaleDateString()}</p></div><button className="btn-secondary h-9 px-3 text-red-600" onClick={() => onDelete(review)} type="button"><Trash2 size={14} /> Delete</button></div><p className="mt-3 whitespace-pre-wrap text-sm leading-6">{review.body}</p></article>)}
        {!reviews.length && <p className="py-8 text-center text-sm text-neutral-500">No {type} reviews yet.</p>}
      </div>
      {meta && <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200 pt-4 dark:border-neutral-800"><p className="text-sm text-neutral-500">Page {meta.page} of {meta.totalPages} · {meta.total} review{meta.total === 1 ? "" : "s"}</p><div className="flex gap-2"><button className="btn-secondary" disabled={page <= 1} onClick={() => setPage((current) => current - 1)} type="button">Previous</button><button className="btn-secondary" disabled={page >= meta.totalPages} onClick={() => setPage((current) => current + 1)} type="button">Next</button></div></div>}
    </div>
  );
}

export function AdminDashboard() {
  const { socket } = useMessages();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [products, setProducts] = useState([]);
  const [users, setUsers] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [messages, setMessages] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [productReviews, setProductReviews] = useState([]);
  const [vendorReviews, setVendorReviews] = useState([]);
  const [productReviewPage, setProductReviewPage] = useState(1);
  const [vendorReviewPage, setVendorReviewPage] = useState(1);
  const [productReviewMeta, setProductReviewMeta] = useState(null);
  const [vendorReviewMeta, setVendorReviewMeta] = useState(null);
  const [productReviewsLoading, setProductReviewsLoading] = useState(true);
  const [vendorReviewsLoading, setVendorReviewsLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [userPage, setUserPage] = useState(1);
  const [vendorPage, setVendorPage] = useState(1);
  const [contactPage, setContactPage] = useState(1);
  const [userMeta, setUserMeta] = useState(null);
  const [vendorMeta, setVendorMeta] = useState(null);
  const [contactMeta, setContactMeta] = useState(null);
  const [userSearch, setUserSearch] = useState("");
  const [vendorSearch, setVendorSearch] = useState("");
  const [userSort, setUserSort] = useState("newest");
  const [vendorSort, setVendorSort] = useState("newest");

  async function loadOverview() {
    const [statsRes, productsRes, reviewsRes] = await Promise.all([
      api.get("/admin/stats"),
      api.get("/admin/products"),
      api.get("/admin/reviews")
    ]);
    setStats(statsRes.data.stats);
    setProducts(productsRes.data.products);
    setReviews(reviewsRes.data.reviews || []);
  }

  async function loadEntityReviews(type, page) {
    const { data } = await api.get(`/admin/entity-reviews?type=${type}&page=${page}&limit=5`);
    if (type === "product") {
      setProductReviews(data.reviews || []);
      setProductReviewMeta(data.meta);
    } else {
      setVendorReviews(data.reviews || []);
      setVendorReviewMeta(data.meta);
    }
  }

  async function loadUsers() {
    const { data } = await api.get(`/admin/users?role=user&page=${userPage}&limit=6&search=${encodeURIComponent(userSearch)}&sort=${userSort}`);
    setUsers(data.users);
    setUserMeta(data.meta);
  }

  async function loadVendors() {
    const { data } = await api.get(`/admin/users?role=vendor&page=${vendorPage}&limit=6&search=${encodeURIComponent(vendorSearch)}&sort=${vendorSort}`);
    setVendors(data.users);
    setVendorMeta(data.meta);
  }

  useEffect(() => {
    loadOverview();
  }, []);

  useEffect(() => {
    if (!socket) return undefined;
    const refresh = () => Promise.all([loadOverview(), loadUsers(), loadVendors()]).catch(() => {});
    socket.on("dashboard:updated", refresh);
    return () => {
      socket.off("dashboard:updated", refresh);
    };
  }, [socket, userPage, userSearch, userSort, vendorPage, vendorSearch, vendorSort]);

  useEffect(() => {
    loadUsers().catch(() => {});
  }, [userPage, userSearch, userSort]);

  useEffect(() => {
    loadVendors().catch(() => {});
  }, [vendorPage, vendorSearch, vendorSort]);

  useEffect(() => {
    setProductReviewsLoading(true);
    loadEntityReviews("product", productReviewPage).catch((err) => setError(getErrorMessage(err))).finally(() => setProductReviewsLoading(false));
  }, [productReviewPage]);

  useEffect(() => {
    setVendorReviewsLoading(true);
    loadEntityReviews("vendor", vendorReviewPage).catch((err) => setError(getErrorMessage(err))).finally(() => setVendorReviewsLoading(false));
  }, [vendorReviewPage]);

  useEffect(() => {
    api.get(`/admin/contact-messages?page=${contactPage}&limit=5`).then(({ data }) => {
      setMessages(data.messages);
      setContactMeta(data.meta);
    });
  }, [contactPage]);

  async function approve(id) {
    await api.patch(`/admin/products/${id}/approve`);
    await loadOverview();
  }

  async function reject(id, reason) {
    await api.patch(`/admin/products/${id}/reject`, { reason });
    await loadOverview();
  }

  async function promoteUser(id) {
    setMessage("");
    setError("");
    try {
      const { data } = await api.patch(`/admin/users/${id}/role`, { role: "vendor" });
      setUsers((current) => current.filter((user) => user.id !== id));
      setVendors((current) => current.some((vendor) => vendor.id === id) ? current : [data.user, ...current].slice(0, 6));
      setMessage("User promoted to vendor.");
      setUserPage(1);
      setVendorPage(1);
      await Promise.all([loadOverview(), loadUsers(), loadVendors()]);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function toggleReviewPin(review) {
    await api.patch(`/admin/reviews/${review.id}/pin`, { pinned: !review.pinned });
    const { data } = await api.get("/admin/reviews");
    setReviews(data.reviews || []);
  }

  async function openContactChat(id) {
    setMessage("");
    setError("");
    try {
      const { data } = await api.post(`/admin/contact-messages/${id}/conversation`);
      navigate(`/messages?conversationId=${data.conversation.id}`);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function deleteEntityReview(review) {
    await api.delete(`/admin/entity-reviews/${review.entityType}/${review.id}`);
    if (review.entityType === "product") {
      if (productReviews.length === 1 && productReviewPage > 1) setProductReviewPage((current) => current - 1);
      else await loadEntityReviews("product", productReviewPage);
    } else if (vendorReviews.length === 1 && vendorReviewPage > 1) setVendorReviewPage((current) => current - 1);
    else await loadEntityReviews("vendor", vendorReviewPage);
  }

  return (
    <section className="mx-auto max-w-7xl space-y-8 px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
        <p className="text-sm font-bold uppercase tracking-wide text-clay">Admin</p>
        <h1 className="text-4xl font-black">Admin Dashboard</h1>
        </div>
        <Link className="btn-primary" to="/admin/wardrobe"><Shirt size={17} /> Wardrobe dashboard</Link>
      </div>
      {(message || error) && (
        <p className={`rounded-md p-3 text-sm ${error ? "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-200" : "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-200"}`}>
          {error || message}
        </p>
      )}
      {stats && (
        <div className="space-y-7 rounded-2xl border border-neutral-200 bg-neutral-50/60 p-4 dark:border-neutral-800 dark:bg-neutral-950/40 sm:p-6">
          <MetricSection title="Needs Attention" metrics={[
            ["Pending Approvals", stats.pending_approvals ?? 0],
            ["Active Orders", stats.active_orders ?? 0],
            ["Unread Chats", stats.unread_chats ?? 0]
          ]} />
          <MetricSection title="Inventory" metrics={[
            ["Low Stock", stats.low_stock ?? 0],
            ["Out of Stock", stats.out_of_stock ?? 0],
            ["Recently Added Products", stats.recently_added_products ?? 0]
          ]} />
          <MetricSection title="Growth" metrics={[
            ["New Users This Week", stats.new_users_this_week ?? 0],
            ["New Vendors This Week", stats.new_vendors_this_week ?? 0],
            ["Total Approved Products", stats.total_approved_products ?? 0]
          ]} />
          <MetricSection title="Performance" metrics={[
            ["Top Selling Product", stats.top_selling_product],
            ["Most Wishlisted Product", stats.most_wishlisted_product],
            ["Popular Category", stats.popular_category]
          ]} />
        </div>
      )}
      <div className="space-y-4">
        <h2 className="text-2xl font-black">Product approvals</h2>
        <AdminProductApprovalTable products={products} onApprove={approve} onReject={reject} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <AdminUsersTable title="Users" users={users} onPromote={promoteUser} meta={userMeta} page={userPage} setPage={setUserPage} search={userSearch} setSearch={(value) => { setUserSearch(value); setUserPage(1); }} sort={userSort} setSort={(value) => { setUserSort(value); setUserPage(1); }} />
        <AdminUsersTable title="Vendors" users={vendors} onPromote={promoteUser} meta={vendorMeta} page={vendorPage} setPage={setVendorPage} search={vendorSearch} setSearch={(value) => { setVendorSearch(value); setVendorPage(1); }} sort={vendorSort} setSort={(value) => { setVendorSort(value); setVendorPage(1); }} />
        <div className="panel">
          <h2 className="mb-4 text-2xl font-black">Contact messages</h2>
          <div className="space-y-4">
            {messages.map((message) => (
              <div className="border-b border-neutral-200 pb-3 last:border-0 dark:border-neutral-800" key={message.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{message.subject}</p>
                    <p className="text-sm text-neutral-500">{message.name} · {message.email}</p>
                  </div>
                  <button className="btn-secondary h-9 px-3" onClick={() => openContactChat(message.id)} type="button">
                    <MessageSquare size={16} /> Chat
                  </button>
                </div>
                <p className="mt-2 text-sm">{message.message}</p>
              </div>
            ))}
          </div>
          {contactMeta && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-neutral-500">Page {contactMeta.page} of {contactMeta.totalPages}</p>
              <div className="flex gap-2">
                <button className="btn-secondary" disabled={contactPage <= 1} onClick={() => setContactPage(contactPage - 1)} type="button">Previous</button>
                <button className="btn-secondary" disabled={contactPage >= contactMeta.totalPages} onClick={() => setContactPage(contactPage + 1)} type="button">Next</button>
              </div>
            </div>
          )}
        </div>
        <div className="panel">
          <h2 className="mb-4 text-2xl font-black">Homepage testimonials</h2>
          <div className="max-h-[420px] space-y-3 overflow-auto">
            {reviews.map((review) => (
              <div className="border-b border-neutral-200 pb-3 last:border-0 dark:border-neutral-800" key={review.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{review.user.name}</p>
                    <p className="text-sm text-neutral-500">{new Date(review.createdAt).toLocaleDateString()}</p>
                  </div>
                  <button className={review.pinned ? "btn-primary h-9 px-3" : "btn-secondary h-9 px-3"} onClick={() => toggleReviewPin(review)} type="button">
                    {review.pinned ? "Unpin" : "Pin"}
                  </button>
                </div>
                <p className="mt-2 text-sm">{review.body}</p>
              </div>
            ))}
            {!reviews.length && <p className="text-sm text-neutral-500">No reviews yet.</p>}
          </div>
        </div>
        <div className="panel min-w-0">
          <div className="mb-5"><p className="text-sm font-bold uppercase tracking-wide text-clay">Review moderation</p><h2 className="text-2xl font-black">Product Reviews</h2></div>
          <AdminEntityReviewList type="product" reviews={productReviews} meta={productReviewMeta} loading={productReviewsLoading} page={productReviewPage} setPage={setProductReviewPage} onDelete={deleteEntityReview} />
        </div>
        <div className="panel min-w-0">
          <div className="mb-5"><p className="text-sm font-bold uppercase tracking-wide text-clay">Review moderation</p><h2 className="text-2xl font-black">Vendor Reviews</h2></div>
          <AdminEntityReviewList type="vendor" reviews={vendorReviews} meta={vendorReviewMeta} loading={vendorReviewsLoading} page={vendorReviewPage} setPage={setVendorReviewPage} onDelete={deleteEntityReview} />
        </div>
      </div>
    </section>
  );
}
