import { ImagePlus, Plus, Trash2, Video } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { resolveImageUrl } from "../api/client.js";
import { DEFAULT_PRODUCT_CATEGORY, isProductCategory } from "../../../shared/productCategories.mjs";
import { PRODUCT_SIZES } from "../../../shared/productSizes.mjs";
import { ProductImage } from "./ProductImage.jsx";
import { SearchableCategorySelect } from "./SearchableCategorySelect.jsx";

const empty = {
  name: "",
  description: "",
  price: "",
  category: DEFAULT_PRODUCT_CATEGORY,
  gender: "Unisex",
  stock: "",
  media: [],
  variations: [],
  sizes: []
};

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function mediaType(item) {
  return item?.type === "video" || item?.mediaData?.startsWith("data:video/") || /\.(mp4|webm)(\?|$)/i.test(item?.url || "") ? "video" : "image";
}

function existingForm(product) {
  const storedMedia = product?.productMedia?.length ? product.productMedia : product?.productImages || [];
  const media = (storedMedia.length ? storedMedia : product?.imageUrl ? [{ url: product.imageUrl, type: "image", color: "" }] : [])
    .map((item) => ({ url: item.url || "", mediaData: "", type: mediaType(item), color: item.color || "" }));
  const colors = product?.colors?.length ? product.colors : [...new Set(media.map((item) => item.color).filter(Boolean))];
  return {
    name: product?.name || "",
    description: product?.description || "",
    price: product?.price ?? "",
    category: isProductCategory(product?.category) ? product.category : DEFAULT_PRODUCT_CATEGORY,
    gender: product?.gender || "Unisex",
    stock: product?.stock ?? "",
    media,
    variations: colors.map((color) => ({
      color,
      outOfStock: Boolean(product?.colorStockStatus?.[color])
    })),
    sizes: (product?.sizes || []).filter((name) => PRODUCT_SIZES.includes(name)).map((name) => ({ name, price: product?.sizePrices?.[name] ?? "" }))
  };
}

function newVariation() {
  return { color: "", outOfStock: false };
}

function MediaPreview({ item, alt, className = "" }) {
  const src = item.mediaData || item.url;
  if (mediaType(item) === "video") {
    return <video className={className} src={resolveImageUrl(src)} controls muted playsInline preload="metadata" aria-label={alt} />;
  }
  return <ProductImage className={className} src={src} alt={alt} />;
}

