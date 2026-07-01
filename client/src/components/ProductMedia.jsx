import React from "react";
import { resolveImageUrl } from "../api/client.js";
import { ProductImage } from "./ProductImage.jsx";

export function isVideoMedia(media) {
  return media?.type === "video" || /\.(mp4|webm)(\?|$)/i.test(media?.url || "");
}

export function ProductMedia({ media, src, alt = "Product media", className = "", controls = false, autoPlay = false }) {
  const item = media || { url: src, type: /\.(mp4|webm)(\?|$)/i.test(src || "") ? "video" : "image" };
  if (isVideoMedia(item)) {
    return (
      <video
        className={className}
        src={resolveImageUrl(item.url)}
        aria-label={alt}
        controls={controls}
        autoPlay={autoPlay}
        muted
        loop={autoPlay}
        playsInline
        preload="metadata"
      />
    );
  }
  return <ProductImage className={className} src={item.url} alt={alt} />;
}
