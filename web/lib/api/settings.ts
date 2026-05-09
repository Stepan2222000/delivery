import { apiGet, apiSend } from "./client";
import type { Settings } from "../types";

interface ApiSettings {
  tariff_usd_per_kg: string | number;
  tariff_effective_from: string;
  threshold_usa_days: number;
  threshold_usa_enabled: boolean;
  threshold_to_kg_days: number;
  threshold_to_kg_enabled: boolean;
  threshold_to_ru_days: number;
  threshold_to_ru_enabled: boolean;
  cutoff_date: string;
}

function fromApi(s: ApiSettings): Settings {
  return {
    tariffUsdPerKg: Number(s.tariff_usd_per_kg),
    tariffEffectiveFrom: s.tariff_effective_from,
    thresholds: {
      usa: { days: s.threshold_usa_days, enabled: s.threshold_usa_enabled },
      usaToKg: { days: s.threshold_to_kg_days, enabled: s.threshold_to_kg_enabled },
      kgToRu: { days: s.threshold_to_ru_days, enabled: s.threshold_to_ru_enabled },
    },
    cutoffDate: s.cutoff_date,
  };
}

export async function getSettings(): Promise<Settings> {
  const data = await apiGet<ApiSettings>(`/settings`);
  return fromApi(data);
}

export async function patchSettings(patch: Partial<Settings>): Promise<Settings> {
  const body: Record<string, unknown> = {};
  if (patch.tariffUsdPerKg !== undefined) body.tariff_usd_per_kg = patch.tariffUsdPerKg;
  if (patch.thresholds?.usa) {
    if (patch.thresholds.usa.days !== undefined) body.threshold_usa_days = patch.thresholds.usa.days;
    if (patch.thresholds.usa.enabled !== undefined) body.threshold_usa_enabled = patch.thresholds.usa.enabled;
  }
  if (patch.thresholds?.usaToKg) {
    if (patch.thresholds.usaToKg.days !== undefined) body.threshold_to_kg_days = patch.thresholds.usaToKg.days;
    if (patch.thresholds.usaToKg.enabled !== undefined) body.threshold_to_kg_enabled = patch.thresholds.usaToKg.enabled;
  }
  if (patch.thresholds?.kgToRu) {
    if (patch.thresholds.kgToRu.days !== undefined) body.threshold_to_ru_days = patch.thresholds.kgToRu.days;
    if (patch.thresholds.kgToRu.enabled !== undefined) body.threshold_to_ru_enabled = patch.thresholds.kgToRu.enabled;
  }
  if (patch.cutoffDate !== undefined) body.cutoff_date = patch.cutoffDate;
  const data = await apiSend<ApiSettings>(`/settings`, "PATCH", body);
  return fromApi(data);
}
