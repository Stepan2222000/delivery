"use client";

import { useState, useTransition } from "react";
import { IconArrowRight } from "@/components/shared/Icons";

type LoginAction = (formData: FormData) => Promise<{ error: string } | undefined>;

export function LoginForm({ action }: { action: LoginAction }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await action(fd);
      if (res && "error" in res) setError(res.error);
    });
  }

  return (
    <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 380 }}>
      <input
        name="login"
        type="text"
        placeholder="логин"
        required
        autoFocus
        autoComplete="username"
        className="input"
        style={{ padding: "14px 16px", fontSize: 16 }}
      />
      <input
        name="password"
        type="password"
        placeholder="пароль"
        required
        autoComplete="current-password"
        className="input"
        style={{ padding: "14px 16px", fontSize: 16 }}
      />
      <button
        type="submit"
        disabled={pending}
        className="btn btn-primary btn-lg btn-block"
        style={{ marginTop: 8 }}
      >
        {pending ? "Вход…" : <>Войти <IconArrowRight width={18} height={18} /></>}
      </button>
      {error ? (
        <p className="body-sm" style={{ color: "var(--error-text, #c0392b)", margin: 0 }}>
          {error}
        </p>
      ) : null}
      <p className="body-xs" style={{ marginTop: 16, color: "var(--muted)" }}>
        У менеджера и форвардера разные пары логин/пароль. Если не помните — спросите у Степана.
      </p>
    </form>
  );
}
