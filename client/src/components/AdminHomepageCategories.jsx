import { Edit3, Eye, EyeOff, Plus, Save, Trash2, X } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { api, getErrorMessage } from "../api/client.js";
import { ProductImage } from "./ProductImage.jsx";
import { SearchableCategorySelect } from "./SearchableCategorySelect.jsx";

const emptyForm = {
  displayName: "",
  mappedCategory: "",
  iconData: "",
  iconPreview: "",
  isActive: true,
  displayOrder: 0
};

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function DeleteModal({ shortcut, saving, onCancel, onConfirm }) {
  if (!shortcut) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm" onPointerDown={(event) => event.target === event.currentTarget && !saving && onCancel()}>
      <div aria-labelledby="delete-homepage-category-title" aria-modal="true" className="panel w-full max-w-md space-y-5 shadow-2xl" role="dialog" onPointerDown={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div><p className="text-sm font-bold uppercase tracking-wide text-clay">Remove shortcut</p><h2 className="mt-1 text-2xl font-black" id="delete-homepage-category-title">Remove homepage category?</h2></div>
          <button aria-label="Close" className="btn-secondary h-9 w-9 px-0" disabled={saving} onClick={onCancel} type="button"><X size={16} /></button>
        </div>
        <p className="text-sm leading-6 text-neutral-600 dark:text-neutral-300">This only removes the homepage shortcut for <strong>{shortcut.displayName}</strong>. Products and product categories are not deleted.</p>
        <div className="flex justify-end gap-3">
          <button className="btn-secondary" disabled={saving} onClick={onCancel} type="button">Cancel</button>
          <button className="btn-primary bg-red-600 hover:bg-red-700 dark:bg-red-600 dark:text-white dark:hover:bg-red-700" disabled={saving} onClick={onConfirm} type="button">{saving ? "Removing..." : "Remove"}</button>
        </div>
      </div>
    </div>
  );
}

