import React from "react";
import { ProductImage } from "./ProductImage.jsx";

export function normalizeBundleDiscount(value) {
  const discount = Number(value);
  return Number.isFinite(discount) && discount > 0 ? discount : 0;
}

export function formatBundleDiscount(value) {
  const discount = normalizeBundleDiscount(value);
  if (!discount) return "";
  return `${Number.isInteger(discount) ? discount : Number(discount.toFixed(1))}% OFF`;
}

function componentImage(component) {
  return component?.primaryImage || component?.imageUrl || "";
}

function validComponents(product) {
  return (product?.bundleComponents || [])
    .filter((component) => componentImage(component))
    .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0))
    .slice(0, 4);
}

function GridCell({ component, className = "" }) {
  return (
    <ProductImage
      className={`h-full w-full object-cover ${className}`}
      src={componentImage(component)}
      alt={component?.componentProductName || component?.name || "Included product"}
    />
  );
}

export function BundleImageGrid({ product, className = "" }) {
  const customImage = product?.customBundleImageUrl || "";
  if (customImage) {
    return <ProductImage className={`h-full w-full object-cover ${className}`} src={customImage} alt={product?.name || "Bundled product"} />;
  }

  const components = validComponents(product);
  if (components.length < 2) {
    return <ProductImage className={`h-full w-full object-cover ${className}`} src="" alt={product?.name || "Bundled product"} />;
  }

  if (components.length === 2) {
    return (
      <div className={`grid h-full w-full grid-cols-2 gap-1 overflow-hidden bg-neutral-100 dark:bg-neutral-950 ${className}`}>
        {components.map((component) => <GridCell component={component} key={component.componentProductId || component.id} />)}
      </div>
    );
  }

  if (components.length === 3) {
    return (
      <div className={`grid h-full w-full grid-cols-2 grid-rows-2 gap-1 overflow-hidden bg-neutral-100 dark:bg-neutral-950 ${className}`}>
        <GridCell component={components[0]} className="row-span-2" key={components[0].componentProductId || components[0].id} />
        {components.slice(1).map((component) => <GridCell component={component} key={component.componentProductId || component.id} />)}
      </div>
    );
  }

  return (
    <div className={`grid h-full w-full grid-cols-2 grid-rows-2 gap-1 overflow-hidden bg-neutral-100 dark:bg-neutral-950 ${className}`}>
      {components.map((component) => <GridCell component={component} key={component.componentProductId || component.id} />)}
    </div>
  );
}
