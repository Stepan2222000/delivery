import { apiGet } from "./client";
import type { UntrackedOrder } from "../types";

interface ApiUntracked {
  source_order_number: string;
  item_title: string | null;
  ordered_at: string | null;
  delivery_status: string | null;
}

export async function listUntracked(): Promise<UntrackedOrder[]> {
  const data = await apiGet<ApiUntracked[]>(`/untracked`);
  return data.map((u) => ({
    sourceOrderNumber: u.source_order_number,
    itemTitle: u.item_title ?? "",
    orderedAt: u.ordered_at ?? "",
    status: u.delivery_status ?? "",
  }));
}
