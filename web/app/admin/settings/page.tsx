import { revalidatePath } from "next/cache";
import { getSettings, patchSettings } from "@/lib/api/settings";
import { formatDate } from "@/lib/derive";

async function saveTariff(formData: FormData) {
  "use server";
  const v = Number(String(formData.get("tariff")));
  if (Number.isNaN(v) || v <= 0) throw new Error(`saveTariff: invalid value`);
  await patchSettings({ tariffUsdPerKg: v });
  revalidatePath("/admin/settings");
  revalidatePath("/admin");
}

async function saveThresholds(formData: FormData) {
  "use server";
  const usaDays = Number(formData.get("usa_days"));
  const usaToKgDays = Number(formData.get("usa_to_kg_days"));
  const kgToRuDays = Number(formData.get("kg_to_ru_days"));
  if ([usaDays, usaToKgDays, kgToRuDays].some((n) => Number.isNaN(n) || n < 0)) {
    throw new Error(`saveThresholds: invalid days value`);
  }
  await patchSettings({
    thresholds: {
      usa: { days: usaDays, enabled: formData.get("usa_enabled") === "on" },
      usaToKg: { days: usaToKgDays, enabled: formData.get("usa_to_kg_enabled") === "on" },
      kgToRu: { days: kgToRuDays, enabled: formData.get("kg_to_ru_enabled") === "on" },
    },
  });
  revalidatePath("/admin/settings");
  revalidatePath("/admin");
  revalidatePath("/forwarder");
}

export default async function SettingsPage() {
  const settings = await getSettings();
  return (
    <div>
      <header style={{ marginBottom: 32 }}>
        <p className="caption-up" style={{ color: "var(--on-dark-faint)", marginBottom: 8 }}>Конфигурация</p>
        <h1 style={{ fontFamily: "var(--font-serif)", fontSize: 44, color: "var(--on-dark-strong)", letterSpacing: "-0.8px", fontWeight: 400, margin: 0 }}>
          Настройки.
        </h1>
      </header>

      <section className="card" style={{ padding: 28, marginBottom: 24, maxWidth: 720 }}>
        <h2 className="title-lg" style={{ color: "var(--on-dark-strong)", margin: "0 0 6px" }}>Тариф KG → RU</h2>
        <p className="body-sm" style={{ color: "var(--on-dark-soft)", marginTop: 0, marginBottom: 16 }}>
          Цена за килограмм. Меняется со снимком — старые отгрузки сохраняют цену, по которой были созданы.
        </p>
        <form action={saveTariff} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12, alignItems: "end" }}>
          <label className="field" style={{ marginBottom: 0 }}>
            <span className="field-label">Тариф, $/кг</span>
            <input className="input" name="tariff" type="number" step="0.01" min="0.01" defaultValue={settings.tariffUsdPerKg} required />
          </label>
          <button className="btn btn-primary" type="submit" style={{ height: 44 }}>Применить</button>
        </form>
        <p className="body-xs" style={{ color: "var(--on-dark-faint)", marginTop: 12, marginBottom: 0 }}>
          Текущий тариф действует с {formatDate(settings.tariffEffectiveFrom)}.
        </p>
      </section>

      <section className="card" style={{ padding: 28, maxWidth: 720 }}>
        <h2 className="title-lg" style={{ color: "var(--on-dark-strong)", margin: "0 0 6px" }}>Просрочки</h2>
        <p className="body-sm" style={{ color: "var(--on-dark-soft)", marginTop: 0, marginBottom: 18 }}>
          После какого времени трек считается «горящим». Каждый этап можно отключить целиком.
        </p>
        <form action={saveThresholds}>
          <ThresholdRow label="После ETA в США" days={settings.thresholds.usa.days} enabled={settings.thresholds.usa.enabled} keyName="usa" />
          <ThresholdRow label="США → КГ" days={settings.thresholds.usaToKg.days} enabled={settings.thresholds.usaToKg.enabled} keyName="usa_to_kg" />
          <ThresholdRow label="КГ → РФ" days={settings.thresholds.kgToRu.days} enabled={settings.thresholds.kgToRu.enabled} keyName="kg_to_ru" />
          <button className="btn btn-primary" type="submit" style={{ marginTop: 14 }}>Сохранить пороги</button>
        </form>
      </section>
    </div>
  );
}

function ThresholdRow({ label, days, enabled, keyName }: { label: string; days: number; enabled: boolean; keyName: string }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 120px auto", gap: 16, alignItems: "center", paddingBottom: 14, marginBottom: 14, borderBottom: "1px solid var(--product-stroke)" }}>
      <div>
        <div className="title-sm" style={{ color: "var(--on-dark-strong)" }}>{label}</div>
        <div className="caption" style={{ color: "var(--on-dark-soft)" }}>дней до сигнала</div>
      </div>
      <input className="input" name={`${keyName}_days`} type="number" min="0" step="1" defaultValue={days} />
      <label style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--on-dark)", fontSize: 14 }}>
        <input type="checkbox" name={`${keyName}_enabled`} defaultChecked={enabled} style={{ width: 18, height: 18, accentColor: "var(--brand-coral)" }} />
        учитывать
      </label>
    </div>
  );
}
