import { apiGet, apiSend } from "./client";
import type {
  LookupBadge, LookupDetail, LookupRequest, LookupStatus,
} from "../types";

interface ApiRequest {
  id: string;
  tracking_number: string | null;
  note: string | null;
  status: LookupStatus;
  linked_order_id: number | null;
  proposed_order_id: number | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  submitted_by: string | null;
  submitted_at: string | null;
  decided_by: string | null;
  decided_at: string | null;
  photo_count: number;
  message_count: number;
}

function fromApi(r: ApiRequest): LookupRequest {
  return {
    id: r.id,
    trackingNumber: r.tracking_number,
    note: r.note,
    status: r.status,
    linkedOrderId: r.linked_order_id,
    proposedOrderId: r.proposed_order_id,
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    submittedBy: r.submitted_by,
    submittedAt: r.submitted_at,
    decidedBy: r.decided_by,
    decidedAt: r.decided_at,
    photoCount: r.photo_count ?? 0,
    messageCount: r.message_count ?? 0,
  };
}

export async function listLookups(statusFilter?: LookupStatus): Promise<LookupRequest[]> {
  const q = statusFilter ? `?status_filter=${encodeURIComponent(statusFilter)}` : "";
  const raw = await apiGet<ApiRequest[]>(`/lookup${q}`);
  return raw.map(fromApi);
}

export async function getLookup(id: string): Promise<LookupDetail> {
  const raw = await apiGet<{
    request: ApiRequest;
    photos: Array<{
      id: number; object_key: string; public_url: string; mime_type: string;
      source: "initial" | "chat"; uploaded_by: string; uploaded_at: string;
    }>;
    messages: Array<{
      id: number; role: "user" | "assistant" | "system";
      author_login: string | null;
      content_text: string | null;
      attachments: Array<{ object_key: string; mime_type: string }> | null;
      structured: LookupDetail["messages"][number]["structured"];
      created_at: string;
    }>;
    linked_order: { order_id: number; order_number: string; sold_by: string; items: string | null } | null;
  }>(`/lookup/${id}`);
  return {
    request: fromApi(raw.request),
    photos: raw.photos.map((p) => ({
      id: p.id,
      objectKey: p.object_key,
      publicUrl: p.public_url,
      mimeType: p.mime_type,
      source: p.source,
      uploadedBy: p.uploaded_by,
      uploadedAt: p.uploaded_at,
    })),
    messages: raw.messages.map((m) => ({
      id: m.id,
      role: m.role,
      authorLogin: m.author_login,
      contentText: m.content_text,
      attachments: m.attachments,
      structured: m.structured,
      createdAt: m.created_at,
    })),
    linkedOrder: raw.linked_order,
  };
}

export async function createLookup(payload: {
  tracking_number?: string | null;
  note?: string | null;
}): Promise<LookupRequest> {
  // The POST returns a subset of fields — pad with nullable defaults.
  const raw = await apiSend<Partial<ApiRequest> & { id: string; status: LookupStatus; created_at: string; created_by: string; tracking_number: string | null; note: string | null }>(
    "/lookup", "POST", payload,
  );
  return fromApi({
    id: raw.id,
    tracking_number: raw.tracking_number,
    note: raw.note,
    status: raw.status,
    linked_order_id: raw.linked_order_id ?? null,
    proposed_order_id: raw.proposed_order_id ?? null,
    created_by: raw.created_by,
    created_at: raw.created_at,
    updated_at: raw.updated_at ?? raw.created_at,
    submitted_by: raw.submitted_by ?? null,
    submitted_at: raw.submitted_at ?? null,
    decided_by: raw.decided_by ?? null,
    decided_at: raw.decided_at ?? null,
    photo_count: raw.photo_count ?? 0,
    message_count: raw.message_count ?? 0,
  });
}

export async function getBadge(): Promise<LookupBadge> {
  const raw = await apiGet<{ pending_admin: number; searching: number }>(`/lookup/badge`);
  return { pendingAdmin: raw.pending_admin, searching: raw.searching };
}

export async function submitLookup(
  id: string, body: { proposed_order_id: number; evidence?: string },
): Promise<void> {
  await apiSend(`/lookup/${id}/submit`, "POST", body);
}

export async function approveLookup(
  id: string, body: { order_id: number; tracking_number: string; evidence?: string },
): Promise<void> {
  await apiSend(`/lookup/${id}/approve`, "POST", body);
}

export async function rejectLookup(id: string, note?: string): Promise<void> {
  await apiSend(`/lookup/${id}/reject`, "POST", { note });
}

export async function deleteLookup(id: string): Promise<void> {
  await apiSend(`/lookup/${id}`, "DELETE");
}

export async function postMessage(id: string, text: string): Promise<void> {
  await apiSend(`/lookup/${id}/messages`, "POST", { text });
}
