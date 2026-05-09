import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { me } from "@/lib/api/auth";
import { LoginForm } from "./LoginForm";

const API_BASE = process.env.DELIVERY_API_URL ?? "http://127.0.0.1:8002";
const COOKIE_NAME = process.env.DELIVERY_COOKIE_NAME ?? "delivery_session";

async function loginAction(formData: FormData) {
  "use server";
  const login = String(formData.get("login") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!login || !password) return { error: "Введите логин и пароль" };
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ login, password }),
    cache: "no-store",
  });
  if (!res.ok) return { error: "Неверный логин или пароль" };
  const setCookie = res.headers.get("set-cookie");
  if (setCookie) {
    const m = setCookie.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
    if (m) {
      const c = await cookies();
      c.set(COOKIE_NAME, m[1], {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      });
    }
  }
  const data = (await res.json()) as { role: "admin" | "forwarder" };
  redirect(data.role === "admin" ? "/admin" : "/forwarder");
}

export default async function LoginPage() {
  // Already signed in? Bounce to dashboard.
  const u = await me();
  if (u) redirect(u.role === "admin" ? "/admin" : "/forwarder");

  return (
    <main className="surface-cream" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <header style={{ padding: "24px 32px", display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div style={{ fontFamily: "var(--font-serif)", fontSize: 22, color: "var(--ink)", letterSpacing: "-0.5px" }}>
          Delivery<span style={{ color: "var(--brand-coral)" }}>.</span>
        </div>
        <div className="caption">US → KG → RU</div>
      </header>

      <section style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "32px 24px" }}>
        <div style={{ maxWidth: 540, width: "100%" }}>
          <p className="caption-up" style={{ marginBottom: 16 }}>Учёт переправки</p>
          <h1 className="display-lg" style={{ margin: "0 0 18px" }}>
            Каждый трек —<br />на своём месте.
          </h1>
          <p className="body-md" style={{ maxWidth: 460, color: "var(--body)", marginBottom: 36 }}>
            Заказы с eBay, перелёт через Киргизию, доставка в Россию.
          </p>

          <LoginForm action={loginAction} />
        </div>
      </section>
    </main>
  );
}