export function AdminHomepageCategories() {
  const [visible, setVisible] = useState(true);
  const [shortcuts, setShortcuts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const duplicateCategory = useMemo(() => {
    if (!form.mappedCategory) return false;
    return shortcuts.some((shortcut) => shortcut.mappedCategory === form.mappedCategory && shortcut.id !== editingId);
  }, [editingId, form.mappedCategory, shortcuts]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/admin/homepage-categories");
      setVisible(data.visible !== false);
      setShortcuts(data.shortcuts || []);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
    setError("");
  }

  function editShortcut(shortcut) {
    setEditingId(shortcut.id);
    setForm({
      displayName: shortcut.displayName,
      mappedCategory: shortcut.mappedCategory,
      iconData: "",
      iconPreview: shortcut.iconUrl,
      isActive: shortcut.isActive,
      displayOrder: shortcut.displayOrder
    });
    setError("");
  }

  async function chooseIcon(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) {
      setError("Icon must be JPG, PNG, WEBP, or GIF.");
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      setError("Icon must be smaller than 3MB.");
      return;
    }
    const dataUrl = await fileToDataUrl(file);
    setForm((current) => ({ ...current, iconData: dataUrl, iconPreview: dataUrl }));
    setError("");
  }

  async function saveVisibility(nextVisible) {
    setSaving(true);
    setError("");
    try {
      await api.patch("/admin/homepage-categories/visibility", { visible: nextVisible });
      setVisible(nextVisible);
      setNotice(nextVisible ? "Homepage category shortcuts enabled." : "Homepage category shortcuts disabled.");
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function submitForm(event) {
    event.preventDefault();
    setNotice("");
    setError("");
    if (!form.displayName.trim()) {
      setError("Display name is required.");
      return;
    }
    if (!form.mappedCategory) {
      setError("Mapped category is required.");
      return;
    }
    if (!editingId && !form.iconData) {
      setError("Icon is required when creating a new shortcut.");
      return;
    }
    if (duplicateCategory) {
      setError("A shortcut for this mapped category already exists.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        displayName: form.displayName,
        mappedCategory: form.mappedCategory,
        iconData: form.iconData,
        isActive: form.isActive,
        displayOrder: Number(form.displayOrder || 0)
      };
      if (editingId) {
        await api.patch(`/admin/homepage-categories/${editingId}`, payload);
        setNotice("Homepage category shortcut updated.");
      } else {
        await api.post("/admin/homepage-categories", payload);
        setNotice("Homepage category shortcut created.");
      }
      resetForm();
      await load();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function quickUpdate(shortcut, patch) {
    setSaving(true);
    setNotice("");
    setError("");
    try {
      await api.patch(`/admin/homepage-categories/${shortcut.id}`, {
        displayName: shortcut.displayName,
        mappedCategory: shortcut.mappedCategory,
        iconData: "",
        isActive: shortcut.isActive,
        displayOrder: shortcut.displayOrder,
        ...patch
      });
      setNotice("Homepage category shortcut updated.");
      await load();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function removeShortcut() {
    if (!deleteTarget) return;
    setSaving(true);
    setNotice("");
    setError("");
    try {
      await api.delete(`/admin/homepage-categories/${deleteTarget.id}`);
      setNotice("Homepage category shortcut removed.");
      setDeleteTarget(null);
      if (editingId === deleteTarget.id) resetForm();
      await load();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {(notice || error) && <p className={`rounded-md p-3 text-sm ${error ? "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-200" : "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-200"}`}>{error || notice}</p>}

      <section className="panel flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-black">Show category shortcuts on homepage</h3>
          <p className="mt-1 text-sm text-neutral-500">Turn the entire homepage shortcut row on or off.</p>
        </div>
        <button className={visible ? "btn-primary" : "btn-secondary"} disabled={saving} onClick={() => saveVisibility(!visible)} type="button">
          {visible ? <Eye size={17} /> : <EyeOff size={17} />}
          {visible ? "Visible" : "Hidden"}
        </button>
      </section>

      <section className="panel">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-xl font-black">{editingId ? "Edit shortcut" : "Add category shortcut"}</h3>
            <p className="mt-1 text-sm text-neutral-500">Choose an existing product category and upload a circular-friendly icon.</p>
          </div>
          {editingId && <button className="btn-secondary" disabled={saving} onClick={resetForm} type="button"><Plus size={17} /> New shortcut</button>}
        </div>
        <form className="grid gap-4 lg:grid-cols-[1fr_1fr_140px] lg:items-end" onSubmit={submitForm}>
          <label className="space-y-1">
            <span className="text-xs font-bold uppercase tracking-wide text-neutral-500">Display name</span>
            <input className="w-full" value={form.displayName} onChange={(event) => setForm((current) => ({ ...current, displayName: event.target.value }))} />
          </label>
          <div className="space-y-1">
            <span className="text-xs font-bold uppercase tracking-wide text-neutral-500">Mapped category</span>
            <SearchableCategorySelect allowEmpty value={form.mappedCategory} onChange={(category) => setForm((current) => ({ ...current, mappedCategory: category }))} emptyLabel="Choose category" />
          </div>
          <label className="space-y-1">
            <span className="text-xs font-bold uppercase tracking-wide text-neutral-500">Display order</span>
            <input className="w-full" min="0" type="number" value={form.displayOrder} onChange={(event) => setForm((current) => ({ ...current, displayOrder: event.target.value }))} />
          </label>
          <label className="space-y-1 lg:col-span-2">
            <span className="text-xs font-bold uppercase tracking-wide text-neutral-500">Icon upload</span>
            <input className="w-full" accept="image/jpeg,image/png,image/webp,image/gif" type="file" onChange={chooseIcon} />
          </label>
          <label className="flex items-center gap-3 rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
            <input className="h-4 w-4" type="checkbox" checked={form.isActive} onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))} />
            <span className="text-sm font-bold">Active</span>
          </label>
          <div className="flex flex-wrap items-center gap-4 lg:col-span-3">
            <ProductImage className="h-16 w-16 rounded-full border border-neutral-200 object-cover p-1 dark:border-neutral-800" fallbackClassName="rounded-full" src={form.iconPreview} alt="Shortcut icon preview" />
            <div className="flex gap-3">
              <button className="btn-primary" disabled={saving} type="submit"><Save size={17} /> {saving ? "Saving..." : editingId ? "Save changes" : "Create shortcut"}</button>
              <button className="btn-secondary" disabled={saving} onClick={resetForm} type="button">Cancel</button>
            </div>
          </div>
        </form>
      </section>

      <section className="panel">
        <div className="mb-5 flex items-center justify-between gap-3">
          <h3 className="text-xl font-black">Existing shortcuts</h3>
          <button className="btn-secondary" disabled={loading} onClick={load} type="button">Refresh</button>
        </div>
        {loading ? <p className="py-8 text-center text-sm text-neutral-500">Loading homepage categories...</p> : (
          <div className="grid gap-3">
            {shortcuts.map((shortcut) => (
              <article className="grid gap-4 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800 md:grid-cols-[auto_1fr_auto] md:items-center" key={shortcut.id}>
                <ProductImage className="h-16 w-16 rounded-full object-cover" fallbackClassName="rounded-full" src={shortcut.iconUrl} alt={`${shortcut.displayName} icon`} />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-black">{shortcut.displayName}</p>
                    <span className={`badge ${shortcut.isActive ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-200" : "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300"}`}>{shortcut.isActive ? "Active" : "Inactive"}</span>
                  </div>
                  <p className="mt-1 text-sm text-neutral-500">{shortcut.mappedCategory} - Order {shortcut.displayOrder}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button className="btn-secondary h-9 px-3" disabled={saving} onClick={() => quickUpdate(shortcut, { isActive: !shortcut.isActive })} type="button">{shortcut.isActive ? <EyeOff size={15} /> : <Eye size={15} />} {shortcut.isActive ? "Disable" : "Enable"}</button>
                  <button className="btn-secondary h-9 px-3" disabled={saving} onClick={() => editShortcut(shortcut)} type="button"><Edit3 size={15} /> Edit</button>
                  <button className="btn-secondary h-9 px-3 text-red-600" disabled={saving} onClick={() => setDeleteTarget(shortcut)} type="button"><Trash2 size={15} /> Remove</button>
                </div>
              </article>
            ))}
            {!shortcuts.length && <p className="py-8 text-center text-sm text-neutral-500">No homepage category shortcuts have been configured yet.</p>}
          </div>
        )}
      </section>

      <DeleteModal shortcut={deleteTarget} saving={saving} onCancel={() => setDeleteTarget(null)} onConfirm={removeShortcut} />
    </div>
  );
}
