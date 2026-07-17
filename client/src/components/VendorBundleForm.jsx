import { ImagePlus, PackagePlus, Trash2 } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { ProductImage } from "./ProductImage.jsx";
import { money } from "../utils/format.js";

const empty = {
  name: "",
  description: "",
  componentProductIds: [],
  discountPercentage: 0,
  sizes: [],
  stock: 0,
  media: []
};

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function existingForm(bundle) {
  return {
    name: bundle?.name || "",
    description: bundle?.description || "",
    componentProductIds: (bundle?.bundleComponents || []).map((product) => product.id),
    discountPercentage: bundle?.bundleDiscountPercentage ?? 0,
    sizes: bundle?.sizes || [],
    stock: bundle?.stock ?? 0,
    media: bundle?.productMedia || []
  };
}

function sharedSizes(products) {
  const [first, ...rest] = products;
  const shared = new Set(first?.sizes || []);
  rest.forEach((product) => {
    const sizes = new Set(product.sizes || []);
    [...shared].forEach((size) => {
      if (!sizes.has(size)) shared.delete(size);
    });
  });
  return [...shared];
}

function productPrice(product) {
  const prices = [Number(product.price || 0), ...Object.values(product.sizePrices || {}).map(Number).filter(Number.isFinite)];
  return Math.min(...prices);
}

