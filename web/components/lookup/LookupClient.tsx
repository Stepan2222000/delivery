"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  LookupDetail, LookupMessage, LookupRequest, LookupStructured, Role,
} from "@/lib/types";

// ── Helpers ──────────────────────────────────────────────────────────────────

async function jsonFetch<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, { credentials: "include", ...(init ?? {}) });
  if (!res.ok) {
    let detail = res.statusText;
    try { detail = (await res.json()).detail ?? detail; } catch {}
    throw new Error(`[${res.status}] ${detail}`);
  }
  if (res.status === 204) return undefined as T;
  const ct = res.headers.get("content-type") ?? "";
  return (ct.includes("application/json") ? res.json() : res.text()) as Promise<T>;
}

// ── New request form ─────────────────────────────────────────────────────────

export function NewLookupForm({ onCreated }: { onCreated?: () => void }) {
  const router = useRouter();
  const [tn, setTn] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  return (
    <form
      style={{ display: "grid", gap: 12, padding: 16, border: "1px solid var(--product-stroke)", borderRadius: 8 }}
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true); setErr(null);
        try {
          const r = await jsonFetch<{ id: string }>("/api/lookup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tracking_number: tn.trim() || null, note: note.trim() || null }),
          });
          setTn(""); setNote("");
          onCreated?.();
          router.refresh();
          router.push(`./unknown/${r.id}`);
        } catch (e) { setErr(String(e instanceof Error ? e.message : e)); }
        finally { setBusy(false); }
      }}
    >
      <div style={{ display: "grid", gap: 6 }}>
        <label className="caption" style={{ color: "var(--on-dark-faint)" }}>Трек-номер (если есть)</label>
        <input
          value={tn}
          onChange={(e) => setTn(e.target.value)}
          placeholder="EX1234567890US"
          className="input mono"
        />
      </div>
      <div style={{ display: "grid", gap: 6 }}>
        <label className="caption" style={{ color: "var(--on-dark-faint)" }}>Комментарий</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Откуда взяли, на что похоже, и т.п. Это запчасть, или не понятно — пишите свободно."
          className="input"
          rows={3}
          style={{ resize: "vertical", fontFamily: "inherit" }}
        />
      </div>
      {err ? <div style={{ color: "var(--accent-coral)", fontSize: 13 }}>{err}</div> : null}
      <button type="submit" className="btn btn-primary" disabled={busy}>
        {busy ? "Создание…" : "Создать заявку"}
      </button>
    </form>
  );
}

// ── Photo upload ─────────────────────────────────────────────────────────────

export function LookupPhotoUpload({ id }: { id: string }) {
  const router = useRouter();
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <input ref={ref} type="file" accept="image/*" style={{ display: "none" }} onChange={async (e) => {
        const file = e.target.files?.[0]; if (!file) return;
        setBusy(true); setErr(null);
        try {
          const fd = new FormData();
          fd.append("file", file);
          fd.append("source", "initial");
          await jsonFetch(`/api/lookup/${id}/photos`, { method: "POST", body: fd });
          router.refresh();
        } catch (e) { setErr(String(e instanceof Error ? e.message : e)); }
        finally { setBusy(false); if (ref.current) ref.current.value = ""; }
      }} />
      <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => ref.current?.click()}>
        {busy ? "Загрузка…" : "Добавить фото"}
      </button>
      {err ? <span style={{ color: "var(--accent-coral)", fontSize: 13 }}>{err}</span> : null}
    </div>
  );
}

// ── AI chat ──────────────────────────────────────────────────────────────────

interface ChatProps {
  id: string;
  role: Role;
  initialMessages: LookupMessage[];
  requestStatus: LookupRequest["status"];
}