export function ProductForm({ initialProduct, onSubmit, submitLabel = "Save product" }) {
  const [form, setForm] = useState(empty);
  const [mediaError, setMediaError] = useState("");
  const [sizeError, setSizeError] = useState("");

  useEffect(() => {
    setForm(initialProduct ? existingForm(initialProduct) : empty);
    setMediaError("");
    setSizeError("");
  }, [initialProduct]);

  const allMedia = useMemo(() => form.media, [form.media]);
  const firstPreview = allMedia[0];
  const canAddVariations = Boolean(firstPreview);

  function validateFiles(files) {
    for (const file of files) {
      const isImage = ["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type);
      const isVideo = ["video/mp4", "video/webm"].includes(file.type);
      if (!isImage && !isVideo) return "Choose JPG, PNG, WEBP, GIF, MP4, or WEBM files.";
      if (isImage && file.size > 3 * 1024 * 1024) return "Each image must be smaller than 3MB.";
      if (isVideo && file.size > 15 * 1024 * 1024) return "Each video must be smaller than 15MB.";
    }
    return "";
  }

  async function filesToMedia(event) {
    const files = [...(event.target.files || [])];
    if (!files.length) return [];
    const error = validateFiles(files);
    if (error) {
      setMediaError(error);
      event.target.value = "";
      return [];
    }
    setMediaError("");
    const data = await Promise.all(files.map(readFileAsDataUrl));
    event.target.value = "";
    return files.map((file, index) => ({
      url: "",
      mediaData: data[index],
      type: file.type.startsWith("video/") ? "video" : "image"
    }));
  }

  async function addBaseMedia(event) {
    const next = await filesToMedia(event);
    if (next.length) setForm((current) => ({ ...current, media: [...current.media, ...next] }));
  }

  async function addVariationMedia(index, event) {
    const next = await filesToMedia(event);
    if (!next.length) return;
    setForm((current) => ({
      ...current,
      media: [...current.media, ...next.map((item) => ({ ...item, color: current.variations[index]?.color.trim() || "" }))]
    }));
  }

  function updateVariation(index, patch) {
    setForm((current) => ({
      ...current,
      variations: current.variations.map((variation, itemIndex) => itemIndex === index ? { ...variation, ...patch } : variation),
      media: patch.color === undefined ? current.media : current.media.map((item) => (
        item.color === current.variations[index]?.color ? { ...item, color: patch.color } : item
      ))
    }));
  }

  function removeVariation(index) {
    setForm((current) => {
      const removedColor = current.variations[index]?.color;
      return {
        ...current,
        variations: current.variations.filter((_, itemIndex) => itemIndex !== index),
        media: current.media.map((item) => item.color === removedColor ? { ...item, color: "" } : item)
      };
    });
  }

  function updateMedia(index, patch) {
    setForm((current) => ({
      ...current,
      media: current.media.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item)
    }));
  }

  function updateSize(name, patch) {
    setForm((current) => ({
      ...current,
      sizes: current.sizes.map((size) => size.name === name ? { ...size, ...patch } : size)
    }));
  }

  function toggleSize(name) {
    setSizeError("");
    setForm((current) => ({
      ...current,
      sizes: current.sizes.some((size) => size.name === name)
        ? current.sizes.filter((size) => size.name !== name)
        : [...current.sizes, { name, price: "" }]
    }));
  }

  function submit(event) {
    event.preventDefault();
    if (!allMedia.length) {
      setMediaError("Upload at least one image or video.");
      return;
    }
    const variations = form.variations.filter((variation) => variation.color.trim());
    const normalizedColors = variations.map((variation) => variation.color.trim().toLocaleLowerCase());
    if (new Set(normalizedColors).size !== normalizedColors.length) {
      setMediaError("Color names must be unique.");
      return;
    }
    const sizes = form.sizes.filter((size) => size.name.trim());
    if (!sizes.length) {
      setSizeError("Please select at least one size.");
      return;
    }
    setSizeError("");
    const validColors = new Set(variations.map((variation) => variation.color.trim()));
    const media = form.media.map((item) => ({
      color: validColors.has(item.color?.trim()) ? item.color.trim() : "",
      url: item.url || "",
      mediaData: item.mediaData || "",
      type: mediaType(item)
    }));

    onSubmit({
      name: form.name,
      description: form.description,
      price: Number(form.price),
      category: form.category,
      gender: form.gender,
      stock: Number(form.stock),
      media,
      images: [],
      colors: variations.map((variation) => variation.color.trim()),
      colorStockStatus: Object.fromEntries(variations.map((variation) => [variation.color.trim(), variation.outOfStock])),
      sizes: sizes.map((size) => size.name.trim()),
      sizePrices: Object.fromEntries(sizes.filter((size) => size.price !== "").map((size) => [size.name.trim(), Number(size.price)]))
    });
  }

  return (
    <form className="panel space-y-8" onSubmit={submit}>
      <section className="space-y-4">
        <div><p className="text-sm font-bold uppercase tracking-wide text-clay">Step 1</p><h2 className="text-2xl font-black">Basic product information</h2></div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1"><span className="text-sm font-semibold">Product name</span><input className="w-full" required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
          <label className="space-y-1"><span className="text-sm font-semibold">Category</span><SearchableCategorySelect value={form.category} onChange={(category) => setForm({ ...form, category })} /></label>
          <label className="space-y-1"><span className="text-sm font-semibold">Gender</span><select className="w-full" value={form.gender} onChange={(event) => setForm({ ...form, gender: event.target.value })}><option>Men</option><option>Women</option><option>Unisex</option></select></label>
          <label className="space-y-1"><span className="text-sm font-semibold">Base price</span><input className="w-full" required min="0" step="0.01" type="number" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} /></label>
        </div>
        <label className="block space-y-1"><span className="text-sm font-semibold">Description</span><textarea className="w-full" required rows="4" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
      </section>

      <section className="space-y-4 border-t border-neutral-200 pt-6 dark:border-neutral-800">
        <div><p className="text-sm font-bold uppercase tracking-wide text-clay">Step 2</p><h2 className="text-2xl font-black">Product media</h2><p className="text-sm text-neutral-500">Upload an image or video first. Images: 3MB max. MP4/WEBM: 15MB max.</p></div>
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-neutral-300 p-6 font-semibold hover:border-clay dark:border-neutral-700">
          <ImagePlus size={19} /> Upload images or videos
          <input className="sr-only" accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm" multiple type="file" onChange={addBaseMedia} />
        </label>
        {firstPreview && <div className="rounded-lg bg-neutral-100 p-3 dark:bg-neutral-800"><p className="mb-2 text-xs font-bold uppercase tracking-wide text-neutral-500">First media preview</p><MediaPreview item={firstPreview} alt="First product media preview" className="max-h-80 w-full rounded-md object-contain" /></div>}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {form.media.map((item, index) => <div className="space-y-2 rounded-lg border border-neutral-200 p-2 dark:border-neutral-800" key={`${item.url || item.mediaData.slice(0, 30)}-${index}`}><div className="relative"><MediaPreview item={item} alt={`Product media ${index + 1}`} className="aspect-[4/3] w-full rounded-md object-cover" /><button className="absolute right-2 top-2 rounded-full bg-white p-2 text-red-600 shadow-soft dark:bg-neutral-900" type="button" title="Remove media" onClick={() => setForm((current) => ({ ...current, media: current.media.filter((_, itemIndex) => itemIndex !== index) }))}><Trash2 size={14} /></button></div><label className="block space-y-1"><span className="text-xs font-bold uppercase tracking-wide text-neutral-500">Assigned color</span><select className="w-full text-sm" value={item.color || ""} onChange={(event) => updateMedia(index, { color: event.target.value })}><option value="">Shared / default media</option>{form.variations.filter((variation) => variation.color.trim()).map((variation) => <option value={variation.color.trim()} key={variation.color.trim()}>{variation.color.trim()}</option>)}</select></label></div>)}
        </div>
        {mediaError && <p className="text-sm font-semibold text-red-600">{mediaError}</p>}
      </section>

      {canAddVariations && <section className="space-y-4 border-t border-neutral-200 pt-6 dark:border-neutral-800">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-bold uppercase tracking-wide text-clay">Step 3</p><h2 className="text-2xl font-black">Color variations</h2><p className="text-sm text-neutral-500">{initialProduct ? "Manage each color's media and availability." : "Add colors, then assign each media item to the matching variation."}</p></div><button className="btn-secondary" type="button" onClick={() => setForm((current) => ({ ...current, variations: [...current.variations, newVariation()] }))}><Plus size={16} /> Add color</button></div>
        {form.variations.map((variation, index) => <div className="space-y-3 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800" key={index}>
          <div className={`grid gap-3 ${initialProduct ? "md:grid-cols-[1fr_auto_auto]" : "md:grid-cols-[1fr_auto]"} md:items-center`}><input required placeholder="Color name, e.g. Olive" value={variation.color} onChange={(event) => updateVariation(index, { color: event.target.value })} />{initialProduct && <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={variation.outOfStock} onChange={(event) => updateVariation(index, { outOfStock: event.target.checked })} /> Out of stock</label>}<button className="btn-secondary text-red-600" type="button" onClick={() => removeVariation(index)}><Trash2 size={16} /> Remove</button></div>
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-semibold text-clay"><Video size={16} /> Add color-specific media<input className="sr-only" accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm" multiple type="file" onChange={(event) => addVariationMedia(index, event)} /></label>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">{form.media.filter((item) => item.color && item.color === variation.color.trim()).map((item, mediaIndex) => <MediaPreview item={item} alt={`${variation.color || "Color"} media ${mediaIndex + 1}`} className="aspect-square w-full rounded-md object-cover" key={`${item.url || item.mediaData.slice(0, 30)}-${mediaIndex}`} />)}</div>
        </div>)}
      </section>}

      {canAddVariations && <section className="space-y-4 border-t border-neutral-200 pt-6 dark:border-neutral-800">
        <div><p className="text-sm font-bold uppercase tracking-wide text-clay">Step 4</p><h2 className="text-2xl font-black">Sizes, pricing, and stock</h2><p className="text-sm text-neutral-500">Select at least one size. You can optionally override the base price for each selected size.</p></div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{PRODUCT_SIZES.map((name) => { const selected = form.sizes.find((size) => size.name === name); return <div className={`rounded-lg border p-3 ${selected ? "border-clay bg-clay/5" : "border-neutral-200 dark:border-neutral-800"}`} key={name}><label className="flex cursor-pointer items-center gap-2 font-semibold"><input type="checkbox" checked={Boolean(selected)} onChange={() => toggleSize(name)} /> {name}</label>{selected && <input aria-label={`Optional price for ${name}`} className="mt-3 w-full" min="0" step="0.01" type="number" placeholder="Optional price" value={selected.price} onChange={(event) => updateSize(name, { price: event.target.value })} />}</div>; })}</div>
        {sizeError && <p className="text-sm font-semibold text-red-600">{sizeError}</p>}
        <label className="block max-w-xs space-y-1"><span className="text-sm font-semibold">Total product stock</span><input className="w-full" required min="0" type="number" value={form.stock} onChange={(event) => setForm({ ...form, stock: event.target.value })} /></label>
      </section>}

      <button className="btn-primary w-full" disabled={!canAddVariations} type="submit">{submitLabel}</button>
    </form>
  );
}
