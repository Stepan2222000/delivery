import { apiGet, apiSend, ApiError } from "./client";
import type { Role } from "../types";

export interface CurrentUser {
  id: string;
  role: Role;
  displayName: string;
}

interface ApiMe {
  id: string;
  role: Role;
  display_name: string;
}

export async function login(loginName: string, password: string): Promise<CurrentUser> {
  const data = await apiSend<ApiMe>(`/auth/login`, "POST", { login: loginName, password });
  return { id: data.id, role: data.role, displayName: data.display_name };
}

export async function logout(): Promise<void> {
  await apiSend<void>(`/auth/logout`, "POST");
}

export async function me(): Promise<CurrentUser | null> {
  try {
    const data = await apiGet<ApiMe>(`/auth/me`);
    return { id: data.id, role: data.role, displayName: data.display_name };
  } catch (e) {
    if (e instanceof ApiError && (e.status === 401 || e.status === 403)) return null;
    throw e;
  }
}
