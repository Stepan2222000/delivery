"use client";

import { useRef, useState, useTransition } from "react";
import { IconCamera } from "@/components/shared/Icons";

export function PhotoUploadButton({
  trackingNumber,
  uploadAction,
}: {
  trackingNumber: string;
  uploadAction: (formData: FormData) => Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setError(null);
    const fd = new FormData();
    fd.append("tn", trackingNumber);
    fd.append("file", f);
    startTransition(async () => {
      try {
        await uploadAction(fd);
      } catch (err) {
        setError(err instanceof Error ? err.message : "ошибка загрузки");
      }
    });
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={onFile}
        style={{ display: "none" }}
      />
      <button
        type="button"
        className="btn btn-secondary btn-block"
        disabled={pending}
        onClick={() => inputRef.current?.click()}
      >
        <IconCamera width={18} height={18} /> {pending ? "Загружаю…" : "Добавить фото"}
      </button>
      {error && <p className="body-xs" style={{ color: "var(--error-text)", marginTop: 8 }}>{error}</p>}
    </>
  );
}
