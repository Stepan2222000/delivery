import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { logout as apiLogout } from "@/lib/api/auth";
import { cookies } from "next/headers";
import { NavLink } from "@/components/shared/NavLink";
import { SearchBar } from "@/components/shared/SearchBar";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { IconLogout } from "@/components/shared/Icons";

async function logout() {
  "use server";
  try { await apiLogout(); } catch {}
  const c = await cookies();
  c.delete(process.env.DELIVERY_COOKIE_NAME ?? "delivery_session");
  redirect("/login");
}

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const u = await requireRole("admin");
  return (
    <div className="dark-scope app-shell">
      <header className="top-nav">
        <Link href="/admin" className="brand">
          Delivery<span className="dot">.</span>
        </Link>
        <nav className="nav-links" aria-label="Главное меню">
          <NavLink href="/admin" exact>Главная</NavLink>
          <NavLink href="/admin/untracked">Без трека</NavLink>
          <NavLink href="/admin/settings">Настройки</NavLink>
        </nav>
        <SearchBar placeholder="Поиск по треку или товару" />
        <div className="who">
          <span className="who-name">{u.displayName}</span>
          <ThemeToggle />
          <form action={logout}>
            <button className="btn btn-ghost btn-sm" type="submit" aria-label="Выйти">
              <IconLogout width={18} height={18} />
            </button>
          </form>
        </div>
      </header>
      <main className="app-content">{children}</main>
    </div>
  );
}
