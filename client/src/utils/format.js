export { formatCurrency as money } from "../../../shared/currency.mjs";

export function roleLabel(role) {
  return role ? role.charAt(0).toUpperCase() + role.slice(1) : "Guest";
}

export function statusClass(status) {
  const map = {
    approved: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200",
    pending: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
    rejected: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
    delivered: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200",
    delivery_refused: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
    shipped: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
    processing: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200",
    cancelled: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200"
  };
  return map[status] || "bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-100";
}