export function VendorBundleForm({ products, initialBundle, onSubmit, submitLabel = "Create bundle" }) {
  const [form, setForm] = useState(empty);
  const [error, setError] = useState("");

  useEffect(() => {
    setForm(initialBundle ? existingForm(initialBundle) : empty);
    setError("");
  }, [initialBundle]);

  const eligibleProducts = useMemo(() => products.filter((product) => product.status === "approved" && !product.isBundle), [products]);
  const selectedProducts = useMemo(
    () => form.componentProductIds.map((id) => eligibleProducts.find((product) => product.id === id)).filter(Boolean),
    [eligibleProducts, form.componentProductIds]
  );
  const availableSizes = selectedProducts.length >= 2 ? sharedSizes(selectedProducts) : [];
  const originalPrice = selectedProducts.reduce((sum, product) => sum + productPrice(product), 0);
  const finalPrice = originalPrice * (1 - Number(form.discountPercentage || 0) / 100);
  const maxStock = selectedProducts.length ? Math.min(...selectedProducts.map((product) => Number(product.stock || 0))) : 0;

  function toggleProduct(id) {
    setForm((current) => {
      const hasProduct = current.componentProductIds.includes(id);
      const componentProductIds = hasProduct
        ? current.componentProductIds.filter((productId) => productId !== id)
        : [...current.componentProductIds, id].slice(0, 4);
      return { ...current, componentProductIds, sizes: current.sizes.filter((size) => sharedSizes(componentProductIds.map((productId) => eligibleProducts.find((product) => product.id === productId)).filter(Boolean)).includes(size)) };
    });
  }

  function toggleSize(size) {
    setForm((current) => ({
      ...current,
      sizes: current.sizes.includes(size) ? current.sizes.filter((item) => item !== size) : [...current.sizes, size]
    }));
  }

  async function addMedia(event) {
    const files = [...(event.target.files || [])];
    event.target.value = "";
    if (!files.length) return;
    const invalid = files.find((file) => !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type) || file.size > 3 * 1024 * 1024);
    if (invalid) {
      setError("Bundle images must be JPG, PNG, WEBP, or GIF files under 3MB.");
      return;
    }
    const data = await Promise.all(files.map(readFileAsDataUrl));
    setError("");
    setForm((current) => ({ ...current, media: [...current.media, ...data.map((mediaData) => ({ mediaData, type: "image", color: "" }))] }));
  }

  function submit(event) {
    event.preventDefault();
    if (form.componentProductIds.length < 2) return setError("Choose between two and four products for the bundle.");
    if (!form.sizes.length) return setError("Choose at least one shared size.");
    if (Number(form.stock) > maxStock) return setError(`Bundle stock cannot exceed ${maxStock}.`);
    setError("");
    onSubmit({
      name: form.name,
      description: form.description,
      componentProductIds: form.componentProductIds,
      discountPercentage: Number(form.discountPercentage || 0),
      sizes: form.sizes,
      stock: Number(form.stock || 0),
      media: form.media.map((item) => ({ url: item.url || "", mediaData: item.mediaData || "", type: "image", color: "" })),
      images: []
    });
  }

  return (
    <form className="panel space-y-6" onSubmit={submit}>
      <div><p className="text-sm font-bold uppercase tracking-wide text-clay">Bundle setup</p><h2 className="text-2xl font-black">{initialBundle ? "Edit bundle" : "Create bundle"}</h2></div>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1"><span className="text-sm font-semibold">Bundle name</span><input className="w-full" required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
        <label className="space-y-1"><span className="text-sm font-semibold">Discount percentage</span><input className="w-full" min="0" max="100" step="0.01" type="number" value={form.discountPercentage} onChange={(event) => setForm({ ...form, discountPercentage: event.target.value })} /></label>
      </div>
      <label className="block space-y-1"><span className="text-sm font-semibold">Description</span><textarea className="w-full" required rows="3" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>

      <section className="space-y-3 border-t border-neutral-200 pt-5 dark:border-neutral-800">
        <div className="flex items-center justify-between gap-3"><div><h3 className="font-black">Included products</h3><p className="text-sm text-neutral-500">Choose two to four approved normal products.</p></div><span className="badge bg-clay/10 text-clay">{form.componentProductIds.length}/4</span></div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {eligibleProducts.map((product) => {
            const selected = form.componentProductIds.includes(product.id);
            return <button className={`flex min-w-0 gap-3 rounded-lg border p-3 text-left transition ${selected ? "border-clay bg-clay/5" : "border-neutral-200 hover:border-clay dark:border-neutral-800"}`} key={product.id} onClick={() => toggleProduct(product.id)} type="button"><ProductImage className="h-16 w-12 shrink-0 rounded bg-neutral-100 object-contain dark:bg-neutral-950" src={product.imageUrl} alt={product.name} /><span className="min-w-0"><span className="block truncate font-bold">{product.name}</span><span className="block text-sm text-neutral-500">{money(productPrice(product))} - Stock {product.stock}</span><span className="block truncate text-xs text-neutral-500">{product.sizes?.join(", ") || "No sizes"}</span></span></button>;
          })}
        </div>
        {!eligibleProducts.length && <p className="rounded-lg border border-neutral-200 p-4 text-sm text-neutral-500 dark:border-neutral-800">No approved normal products are available for bundling yet.</p>}
      </section>

      <section className="grid gap-4 border-t border-neutral-200 pt-5 dark:border-neutral-800 md:grid-cols-[1fr_280px]">
        <div className="space-y-3">
          <h3 className="font-black">Shared sizes</h3>
          <div className="flex flex-wrap gap-2">{availableSizes.map((size) => <label className={`cursor-pointer rounded-lg border px-3 py-2 text-sm font-bold ${form.sizes.includes(size) ? "border-clay bg-clay/5 text-clay" : "border-neutral-200 dark:border-neutral-800"}`} key={size}><input className="sr-only" checked={form.sizes.includes(size)} onChange={() => toggleSize(size)} type="checkbox" />{size}</label>)}</div>
          {!availableSizes.length && <p className="text-sm text-neutral-500">Select products with at least one shared size.</p>}
          <label className="block max-w-xs space-y-1"><span className="text-sm font-semibold">Bundle stock</span><input className="w-full" min="0" max={maxStock} type="number" value={form.stock} onChange={(event) => setForm({ ...form, stock: event.target.value })} /></label>
        </div>
        <div className="rounded-lg border border-neutral-200 p-4 text-sm dark:border-neutral-800">
          <p className="font-black">Pricing</p>
          <p className="mt-3 flex justify-between gap-3"><span className="text-neutral-500">Original total</span><strong>{money(originalPrice)}</strong></p>
          <p className="mt-2 flex justify-between gap-3"><span className="text-neutral-500">Discount</span><strong>{Number(form.discountPercentage || 0)}%</strong></p>
          <p className="mt-2 flex justify-between gap-3 text-lg"><span className="font-bold">Final price</span><strong>{money(finalPrice)}</strong></p>
          <p className="mt-3 text-xs text-neutral-500">Max fulfillable stock: {maxStock}</p>
        </div>
      </section>

      <section className="space-y-3 border-t border-neutral-200 pt-5 dark:border-neutral-800">
        <h3 className="font-black">Bundle image</h3>
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-neutral-300 p-5 font-semibold hover:border-clay dark:border-neutral-700"><ImagePlus size={18} /> Upload custom image<input className="sr-only" accept="image/png,image/jpeg,image/webp,image/gif" multiple type="file" onChange={addMedia} /></label>
        <div className="grid gap-3 sm:grid-cols-4">{form.media.map((item, index) => <div className="relative" key={`${item.url || item.mediaData?.slice(0, 24)}-${index}`}><ProductImage className="aspect-square w-full rounded-lg bg-neutral-100 object-cover dark:bg-neutral-950" src={item.mediaData || item.url} alt="Bundle media" /><button className="absolute right-2 top-2 rounded-full bg-white p-2 text-red-600 shadow-soft dark:bg-neutral-900" onClick={() => setForm((current) => ({ ...current, media: current.media.filter((_, itemIndex) => itemIndex !== index) }))} type="button" title="Remove image"><Trash2 size={14} /></button></div>)}</div>
      </section>

      {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
      <button className="btn-primary w-full" disabled={eligibleProducts.length < 2} type="submit"><PackagePlus size={18} /> {submitLabel}</button>
    </form>
  );
}
