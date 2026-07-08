import React from "react";
import { ArrowUpDown, Search, UserPlus } from "lucide-react";
import { roleLabel } from "../utils/format.js";

const sortOptions = [
  ["newest", "Newest first"],
  ["oldest", "Oldest first"],
  ["name_asc", "Name A-Z"],
  ["name_desc", "Name Z-A"],
  ["role", "Role"]
];

export function AdminUsersTable({ title = "Users and vendors", users, onPromote, meta, page, setPage, search, setSearch, sort, setSort }) {

  return (
    <div className="panel min-w-0 space-y-4 overflow-hidden">
      <div className="space-y-3">
        <div>
          <h2 className="text-2xl font-black">{title}</h2>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">Search, sort, and promote approved marketplace sellers.</p>
        </div>
        <div className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,180px)]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={16} />
            <input
              className="w-full pl-9"
              placeholder="Search users"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <label className="relative block">
            <ArrowUpDown className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={16} />
            <select className="w-full pl-9" value={sort} onChange={(event) => setSort(event.target.value)}>
              {sortOptions.map(([value, label]) => (
                <option value={value} key={value}>{label}</option>
              ))}
            </select>
          </label>
        </div>
      </div>
      <div className="max-h-[470px] space-y-2 overflow-y-auto pr-1">
        {users.map((user) => (
          <article className="min-w-0 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800" key={user.id}>
            <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2"><h3 className="font-bold">{user.name}</h3><span className="badge bg-neutral-100 dark:bg-neutral-800">{roleLabel(user.role)}</span></div>
                <p className="mt-1 break-all text-sm text-neutral-500">{user.email}</p>
                <p className="mt-2 text-xs text-neutral-500">Joined {new Date(user.createdAt || user.created_at).toLocaleDateString()}</p>
              </div>
              {user.role === "user" ? <button className="btn-secondary h-9 shrink-0 px-3" onClick={() => onPromote(user.id)} type="button"><UserPlus size={16} /> Promote</button> : <span className="text-xs text-neutral-500">Approved seller</span>}
            </div>
          </article>
        ))}
        {!users.length && <p className="py-8 text-center text-sm text-neutral-500">No matching users or vendors.</p>}
      </div>
      {meta && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-neutral-500">Page {meta.page} of {meta.totalPages} · {meta.total} total</p>
          <div className="flex gap-2">
            <button className="btn-secondary" disabled={page <= 1} onClick={() => setPage(page - 1)} type="button">Previous</button>
            <button className="btn-secondary" disabled={page >= meta.totalPages} onClick={() => setPage(page + 1)} type="button">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
