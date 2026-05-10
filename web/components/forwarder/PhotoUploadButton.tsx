"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { IconCamera } from "@/components/shared/Icons";

const MAX_BYTES = 20 * 1024 * 1024;

export function PhotoUploadButton({ trackingNumber }: { trackingNumber: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setError(null);

    if (f.size > MAX_BYTES) {
      setError(`файл больше 20 МБ (${(f.size / 1024 / 1024).toFixed(1)} МБ)`);
      return;
    }

    const fd = new FormData();
    fd.append("file", f);

    setUploading(true);
    try {
      const res = await fetch(
        `/api/parcels/${encodeURIComponent(trackingNumber)}/photos`,
        { method: "POST", body: fd },
      );
      if (!res.ok) {
        const detail = await res.text().catch(() => res.statusText);
        throw new Error(`[${res.status}] ${detail}`);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ошибка загрузки");
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={onFile}
        style={{ display: "none" }}
      />
      <button
        type="button"
        className="btn btn-secondary btn-block"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
      >
        <IconCamera width={18} height={18} /> {uploading ? "Загружаю…" : "Добавить фото"}
      </button>
      {error && (
        <p className="body-xs" style={{ color: "var(--error-text)", marginTop: 8 }}>
          {error}
        </p>
      )}
    </>
  );
}
