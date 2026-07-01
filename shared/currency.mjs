const amountFormatter = new Intl.NumberFormat("en-NP", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2
});

export function formatCurrency(value) {
  const amount = Number(value);
  return `NPR ${amountFormatter.format(Number.isFinite(amount) ? amount : 0)}`;
}
