import { redirect } from "next/navigation";
import { me, type CurrentUser } from "./api/auth";
import type { Role, User } from "./types";

export async function getSession(): Promise<User | null> {
  const u: CurrentUser | null = await me();
  if (!u) return null;
  return { id: u.id, role: u.role, displayName: u.displayName };
}

export async function requireRole(role: Role): Promise<User> {
  const u = await getSession();
  if (!u) redirect("/login");
  if (u.role !== role) redirect(u.role === "admin" ? "/admin" : "/forwarder");
  return u;
}
