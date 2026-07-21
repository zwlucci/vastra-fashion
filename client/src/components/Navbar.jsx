import { Menu, MessageSquare, ShoppingBag, X } from "lucide-react";
import React, { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { useCart } from "../context/CartContext.jsx";
import { useMessages } from "../context/MessageContext.jsx";
import { AccountDropdown } from "./AccountDropdown.jsx";
import { OrderNotificationMenu } from "./OrderNotificationMenu.jsx";
import { ThemeToggle } from "./ThemeToggle.jsx";

const navItems = [
  { to: "/", label: "Home" },
  { to: "/shop", label: "Shop" },
  { to: "/contact", label: "Contact" },
  { to: "/pricing", label: "Pricing" }
];

export function Navbar() {
  const [open, setOpen] = useState(false);
  const { count } = useCart();
  const { unreadCount } = useMessages();

  const navClass = ({ isActive }) =>
    `rounded-md px-3 py-2 text-sm font-semibold ${isActive ? "text-clay" : "text-neutral-700 hover:text-clay dark:text-neutral-200"}`;

  return (
    <header className="sticky top-0 z-20 border-b border-neutral-200 bg-pearl/95 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/95">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <Link className="text-xl font-black tracking-[0.18em]" to="/">VASTRA</Link>
        <nav className="hidden items-center gap-1 md:flex">
          {navItems.map((item) => <NavLink key={item.to} className={navClass} to={item.to}>{item.label}</NavLink>)}
        </nav>
        <div className="flex items-center gap-2">
          <Link className="btn-secondary relative h-10 w-10 px-0" to="/messages" title="Messages">
            <MessageSquare size={18} />
            {unreadCount > 0 && <span className="absolute -right-1 -top-1 rounded-full bg-clay px-1.5 text-xs font-bold text-white">{unreadCount}</span>}
          </Link>
          <OrderNotificationMenu />
          <Link className="btn-secondary relative h-10 w-10 px-0" to="/cart" title="Cart">
            <ShoppingBag size={18} />
            {count > 0 && <span className="absolute -right-1 -top-1 rounded-full bg-clay px-1.5 text-xs font-bold text-white">{count}</span>}
          </Link>
          <ThemeToggle />
          <div className="hidden sm:block"><AccountDropdown /></div>
          <button className="btn-secondary h-10 w-10 px-0 md:hidden" onClick={() => setOpen((value) => !value)} type="button">
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>
      {open && (
        <div className="border-t border-neutral-200 px-4 pb-4 dark:border-neutral-800 md:hidden">
          <div className="flex flex-col gap-1 pt-2">
            {navItems.map((item) => <NavLink key={item.to} className={navClass} to={item.to} onClick={() => setOpen(false)}>{item.label}</NavLink>)}
            <div className="pt-2 sm:hidden"><AccountDropdown /></div>
          </div>
        </div>
      )}
    </header>
  );
}
