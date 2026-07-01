import { MessageSquare } from "lucide-react";
import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, getErrorMessage } from "../api/client.js";
import { ProductGrid } from "../components/ProductGrid.jsx";
import { UserAvatar } from "../components/UserAvatar.jsx";
import { EntityReviews } from "../components/EntityReviews.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useNotification } from "../context/NotificationContext.jsx";

export function VendorProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const { showNotice } = useNotification();
  const [vendor, setVendor] = useState(null);
  const [products, setProducts] = useState([]);
  const [sort, setSort] = useState("newest");
  const [error, setError] = useState("");

  useEffect(() => {
    api.get(`/vendors/${id}`).then(({ data }) => setVendor(data.vendor)).catch((err) => setError(getErrorMessage(err)));
  }, [id]);

  useEffect(() => {
    api.get(`/vendors/${id}/products?sort=${sort}`).then(({ data }) => setProducts(data.products || []));
  }, [id, sort]);

  async function messageVendor() {
    if (!isAuthenticated) {
      showNotice("Please login to start a chat.", "warning", { label: "Login", to: "/login" });
      return;
    }
    try {
      const { data } = await api.post(`/messages/vendors/${id}`, {});
      navigate(`/messages?conversationId=${data.conversation.id}`);
    } catch (err) {
      showNotice(getErrorMessage(err));
    }
  }

  if (error) return <section className="mx-auto max-w-7xl px-4 py-10"><div className="panel text-red-600">{error}</div></section>;
  if (!vendor) return <section className="mx-auto max-w-7xl px-4 py-10">Loading vendor...</section>;

  return (
    <section className="mx-auto max-w-7xl space-y-8 px-4 py-10">
      <div className="panel flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <UserAvatar user={vendor} size="xl" />
          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-clay">Vendor profile</p>
            <h1 className="text-4xl font-black">{vendor.brandName || vendor.name}</h1>
            <p className="mt-1 text-neutral-500 dark:text-neutral-400">{vendor.name}</p>
            {vendor.brandDescription && <p className="mt-3 max-w-2xl leading-7 text-neutral-600 dark:text-neutral-300">{vendor.brandDescription}</p>}
          </div>
        </div>
        <button className="btn-primary" onClick={messageVendor} type="button">
          <MessageSquare size={18} /> Message vendor
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-clay">Recently posted</p>
          <h2 className="text-3xl font-black">Products</h2>
        </div>
        <select value={sort} onChange={(event) => setSort(event.target.value)}>
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="price_asc">Price low to high</option>
          <option value="price_desc">Price high to low</option>
          <option value="stock">Stock status</option>
        </select>
      </div>
      <ProductGrid products={products} loading={false} />
      <EntityReviews type="vendor" entityId={vendor.id} title="Vendor reviews" canReview={user?.id !== vendor.id} />
    </section>
  );
}
