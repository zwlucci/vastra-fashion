import { Download, FolderOpen, Minus, Plus, RotateCcw, Save, Shirt, Trash2, X } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { api, getErrorMessage, resolveImageUrl } from "../api/client.js";
import { GuestAccessCard } from "../components/GuestAccessCard.jsx";
import { ProductImage } from "../components/ProductImage.jsx";
import { useAuth } from "../context/AuthContext.jsx";

function loadCanvasImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("A wardrobe image could not be loaded for export."));
    image.src = resolveImageUrl(src);
  });
}

export function Wardrobe() {
  const { isAuthenticated } = useAuth();
  const boardRef = useRef(null);
  const dragRef = useRef(null);
  const [items, setItems] = useState([]);
  const [placed, setPlaced] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [combos, setCombos] = useState([]);
  const [activeComboId, setActiveComboId] = useState("");
  const [comboName, setComboName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!isAuthenticated) { setLoading(false); return; }
    Promise.all([api.get("/wardrobe"), api.get("/wardrobe/combos")])
      .then(([wardrobeResponse, comboResponse]) => {
        setItems(wardrobeResponse.data.items || []);
        setCombos(comboResponse.data.combos || []);
      })
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [isAuthenticated]);

  useEffect(() => {
    const board = boardRef.current;
    if (!board || typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(([record]) => {
      const { width, height } = record.contentRect;
      setPlaced((current) => {
        let changed = false;
        const next = current.map((entry) => {
          const size = Math.min(entry.size, width, height);
          const x = Math.max(0, Math.min(width - size, entry.x));
          const y = Math.max(0, Math.min(height - size, entry.y));
          if (size === entry.size && x === entry.x && y === entry.y) return entry;
          changed = true;
          return { ...entry, size, x, y };
        });
        return changed ? next : current;
      });
    });
    observer.observe(board);
    return () => observer.disconnect();
  }, []);

  function metadataFor(entry) {
    const savedItem = items.find((item) => item.product.id === entry.productId);
    return savedItem ? {
      name: savedItem.product.name,
      imageUrl: savedItem.product.wardrobeImageUrl || savedItem.product.imageUrl
    } : { name: entry.name || "Wardrobe item", imageUrl: entry.imageUrl || "" };
  }

  function selectAndBringForward(productId) {
    setSelectedId(productId);
    setPlaced((current) => {
      const highest = current.reduce((maximum, entry) => Math.max(maximum, entry.z || 1), 0);
      return current.map((entry) => entry.productId === productId ? { ...entry, z: highest + 1 } : entry);
    });
  }

  function startListDrag(event, productId) {
    event.dataTransfer.setData("text/wardrobe-product", productId);
    event.dataTransfer.effectAllowed = "copy";
  }

  function positionProduct(productId, requestedX, requestedY) {
    const item = items.find((entry) => entry.product.id === productId);
    const rect = boardRef.current?.getBoundingClientRect();
    if (!item || !rect) return;
    setPlaced((current) => {
      const existing = current.find((entry) => entry.productId === productId);
      const size = Math.min(existing?.size || 180, rect.width, rect.height);
      const x = Math.max(0, Math.min(rect.width - size, requestedX));
      const y = Math.max(0, Math.min(rect.height - size, requestedY));
      const z = current.reduce((maximum, entry) => Math.max(maximum, entry.z || 1), 0) + 1;
      return existing
        ? current.map((entry) => entry.productId === productId ? { ...entry, x, y, size, z } : entry)
        : [...current, { productId, x, y, size, z }];
    });
    setSelectedId(productId);
  }

  function dropOnBoard(event) {
    event.preventDefault();
    const productId = event.dataTransfer.getData("text/wardrobe-product");
    const rect = boardRef.current?.getBoundingClientRect();
    if (!productId || !rect) return;
    const existing = placed.find((entry) => entry.productId === productId);
    const size = existing?.size || 180;
    positionProduct(productId, event.clientX - rect.left - size / 2, event.clientY - rect.top - size / 2);
  }

  function placeOnBoard(productId) {
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect) return;
    const size = placed.find((entry) => entry.productId === productId)?.size || 180;
    positionProduct(productId, (rect.width - size) / 2, (rect.height - size) / 2);
  }

  function beginMove(event, entry) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect) return;
    selectAndBringForward(entry.productId);
    dragRef.current = {
      productId: entry.productId,
      pointerId: event.pointerId,
      offsetX: event.clientX - rect.left - entry.x,
      offsetY: event.clientY - rect.top - entry.y
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveItem(event) {
    const drag = dragRef.current;
    const rect = boardRef.current?.getBoundingClientRect();
    if (!drag || drag.pointerId !== event.pointerId || !rect) return;
    setPlaced((current) => current.map((entry) => {
      if (entry.productId !== drag.productId) return entry;
      return {
        ...entry,
        x: Math.max(0, Math.min(rect.width - entry.size, event.clientX - rect.left - drag.offsetX)),
        y: Math.max(0, Math.min(rect.height - entry.size, event.clientY - rect.top - drag.offsetY))
      };
    }));
  }

  function endMove(event) {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
  }

  function resize(productId, delta) {
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPlaced((current) => current.map((entry) => {
      if (entry.productId !== productId) return entry;
      const maximum = Math.max(80, Math.min(360, rect.width - entry.x, rect.height - entry.y));
      return { ...entry, size: Math.max(80, Math.min(maximum, entry.size + delta)) };
    }));
  }

  function removeFromBoard(productId) {
    setPlaced((current) => current.filter((entry) => entry.productId !== productId));
    if (selectedId === productId) setSelectedId("");
  }

  async function removeSaved(productId) {
    setError("");
    try {
      const { data } = await api.delete(`/wardrobe/${productId}`);
      setItems(data.items || []);
      removeFromBoard(productId);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function saveCombo() {
    setError("");
    setMessage("");
    if (comboName.trim().length < 2) { setError("Give your combo a name with at least two characters."); return; }
    if (!placed.length) { setError("Place at least one item on the board."); return; }
    setSaving(true);
    try {
      const payload = { name: comboName.trim(), items: placed.map(({ productId, x, y, size, z }) => ({ productId, x, y, size, z })) };
      const { data } = activeComboId
        ? await api.put(`/wardrobe/combos/${activeComboId}`, payload)
        : await api.post("/wardrobe/combos", payload);
      setCombos((current) => [data.combo, ...current.filter((combo) => combo.id !== data.combo.id)]);
      setActiveComboId(data.combo.id);
      setMessage(activeComboId ? "Combo updated." : "Combo saved.");
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  function loadCombo(combo) {
    const rect = boardRef.current?.getBoundingClientRect();
    setPlaced((combo.items || []).map((entry, index) => {
      if (!rect) return { ...entry, z: entry.z || index + 1 };
      const size = Math.min(entry.size, rect.width, rect.height);
      return {
        ...entry,
        size,
        x: Math.max(0, Math.min(rect.width - size, entry.x)),
        y: Math.max(0, Math.min(rect.height - size, entry.y)),
        z: entry.z || index + 1
      };
    }));
    setActiveComboId(combo.id);
    setComboName(combo.name);
    setSelectedId("");
    setError("");
    setMessage(`Loaded ${combo.name}.`);
  }

  async function deleteCombo(comboId) {
    setError("");
    try {
      await api.delete(`/wardrobe/combos/${comboId}`);
      setCombos((current) => current.filter((combo) => combo.id !== comboId));
      if (activeComboId === comboId) {
        setActiveComboId("");
        setComboName("");
      }
      setMessage("Combo deleted.");
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function exportBoard() {
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect || !placed.length) return;
    setError("");
    try {
      const scale = 2;
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(rect.width * scale);
      canvas.height = Math.round(rect.height * scale);
      const context = canvas.getContext("2d");
      context.scale(scale, scale);
      const dark = document.documentElement.classList.contains("dark");
      const gradient = context.createLinearGradient(0, 0, rect.width, rect.height);
      gradient.addColorStop(0, dark ? "#171717" : "#ffffff");
      gradient.addColorStop(1, dark ? "#0a0a0a" : "#f5f5f5");
      context.fillStyle = gradient;
      context.fillRect(0, 0, rect.width, rect.height);
      const ordered = [...placed].sort((a, b) => (a.z || 1) - (b.z || 1));
      for (const entry of ordered) {
        const metadata = metadataFor(entry);
        const image = await loadCanvasImage(metadata.imageUrl);
        const ratio = Math.min(entry.size / image.naturalWidth, entry.size / image.naturalHeight);
        const width = image.naturalWidth * ratio;
        const height = image.naturalHeight * ratio;
        context.drawImage(image, entry.x + (entry.size - width) / 2, entry.y + (entry.size - height) / 2, width, height);
      }
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("Could not create the image file.");
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${comboName.trim() || "vastra-wardrobe-combo"}.png`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      setError(err.message || "Could not export this combo.");
    }
  }

  function resetBoard() {
    setPlaced([]);
    setSelectedId("");
    setActiveComboId("");
    setComboName("");
  }

  if (!isAuthenticated) return <GuestAccessCard title="Wardrobe" message="Login to create and explore your wardrobe." />;

  return (
    <section className="mx-auto max-w-[1500px] space-y-6 px-4 py-10">
      <div><p className="text-sm font-bold uppercase tracking-wide text-clay">2D preview</p><h1 className="text-4xl font-black">My Wardrobe</h1><p className="mt-2 text-neutral-500">Arrange saved clothing, layer pieces, save combinations, and export the board as a PNG.</p></div>
      {(error || message) && <p className={`rounded-md p-3 text-sm ${error ? "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-200" : "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-200"}`}>{error || message}</p>}
      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(300px,0.72fr)_minmax(0,1.28fr)] lg:items-start">
        <section className="min-w-0 overflow-hidden">
          <div className="mb-3"><h2 className="text-2xl font-black">Wardrobe pieces</h2><p className="text-sm text-neutral-500">Drag a piece to the board or place it in the center.</p></div>
          <div className="max-h-[520px] min-w-0 overflow-x-hidden overflow-y-auto overscroll-contain rounded-2xl border border-neutral-200 bg-neutral-50/60 p-3 dark:border-neutral-800 dark:bg-neutral-950/40 sm:p-4 lg:h-[620px] lg:max-h-[620px]">
            {loading ? <p className="panel text-neutral-500">Loading wardrobe...</p> : items.length ? <div className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">{items.map((item) => <article className="panel min-w-0 cursor-grab overflow-hidden active:cursor-grabbing" draggable onDragStart={(event) => startListDrag(event, item.product.id)} key={item.id}><ProductImage className="aspect-square w-full rounded-md object-contain" src={item.product.wardrobeImageUrl || item.product.imageUrl} alt={item.product.name} /><div className="mt-3 flex min-w-0 items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-bold">{item.product.name}</p><p className="truncate text-sm text-neutral-500">{item.product.brand}</p></div><button className="btn-secondary h-9 w-9 shrink-0 px-0 text-red-600" onClick={() => removeSaved(item.product.id)} type="button" title="Remove from wardrobe"><Trash2 size={15} /></button></div><button className="btn-secondary mt-3 h-9 max-w-full px-3" onClick={() => placeOnBoard(item.product.id)} type="button"><Shirt size={14} /> Place on board</button></article>)}</div> : <div className="panel py-10 text-center text-neutral-500">Your wardrobe is empty. Add enabled products from their detail pages.</div>}
          </div>
        </section>

        <section className="min-w-0 lg:sticky lg:top-24 lg:self-start">
          <div className="mb-3 space-y-3"><div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-2xl font-black">Preview board</h2><p className="text-sm text-neutral-500">Click a piece to select it and bring it forward.</p></div><div className="flex flex-wrap gap-2"><button className="btn-secondary" disabled={!placed.length} onClick={exportBoard} type="button"><Download size={16} /> Download Combo Image</button><button className="btn-secondary" disabled={!placed.length} onClick={resetBoard} type="button"><RotateCcw size={16} /> Reset</button></div></div><div className="flex flex-col gap-2 sm:flex-row"><input className="min-w-0 flex-1" maxLength="80" placeholder="Combo name" value={comboName} onChange={(event) => setComboName(event.target.value)} /><button className="btn-primary sm:min-w-40" disabled={saving || !placed.length} onClick={saveCombo} type="button"><Save size={16} /> {saving ? "Saving..." : activeComboId ? "Update combo" : "Save combo"}</button></div></div>
          <div className="relative h-[520px] touch-none overflow-hidden rounded-2xl border-2 border-dashed border-neutral-300 bg-gradient-to-br from-white to-neutral-100 shadow-inner dark:border-neutral-700 dark:from-neutral-900 dark:to-neutral-950 sm:h-[620px]" ref={boardRef} onPointerDown={(event) => { if (event.target === event.currentTarget) setSelectedId(""); }} onDragOver={(event) => event.preventDefault()} onDrop={dropOnBoard}>
            {!placed.length && <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center text-neutral-400"><Shirt size={48} /><p className="mt-3 font-semibold">Drag clothing here</p></div>}
            {placed.map((entry) => { const metadata = metadataFor(entry); if (!metadata.imageUrl) return null; const selected = selectedId === entry.productId; return <div className="absolute cursor-move select-none" onPointerDown={(event) => beginMove(event, entry)} onPointerMove={moveItem} onPointerUp={endMove} onPointerCancel={endMove} style={{ left: entry.x, top: entry.y, width: entry.size, height: entry.size, zIndex: entry.z || 1 }} key={entry.productId}><ProductImage className="pointer-events-none h-full w-full object-contain drop-shadow-xl" src={metadata.imageUrl} alt={metadata.name} />{selected && <div className="absolute right-0 top-0 flex -translate-y-1/2 gap-1 rounded-full bg-white p-1 shadow-soft dark:bg-neutral-900" onPointerDown={(event) => event.stopPropagation()}><button className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800" onClick={() => resize(entry.productId, -20)} type="button" title="Decrease size"><Minus size={13} /></button><button className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800" onClick={() => resize(entry.productId, 20)} type="button" title="Increase size"><Plus size={13} /></button><button className="flex h-7 w-7 items-center justify-center rounded-full text-red-600 hover:bg-red-50 dark:hover:bg-red-950" onClick={() => removeFromBoard(entry.productId)} type="button" title="Remove from board"><X size={13} /></button></div>}</div>; })}
          </div>
        </section>
      </div>

      <section className="min-w-0 space-y-4 border-t border-neutral-200 pt-7 dark:border-neutral-800">
        <div><p className="text-sm font-bold uppercase tracking-wide text-clay">Your looks</p><h2 className="text-2xl font-black">Saved Combos</h2><p className="text-sm text-neutral-500">Reopen a saved look, continue editing it, or remove it from your account.</p></div>
        {combos.length ? <div className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3">{combos.map((combo) => <article className={`panel flex min-w-0 items-center justify-between gap-3 p-4 ${activeComboId === combo.id ? "ring-2 ring-clay" : ""}`} key={combo.id}><div className="min-w-0"><p className="truncate font-bold">{combo.name}</p><p className="text-xs text-neutral-500">Updated {new Date(combo.updatedAt).toLocaleDateString()} · {combo.items.length} piece{combo.items.length === 1 ? "" : "s"}</p></div><div className="flex shrink-0 gap-2"><button className="btn-secondary h-9 w-9 px-0" onClick={() => loadCombo(combo)} type="button" title="Load combo"><FolderOpen size={15} /></button><button className="btn-secondary h-9 w-9 px-0 text-red-600" onClick={() => deleteCombo(combo.id)} type="button" title="Delete combo"><Trash2 size={15} /></button></div></article>)}</div> : <div className="panel py-10 text-center text-neutral-500">No saved combinations yet.</div>}
      </section>
    </section>
  );
}
