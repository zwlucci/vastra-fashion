import { ChevronDown, Heart, LogOut, Shirt } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useWishlist } from "../context/WishlistContext.jsx";
import { roleLabel } from "../utils/format.js";
import { UserAvatar } from "./UserAvatar.jsx";

export function AccountDropdown() {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);
  const { user, logout } = useAuth();
  const { count: wishlistCount } = useWishlist();
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return undefined;

    function handlePointerDown(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  function handleLogout() {
    logout();
    setOpen(false);
    navigate("/", { replace: true });
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button className="btn-secondary h-10 px-3" onClick={() => setOpen((value) => !value)} type="button">
        <UserAvatar user={user} size="sm" />
        <span className="hidden max-w-32 truncate sm:inline">{user ? user.name : "Profile"}</span>
        <ChevronDown size={16} />
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-2 w-60 rounded-lg border border-neutral-200 bg-white p-2 shadow-soft dark:border-neutral-800 dark:bg-neutral-900">
          {!user ? (
            <>
              <Link className="block rounded-md px-3 py-2 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800" to="/login" onClick={() => setOpen(false)}>
                Login
              </Link>
              <Link className="block rounded-md px-3 py-2 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800" to="/register" onClick={() => setOpen(false)}>
                Register
              </Link>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3 border-b border-neutral-200 px-3 py-3 dark:border-neutral-800">
                <UserAvatar user={user} size="md" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{user.name}</p>
                  <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{roleLabel(user.role)}</p>
                </div>
              </div>
              <Link className="block rounded-md px-3 py-2 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800" to="/profile" onClick={() => setOpen(false)}>
                Profile
              </Link>
              <Link className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800" to="/wishlist" onClick={() => setOpen(false)}>
                <Heart size={16} /> Wishlist
                {wishlistCount > 0 && <span className="ml-auto rounded-full bg-clay px-2 py-0.5 text-xs font-bold text-white">{wishlistCount}</span>}
              </Link>
              <Link className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800" to="/wardrobe" onClick={() => setOpen(false)}>
                <Shirt size={16} /> Wardrobe
              </Link>
              {user.role === "vendor" && (
                <Link className="block rounded-md px-3 py-2 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800" to="/vendor/dashboard" onClick={() => setOpen(false)}>
                  Vendor Dashboard
                </Link>
              )}
              {user.role === "admin" && (
                <Link className="block rounded-md px-3 py-2 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800" to="/admin/dashboard" onClick={() => setOpen(false)}>
                  Admin Dashboard
                </Link>
              )}
              <button className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950" onClick={handleLogout} type="button">
                <LogOut size={16} /> Logout
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
