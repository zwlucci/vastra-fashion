import React from "react";
import { Trash2 } from "lucide-react";
import { useCart } from "../context/CartContext.jsx";
import { ProductImage } from "./ProductImage.jsx";
import { money } from "../utils/format.js";
import { useNotification } from "../context/NotificationContext.jsx";
import { getErrorMessage } from "../api/client.js";

export function CartItem({ item }) {
  const { items, updateQuantity, removeItem } = useCart();
  const { showNotice } = useNotification();
  const quantityInOtherSizes = items
    .filter((cartItem) => cartItem.id !== item.id && cartItem.product.id === item.product.id)
    .reduce((sum, cartItem) => sum + cartItem.quantity, 0);
  const availableForThisItem = Math.max(0, item.product.stock - quantityInOtherSizes);

  async function changeQuantity(event) {
    const quantity = Number(event.target.value);
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
    <div className="flex gap-4 border-b border-neutral-200 py-4 last:border-0 dark:border-neutral-800">
      <ProductImage className="h-24 w-20 rounded-md object-cover" src={item.product.imageUrl} alt={item.product.name} />
      <div className="min-w-0 flex-1">
        <p className="font-bold">{item.product.name}</p>
        <p className="text-sm text-neutral-500">{item.product.brand}</p>
        {item.selectedSize && <p className="text-sm text-neutral-500">Size: {item.selectedSize}</p>}
        {item.selectedColor && <p className="text-sm text-neutral-500">Color: {item.selectedColor}</p>}
        <p className="mt-2 font-semibold">{money(item.product.price)}</p>
      </div>
      <div className="flex flex-col items-end gap-2">
        <input className="w-20" disabled={availableForThisItem === 0} min="1" max={Math.max(1, availableForThisItem)} type="number" value={item.quantity} onChange={changeQuantity} />
        <span className="text-xs text-neutral-500">{item.product.stock} available</span>
        <button className="btn-secondary h-9 w-9 px-0 text-red-600" onClick={() => removeItem(item.id)} type="button" title="Remove">
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}
