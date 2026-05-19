import Link from "next/link";
import { getBadge } from "@/lib/api/lookup";

export async function LookupNavLink({ href }: { href: string }) {
  let badge: { pendingAdmin: number; searching: number } | null = null;
  try {
    badge = await getBadge();
  } catch {
    badge = null;
  }
  const total = (badge?.pendingAdmin ?? 0);
  return (
    <Link href={href} className="nav-link" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span>Незнакомые</span>
      {total > 0 ? (
        <span style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          minWidth: 20, height: 20, padding: "0 6px",
          background: "var(--accent-coral)", color: "white",
          borderRadius: 10, fontSize: 12, fontWeight: 600,
        }}>{total}</span>
      ) : null}
    </Link>
  );
}
