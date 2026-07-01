import React, { useEffect, useMemo, useState } from "react";
import { ImageOff } from "lucide-react";
import { resolveImageUrl } from "../api/client.js";

export function ProductImage({ src, alt = "Product image", className = "", fallbackClassName = "" }) {
  const [failed, setFailed] = useState(false);
  const resolvedSrc = useMemo(() => resolveImageUrl(src), [src]);

  useEffect(() => {
    setFailed(false);
  }, [resolvedSrc]);

  if (!resolvedSrc || failed) {
    return (
      <div
        className={`flex items-center justify-center bg-neutral-100 text-neutral-400 dark:bg-neutral-800 dark:text-neutral-500 ${className} ${fallbackClassName}`}
        role="img"
        aria-label={alt}
      >
        <ImageOff size={24} />
      </div>
    );
  }

  if (/\.(mp4|webm)(\?|$)/i.test(resolvedSrc)) {
    return <video className={className} src={resolvedSrc} aria-label={alt} muted playsInline preload="metadata" />;
  }

  return (
    <img
      className={className}
      src={resolvedSrc}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}
