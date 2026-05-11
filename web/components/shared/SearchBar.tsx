"use client";

import { useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { IconSearch, IconX } from "./Icons";

export function SearchBar({
  placeholder = "Поиск по треку",
  defaultOpen = false,
}: { placeholder?: string; defaultOpen?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const initial = sp.get("q") ?? "";
  const [open, setOpen] = useState(defaultOpen || initial.length > 0);
  const [shouldFocus, setShouldFocus] = useState(false);
  const [q, setQ] = useState(initial);

  const apply = (next: string) => {
    const params = new URLSearchParams(sp.toString());
    if (next) params.set("q", next);
    else params.delete("q");
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    apply(q.trim());
  };

  if (!open) {
    return (
      <button type="button" className="btn btn-ghost btn-sm" aria-label="Поиск" onClick={() => { setOpen(true); setShouldFocus(true); }}>
        <IconSearch width={18} height={18} />
      </button>
    );
  }
  return (
    <form onSubmit={onSubmit} role="search" className="search-bar">
      <IconSearch width={16} height={16} className="search-icon" aria-hidden />
      <input
        type="search"
        className="search-input"
        placeholder={placeholder}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        autoFocus={shouldFocus}
      />
      <button type="button" className="search-clear" aria-label="Закрыть" onClick={() => { setQ(""); apply(""); setOpen(false); }}>
        <IconX width={14} height={14} />
      </button>
    </form>
  );
}
