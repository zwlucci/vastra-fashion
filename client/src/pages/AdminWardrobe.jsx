import { ArrowLeft, Edit3, ImagePlus, Save, Trash2, X } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api, getErrorMessage } from "../api/client.js";
import { ProductImage } from "../components/ProductImage.jsx";

function readFile(file) {
  return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); });
}

export function AdminWardrobe() {
  const [products, setProducts] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ wardrobeEnabled: false, wardrobeImageData: "", removeWardrobeImage: false });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const editorRef = useRef(null);

  async function loadProducts() {
    const { data } = await api.get("/admin/wardrobe/products");
    setProducts(data.products || []);
  }

  useEffect(() => { loadProducts().catch((err) => setError(getErrorMessage(err))).finally(() => setLoading(false)); }, []);
  useEffect(() => { if (editing) editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }, [editing]);

  function beginEdit(product) {
    setEditing(product);
    setForm({ wardrobeEnabled: product.wardrobeEnabled, wardrobeImageData: "", removeWardrobeImage: false });
    setMessage(""); setError("");
  }

  async function chooseImage(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type) || file.size > 3 * 1024 * 1024) { setError("Choose a JPG, PNG, WEBP, or GIF smaller than 3MB."); event.target.value = ""; return; }
    const wardrobeImageData = await readFile(file);
    setForm((current) => ({ ...current, wardrobeImageData, removeWardrobeImage: false }));
  }

  async function save() {
    setSaving(true); setError(""); setMessage("");
    try {
      await api.patch(`/admin/wardrobe/products/${editing.id}`, form);
      await loadProducts();
      setEditing(null);
      setMessage("Wardrobe settings saved.");
    } catch (err) { setError(getErrorMessage(err)); } finally { setSaving(false); }
  }

  return (
    <section className="mx-auto max-w-7xl space-y-6 px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-sm font-bold uppercase tracking-wide text-clay">Admin</p><h1 className="text-4xl font-black">Wardrobe dashboard</h1><p className="mt-2 text-neutral-500">Control which products support the 2D wardrobe and manage their preview images.</p></div><Link className="btn-secondary" to="/admin/dashboard"><ArrowLeft size={16} /> Main dashboard</Link></div>
      {(message || error) && <p className={`rounded-md p-3 text-sm ${error ? "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-200" : "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-200"}`}>{error || message}</p>}
      {editing && <div className="panel scroll-mt-24 space-y-5" ref={editorRef}><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-bold uppercase tracking-wide text-clay">Editing</p><h2 className="text-2xl font-black">{editing.name}</h2></div><button className="btn-secondary h-10 w-10 px-0" onClick={() => setEditing(null)} type="button"><X size={16} /></button></div><div className="grid gap-5 md:grid-cols-[220px_1fr]"><ProductImage className="aspect-square w-full rounded-lg bg-neutral-100 object-contain dark:bg-neutral-800" src={form.wardrobeImageData || (!form.removeWardrobeImage && editing.wardrobeImageUrl) || editing.imageUrl} alt={`${editing.name} wardrobe preview`} /><div className="space-y-4"><label className="flex items-center gap-3 font-semibold"><input type="checkbox" checked={form.wardrobeEnabled} onChange={(event) => setForm({ ...form, wardrobeEnabled: event.target.checked })} /> Enable wardrobe access</label><label className="inline-flex cursor-pointer items-center gap-2 text-sm font-semibold text-clay"><ImagePlus size={17} /> Upload/change wardrobe-ready image<input className="sr-only" accept="image/png,image/jpeg,image/webp,image/gif" type="file" onChange={chooseImage} /></label>{(editing.wardrobeImageUrl || form.wardrobeImageData) && <button className="btn-secondary text-red-600" onClick={() => setForm({ ...form, wardrobeImageData: "", removeWardrobeImage: true })} type="button"><Trash2 size={15} /> Remove wardrobe image</button>}<p className="text-sm text-neutral-500">Transparent PNG or WEBP works best. Normal images are also accepted.</p><button className="btn-primary" disabled={saving} onClick={save} type="button"><Save size={16} /> {saving ? "Saving..." : "Save changes"}</button></div></div></div>}
      {loading ? <p className="panel text-neutral-500">Loading products...</p> : <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900"><div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead className="bg-neutral-100 text-xs uppercase text-neutral-500 dark:bg-neutral-800"><tr><th className="px-4 py-3">Product</th><th className="px-4 py-3">Vendor</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Wardrobe image</th><th className="px-4 py-3">Access</th><th className="px-4 py-3">Action</th></tr></thead><tbody>{products.map((product) => <tr className="border-t border-neutral-200 dark:border-neutral-800" key={product.id}><td className="px-4 py-3"><div className="flex items-center gap-3"><ProductImage className="h-16 w-14 rounded object-cover" src={product.imageUrl} alt={product.name} /><span className="font-semibold">{product.name}</span></div></td><td className="px-4 py-3">{product.brand}</td><td className="px-4 py-3"><span className="badge bg-neutral-100 dark:bg-neutral-800">{product.status}</span></td><td className="px-4 py-3">{product.wardrobeImageUrl ? <ProductImage className="h-16 w-16 rounded bg-neutral-100 object-contain dark:bg-neutral-800" src={product.wardrobeImageUrl} alt={`${product.name} wardrobe image`} /> : <span className="text-neutral-500">Uses product image</span>}</td><td className="px-4 py-3"><span className={`badge ${product.wardrobeEnabled ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200" : "bg-neutral-100 text-neutral-600 dark:bg-neutral-800"}`}>{product.wardrobeEnabled ? "Enabled" : "Disabled"}</span></td><td className="px-4 py-3"><button className="btn-secondary" onClick={() => beginEdit(product)} type="button"><Edit3 size={15} /> Edit</button></td></tr>)}</tbody></table></div></div>}
    </section>
  );
}