function LatestSuggestion({ s }: { s: LookupStructured }) {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      {s.direct_match ? (
        <div className="card" style={{ padding: 16, borderLeft: "4px solid var(--accent-coral)" }}>
          <div className="caption-up" style={{ color: "var(--accent-coral)" }}>Точное совпадение</div>
          <div className="body" style={{ marginTop: 4 }}>Заказ #{s.direct_match.order_id}</div>
          <div className="body-sm" style={{ marginTop: 6, color: "var(--on-dark-soft)" }}>{s.direct_match.evidence}</div>
        </div>
      ) : null}
      {s.candidates && s.candidates.length > 0 ? (
        <div style={{ display: "grid", gap: 8 }}>
          <div className="caption-up" style={{ color: "var(--on-dark-faint)" }}>Кандидаты</div>
          {s.candidates.map((c) => (
            <div key={c.order_id} className="card" style={{ padding: 12 }}>
              <div className="body-sm">Заказ #{c.order_id} <span style={{ color: "var(--on-dark-faint)" }}>· {c.confidence}</span></div>
              <div className="body-sm" style={{ marginTop: 4, color: "var(--on-dark-soft)" }}>{c.reason}</div>
            </div>
          ))}
        </div>
      ) : null}
      {s.questions && s.questions.length > 0 ? (
        <div className="card" style={{ padding: 12, background: "rgba(255,255,255,0.03)" }}>
          <div className="caption-up" style={{ color: "var(--on-dark-faint)" }}>Уточнения от AI</div>
          <ul style={{ marginTop: 6, paddingLeft: 20 }}>
            {s.questions.map((q, i) => <li key={i} className="body-sm">{q}</li>)}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export function LookupChat({ id, role, initialMessages, requestStatus }: ChatProps) {
  const router = useRouter();
  const [messages, setMessages] = useState(initialMessages);
  const [text, setText] = useState("");
  const [running, setRunning] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const latestStructured = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.role === "assistant" && m.structured) return m.structured;
    }
    return null;
  })();

  async function sendUserMessage() {
    if (!text.trim()) return;
    setRunning(true); setErr(null);
    try {
      await jsonFetch(`/api/lookup/${id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      setText("");
      router.refresh();
    } catch (e) { setErr(String(e instanceof Error ? e.message : e)); }
    finally { setRunning(false); }
  }

  async function runAI() {
    setRunning(true); setErr(null);
    try {
      const res = await fetch(`/api/lookup/${id}/ai/run`, {
        method: "POST", credentials: "include",
      });
      if (!res.ok || !res.body) {
        let detail = res.statusText;
        try { detail = (await res.json()).detail ?? detail; } catch {}
        throw new Error(`[${res.status}] ${detail}`);
      }
      // We don't strictly need to parse the stream — the server has persisted
      // the assistant message already. Drain it for completeness, then refresh.
      const reader = res.body.getReader();
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done } = await reader.read();
        if (done) break;
      }
      router.refresh();
    } catch (e) { setErr(String(e instanceof Error ? e.message : e)); }
    finally { setRunning(false); }
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {latestStructured ? <LatestSuggestion s={latestStructured} /> : null}

      <div style={{ display: "grid", gap: 8 }}>
        {messages.length === 0 ? (
          <div className="body-sm" style={{ color: "var(--on-dark-faint)" }}>
            Диалога пока нет. Нажмите «Запросить AI», когда добавите фото/описание.
          </div>
        ) : null}
        {messages.map((m) => (
          <div key={m.id} className="card" style={{
            padding: 12,
            background: m.role === "assistant" ? "rgba(255,255,255,0.02)" : "transparent",
          }}>
            <div className="caption-up" style={{ color: "var(--on-dark-faint)" }}>
              {m.role === "assistant" ? "AI" : m.authorLogin ?? "вы"}
            </div>
            <div className="body-sm" style={{ marginTop: 4, whiteSpace: "pre-wrap" }}>
              {m.contentText}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Сообщение в чат (например, ответ на вопрос AI)"
          className="input"
          rows={2}
          style={{ resize: "vertical", fontFamily: "inherit" }}
        />
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="btn btn-ghost" disabled={running || !text.trim()} onClick={sendUserMessage}>
            Отправить сообщение
          </button>
          <button type="button" className="btn btn-primary" disabled={running} onClick={runAI}>
            {running ? "AI думает…" : "Запросить AI"}
          </button>
        </div>
        {err ? <div style={{ color: "var(--accent-coral)", fontSize: 13 }}>{err}</div> : null}
      </div>

      {role === "forwarder" && latestStructured && (requestStatus === "searching" || requestStatus === "rejected") ? (
        <SubmitPanel id={id} suggestion={latestStructured} />
      ) : null}
      {role === "admin" ? (
        <AdminPanel id={id} suggestion={latestStructured} requestStatus={requestStatus} />
      ) : null}
    </div>
  );
}

// ── Submit panel (forwarder) ─────────────────────────────────────────────────

function SubmitPanel({ id, suggestion }: { id: string; suggestion: LookupStructured | null }) {
  const router = useRouter();
  const [chosen, setChosen] = useState<number | "">(
    suggestion?.direct_match?.order_id ?? ""
  );
  const [evidence, setEvidence] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const options: number[] = [
    ...(suggestion?.direct_match ? [suggestion.direct_match.order_id] : []),
    ...(suggestion?.candidates?.map((c) => c.order_id) ?? []),
  ];
  if (options.length === 0) return null;

  return (
    <div className="card" style={{ padding: 16 }}>
      <div className="caption-up" style={{ color: "var(--on-dark-faint)" }}>Отправить админу на привязку</div>
      <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}>
        <select
          value={chosen} onChange={(e) => setChosen(e.target.value === "" ? "" : Number(e.target.value))}
          className="input"
        >
          <option value="">— выберите заказ —</option>
          {options.map((o) => <option key={o} value={o}>Заказ #{o}</option>)}
        </select>
        <input
          value={evidence} onChange={(e) => setEvidence(e.target.value)}
          placeholder="кратко: почему этот"
          className="input"
          style={{ flex: 1 }}
        />
        <button
          type="button" className="btn btn-primary" disabled={busy || chosen === ""}
          onClick={async () => {
            setBusy(true); setErr(null);
            try {
              await jsonFetch(`/api/lookup/${id}/submit`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ proposed_order_id: chosen, evidence: evidence || null }),
              });
              router.refresh();
            } catch (e) { setErr(String(e instanceof Error ? e.message : e)); }
            finally { setBusy(false); }
          }}
        >
          {busy ? "Отправка…" : "Отправить"}
        </button>
      </div>
      {err ? <div style={{ color: "var(--accent-coral)", marginTop: 6, fontSize: 13 }}>{err}</div> : null}
    </div>
  );
}

// ── Admin panel ──────────────────────────────────────────────────────────────

function AdminPanel({
  id, suggestion, requestStatus,
}: { id: string; suggestion: LookupStructured | null; requestStatus: LookupRequest["status"] }) {
  const router = useRouter();
  const [orderId, setOrderId] = useState<string>(
    suggestion?.direct_match?.order_id ? String(suggestion.direct_match.order_id) : "",
  );
  const [tn, setTn] = useState("");
  const [evidence, setEvidence] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);

  if (requestStatus === "linked") {
    return (
      <div className="card" style={{ padding: 16 }}>
        <div className="body-sm">Заявка привязана. Откат вручную невозможен — обратитесь к разработчику.</div>
      </div>
    );
  }

  const options: number[] = [
    ...(suggestion?.direct_match ? [suggestion.direct_match.order_id] : []),
    ...(suggestion?.candidates?.map((c) => c.order_id) ?? []),
  ];
  const orderIdNum = Number(orderId);
  const canApprove = Number.isInteger(orderIdNum) && orderIdNum > 0 && tn.trim().length > 0;

  return (
    <div className="card" style={{ padding: 16, display: "grid", gap: 10 }}>
      <div className="caption-up" style={{ color: "var(--on-dark-faint)" }}>Действия админа</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div style={{ display: "grid", gap: 6 }}>
          {options.length > 0 ? (
            <select
              value={options.includes(orderIdNum) ? orderId : ""}
              onChange={(e) => setOrderId(e.target.value)}
              className="input"
            >
              <option value="">— из вариантов —</option>
              {options.map((o) => <option key={o} value={o}>Заказ #{o}</option>)}
            </select>
          ) : null}
          <input
            value={orderId} onChange={(e) => setOrderId(e.target.value.replace(/[^0-9]/g, ""))}
            placeholder="order_id"
            className="input mono"
          />
        </div>
        <input
          value={tn} onChange={(e) => setTn(e.target.value)}
          placeholder="трек-номер для привязки"
          className="input mono"
        />
      </div>
      <input
        value={evidence} onChange={(e) => setEvidence(e.target.value)}
        placeholder="обоснование (необязательно)"
        className="input"
      />
      {!confirm ? (
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button" className="btn btn-primary" disabled={busy || !canApprove}
            onClick={() => setConfirm(true)}
          >
            Подтвердить привязку…
          </button>
          <button
            type="button" className="btn btn-ghost" disabled={busy}
            onClick={async () => {
              setBusy(true); setErr(null);
              try {
                await jsonFetch(`/api/lookup/${id}/reject`, {
                  method: "POST", headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ note: evidence || null }),
                });
                router.refresh();
              } catch (e) { setErr(String(e instanceof Error ? e.message : e)); }
              finally { setBusy(false); }
            }}
          >
            Отклонить
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span className="body-sm" style={{ color: "var(--accent-coral)" }}>
            Откат после подтверждения невозможен.
          </span>
          <button
            type="button" className="btn btn-primary" disabled={busy}
            onClick={async () => {
              setBusy(true); setErr(null);
              try {
                await jsonFetch(`/api/lookup/${id}/approve`, {
                  method: "POST", headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    order_id: orderIdNum, tracking_number: tn.trim(), evidence: evidence || null,
                  }),
                });
                router.refresh();
              } catch (e) { setErr(String(e instanceof Error ? e.message : e)); }
              finally { setBusy(false); setConfirm(false); }
            }}
          >
            {busy ? "Запись…" : "Да, привязать"}
          </button>
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => setConfirm(false)}>
            Отмена
          </button>
        </div>
      )}
      {err ? <div style={{ color: "var(--accent-coral)", fontSize: 13 }}>{err}</div> : null}
    </div>
  );
}
