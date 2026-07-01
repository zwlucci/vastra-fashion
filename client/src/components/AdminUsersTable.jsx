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
    <div className="panel space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-2xl font-black">{title}</h2>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">Search, sort, and promote approved marketplace sellers.</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-[minmax(220px,1fr)_180px]">
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
      <div className="max-h-[430px] overflow-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="sticky top-0 z-10 bg-neutral-100 text-xs uppercase text-neutral-500 dark:bg-neutral-800">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Joined</th>
              <th className="w-36 px-4 py-3 text-center">Action</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr className="border-t border-neutral-200 dark:border-neutral-800" key={user.id}>
                <td className="px-4 py-3 font-semibold">{user.name}</td>
                <td className="px-4 py-3">{user.email}</td>
                <td className="px-4 py-3">{roleLabel(user.role)}</td>
                <td className="px-4 py-3">{new Date(user.createdAt || user.created_at).toLocaleDateString()}</td>
                <td className="w-36 px-4 py-3">
                  <div className="flex justify-center">
                  {user.role === "user" ? (
                    <button className="btn-secondary h-9 w-28 px-2" onClick={() => onPromote(user.id)} type="button">
                      <UserPlus size={16} /> Promote
                    </button>
                  ) : (
                    <span className="inline-flex h-9 w-28 items-center justify-center rounded-md border border-transparent text-sm text-neutral-500 dark:text-neutral-400">No action</span>
                  )}
                  </div>
                </td>
              </tr>
            ))}
            {!users.length && (
              <tr>
                <td className="px-4 py-8 text-center text-neutral-500" colSpan="5">No matching users or vendors.</td>
              </tr>
            )}
          </tbody>
        </table>
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
