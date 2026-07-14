import { ArrowLeft, Home as HomeIcon } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, getErrorMessage } from "../api/client.js";
import { PageContainer } from "../components/PageContainer.jsx";
import { ProductGrid } from "../components/ProductGrid.jsx";
import { ProductImage } from "../components/ProductImage.jsx";
import { useMessages } from "../context/MessageContext.jsx";

function getProductsPerPage() {
  if (typeof window === "undefined") return 12;
  if (window.innerWidth >= 1280) return 12;
  if (window.innerWidth >= 1024) return 9;
  if (window.innerWidth >= 640) return 6;
  return 4;
}

function Pagination({ currentPage, onPageChange, totalPages }) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 pt-6">
      <button className="btn-secondary" disabled={currentPage === 1} onClick={() => onPageChange(currentPage - 1)} type="button">Previous</button>
      {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
        <button className={page === currentPage ? "btn-primary h-10 w-10 px-0" : "btn-secondary h-10 w-10 px-0"} onClick={() => onPageChange(page)} type="button" key={page}>{page}</button>
      ))}
      <button className="btn-secondary" disabled={currentPage === totalPages} onClick={() => onPageChange(currentPage + 1)} type="button">Next</button>
    </div>
  );
}

export function CategoryProducts() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { socket } = useMessages();
  const [shortcut, setShortcut] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [productsPerPage, setProductsPerPage] = useState(getProductsPerPage);

  const productQuery = useMemo(() => {
    if (!shortcut?.mappedCategory) return "";
    return `/products?category=${encodeURIComponent(shortcut.mappedCategory)}&sort=newest`;
  }, [shortcut?.mappedCategory]);

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    setError("");
    setShortcut(null);
    setProducts([]);

    api.get(`/homepage-categories/${encodeURIComponent(slug)}`)
      .then(async ({ data }) => {
        if (ignore) return;
        setShortcut(data.shortcut);
        const productsResponse = await api.get(`/products?category=${encodeURIComponent(data.shortcut.mappedCategory)}&sort=newest`);
        if (!ignore) setProducts(productsResponse.data.products || []);
      })
      .catch((err) => {
        if (!ignore) setError(getErrorMessage(err));
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [slug]);

  useEffect(() => {
    if (!socket || !productQuery) return undefined;
    const refresh = () => {
      api.get(productQuery).then(({ data }) => setProducts(data.products || [])).catch(() => {});
    };
    socket.on("product:updated", refresh);
    return () => socket.off("product:updated", refresh);
  }, [productQuery, socket]);

  useEffect(() => {
    setCurrentPage(1);
  }, [slug, productQuery]);

  useEffect(() => {
    function handleResize() {
      setProductsPerPage(getProductsPerPage());
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  function goBack() {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate("/");
  }

  const totalPages = Math.max(1, Math.ceil(products.length / productsPerPage));
  const safePage = Math.min(currentPage, totalPages);
  const pageStart = (safePage - 1) * productsPerPage;
  const paginatedProducts = products.slice(pageStart, pageStart + productsPerPage);

  if (error && !loading) {
    return (
      <PageContainer as="section" className="py-10">
        <button className="btn-secondary mb-6" onClick={goBack} type="button"><ArrowLeft size={17} /> Back</button>
        <div className="panel py-14 text-center">
          <p className="text-sm font-bold uppercase tracking-wide text-clay">Category not found</p>
          <h1 className="mt-2 text-3xl font-black">This category shortcut is unavailable.</h1>
          <p className="mx-auto mt-3 max-w-xl text-neutral-500">{error}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link className="btn-primary" to="/"><HomeIcon size={17} /> Back to homepage</Link>
            <Link className="btn-secondary" to="/shop">Browse shop</Link>
          </div>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer as="section" className="space-y-7 py-10">
      <button className="btn-secondary" onClick={goBack} type="button"><ArrowLeft size={17} /> Back</button>
      <div className="flex flex-wrap items-center gap-4">
        <ProductImage className="h-20 w-20 rounded-full border border-neutral-200 object-cover p-1 dark:border-neutral-800" fallbackClassName="rounded-full" src={shortcut?.iconUrl} alt={shortcut ? `${shortcut.displayName} category icon` : "Category icon"} />
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-clay">Category collection</p>
          <h1 className="text-4xl font-black">{shortcut?.displayName || "Category"}</h1>
          {shortcut?.mappedCategory && <p className="mt-1 text-neutral-500">Showing approved products in {shortcut.mappedCategory}.</p>}
        </div>
      </div>
      <div>
        <ProductGrid products={paginatedProducts} loading={loading} />
        {!loading && products.length > 0 && <Pagination currentPage={safePage} onPageChange={setCurrentPage} totalPages={totalPages} />}
      </div>
    </PageContainer>
  );
}
