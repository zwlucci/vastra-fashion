import React from "react";
import { Minus, Plus, Trash2 } from "lucide-react";
import { useCart } from "../context/CartContext.jsx";
import { ProductImage } from "./ProductImage.jsx";
import { money } from "../utils/format.js";
import { useNotification } from "../context/NotificationContext.jsx";
import { getErrorMessage } from "../api/client.js";

export function CartItem({ item }) {
  const { items, updateQuantity, removeItem } = useCart();
  const { showNotice } = useNotification();
  const availableForThisItem = Math.max(0, Number(item.reservedQuantity || 0) + Number(item.product.stock || 0));
  const reservationExpired = item.reservationExpired || item.reservationStatus === "expired";

  async function changeQuantity(quantity) {
    if (reservationExpired) {
      showNotice(item.reservationMessage || "This reservation expired. Please add it to your cart again.", "error");
      return;
    }
    if (quantity > availableForThisItem) {
      showNotice(`Only ${availableForThisItem} items are available for this selection.`);
      return;
    }
    try {
      await updateQuantity(item.id, Math.max(1, quantity || 1));
    } catch (error) {
      showNotice(getErrorMessage(error), "error");
    }
  }

  return (
    <div className="flex flex-wrap gap-4 border-b border-neutral-200 py-4 last:border-0 dark:border-neutral-800 sm:flex-nowrap">
      <ProductImage className="h-28 w-24 shrink-0 rounded-lg object-contain" src={item.product.imageUrl} alt={item.product.name} />
      <div className="min-w-0 flex-1">
        <p className="font-bold">{item.product.name}</p>
        <p className="text-sm text-neutral-500">{item.product.brand}</p>
        {item.selectedSize && <p className="text-sm text-neutral-500">Size: {item.selectedSize}</p>}
        {item.selectedColor && <p className="text-sm text-neutral-500">Color: {item.selectedColor}</p>}
        {reservationExpired && <p className="mt-2 rounded-md bg-red-50 p-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">{item.reservationMessage}</p>}
        <p className="mt-2 font-semibold">{money(item.product.price)}</p>
      </div>
      <div className="ml-auto flex flex-col items-end gap-2">
        <div className="flex items-center rounded-md border border-neutral-200 dark:border-neutral-700"><button className="flex h-9 w-9 items-center justify-center" disabled={reservationExpired || item.quantity <= 1} onClick={() => changeQuantity(item.quantity - 1)} type="button" aria-label="Decrease quantity"><Minus size={14} /></button><span className="w-8 text-center text-sm font-bold">{item.quantity}</span><button className="flex h-9 w-9 items-center justify-center" disabled={reservationExpired || item.quantity >= availableForThisItem} onClick={() => changeQuantity(item.quantity + 1)} type="button" aria-label="Increase quantity"><Plus size={14} /></button></div>
        <span className="text-xs text-neutral-500">{reservationExpired ? "Reservation expired" : `${item.reservedQuantity} reserved for you`}</span>
        <button className="btn-secondary h-9 w-9 px-0 text-red-600" onClick={() => removeItem(item.id)} type="button" title="Remove">
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}
