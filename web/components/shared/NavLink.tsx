"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function NavLink({
  href,
  children,
  exact = false,
  className,
}: {
  href: string;
  children: ReactNode;
  exact?: boolean;
  className?: string;
}) {
  const path = usePathname();
  const active = exact ? path === href : path === href || path.startsWith(href + "/");
  const cls = [active ? "active" : null, className ?? null].filter(Boolean).join(" ") || undefined;
  return (
    <Link href={href} className={cls} aria-current={active ? "page" : undefined}>
      {children}
    </Link>
  );
}
