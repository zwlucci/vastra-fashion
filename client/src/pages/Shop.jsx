import React, { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api/client.js";
import { ProductFilterBar, ProductFilterSidebar } from "../components/ProductFilters.jsx";
import { ProductGrid } from "../components/ProductGrid.jsx";
import { UserAvatar } from "../components/UserAvatar.jsx";
import { useMessages } from "../context/MessageContext.jsx";

function getProductsPerPage() {
  if (typeof window === "undefined") return 12;
  if (window.innerWidth >= 1280) return 12;
  if (window.innerWidth >= 1024) return 9;
  if (window.innerWidth >= 640) return 6;
  return 3;
}

function Pagination({ currentPage, onPageChange, totalPages }) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 pt-6">
      <button className="btn-secondary" disabled={currentPage === 1} onClick={() => onPageChange(currentPage - 1)} type="button">
        Previous
      </button>
      {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
        <button
          className={page === currentPage ? "btn-primary h-10 w-10 px-0" : "btn-secondary h-10 w-10 px-0"}
          onClick={() => onPageChange(page)}
          type="button"
          key={page}
        >
          {page}
        </button>
      ))}
      <button className="btn-secondary" disabled={currentPage === totalPages} onClick={() => onPageChange(currentPage + 1)} type="button">
        Next
      </button>
    </div>
  );
}

export function Shop() {
  const { socket } = useMessages();
  const [searchParams] = useSearchParams();
  const [filters, setFilters] = useState({
    search: "",
    category: "",
    gender: searchParams.get("gender") || "",
    brand: "",
    size: "",
    minPrice: "",
    maxPrice: "",
    sort: "newest"
  });
  const [products, setProducts] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [productsPerPage, setProductsPerPage] = useState(getProductsPerPage);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    return params.toString();
  }, [filters]);

  useEffect(() => {
    setLoading(true);
    api.get(`/products?${query}`).then(({ data }) => setProducts(data.products)).finally(() => setLoading(false));
  }, [query]);

  useEffect(() => {
    if (!socket) return undefined;
    const refresh = () => {
      api.get(`/products?${query}`).then(({ data }) => setProducts(data.products)).catch(() => {});
    };
    socket.on("product:updated", refresh);
    return () => socket.off("product:updated", refresh);
  }, [socket, query]);

  useEffect(() => {
    if (!filters.search.trim()) {
      setVendors([]);
      return;
    }
    api.get(`/vendors?search=${encodeURIComponent(filters.search)}`).then(({ data }) => setVendors(data.vendors || []));
  }, [filters.search]);

  useEffect(() => {
    setCurrentPage(1);
  }, [query]);

  useEffect(() => {
    function handleResize() {
      setProductsPerPage(getProductsPerPage());
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const totalPages = Math.max(1, Math.ceil(products.length / productsPerPage));
  const safePage = Math.min(currentPage, totalPages);
  const pageStart = (safePage - 1) * productsPerPage;
  const paginatedProducts = products.slice(pageStart, pageStart + productsPerPage);

  return (
    <section className="mx-auto max-w-7xl space-y-6 px-4 py-10">
      <div>
        <h1 className="text-4xl font-black">Shop</h1>
      </div>
      <ProductFilterBar filters={filters} setFilters={setFilters} />
      {vendors.length > 0 && (
        <div className="panel">
          <h2 className="mb-3 text-lg font-black">Vendor matches</h2>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {vendors.map((vendor) => (
              <Link className="flex items-center gap-3 rounded-lg border border-neutral-200 p-3 hover:border-clay dark:border-neutral-800" to={`/vendors/${vendor.id}`} key={vendor.id}>
                <UserAvatar user={vendor} size="md" />
                <div className="min-w-0">
                  <p className="truncate font-bold">{vendor.brandName || vendor.name}</p>
                  <p className="truncate text-sm text-neutral-500">{vendor.name}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <ProductFilterSidebar filters={filters} setFilters={setFilters} />
        <div>
          <ProductGrid products={paginatedProducts} loading={loading} />
          {!loading && products.length > 0 && (
            <Pagination currentPage={safePage} onPageChange={setCurrentPage} totalPages={totalPages} />
          )}
        </div>
      </div>
    </section>
  );
}
