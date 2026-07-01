import React, { useEffect, useState } from "react";
import { UserCircle } from "lucide-react";
import { avatarUrl } from "../api/client.js";

export function UserAvatar({ user, preview, size = "md", className = "" }) {
  const src = preview || avatarUrl(user);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  const sizes = {
    sm: "h-6 w-6",
    md: "h-10 w-10",
    lg: "h-16 w-16",
    xl: "h-20 w-20"
  };
  const iconSizes = {
    sm: 17,
    md: 22,
    lg: 34,
    xl: 42
  };
  const sizeClass = sizes[size] || sizes.md;

  if (src && !failed) {
    return (
      <img
        className={`${sizeClass} rounded-full object-cover ${className}`}
        src={src}
        alt={user?.name || "Profile"}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <span className={`${sizeClass} flex items-center justify-center rounded-full bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 ${className}`}>
      <UserCircle size={iconSizes[size] || iconSizes.md} />
    </span>
  );
}
