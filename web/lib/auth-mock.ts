/**
 * Auth helpers for server components / server actions.
 *
 * Cookie is set by FastAPI during /auth/login. Here we just read it back via /auth/me
 * to confirm validity and learn which role the current request belongs to.
 */
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

// Legacy stubs kept so existing imports compile; auth state lives in FastAPI cookie.
export async function setSession(_role: Role): Promise<void> {
  // intentionally empty — login route now POSTs to /auth/login
}

export async function clearSession(): Promise<void> {
  // intentionally empty — logout route now POSTs to /auth/logout
}
