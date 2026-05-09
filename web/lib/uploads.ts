import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const ALLOWED_EXT = new Set(["jpg", "jpeg", "png", "webp", "heic", "heif", "pdf"]);

export async function saveWaybillPhoto(file: File, shipmentId: string): Promise<string | null> {
  if (!file || file.size === 0) return null;

  const rawName = file.name || "waybill";
  const ext = (rawName.split(".").pop() || "jpg").toLowerCase();
  if (!ALLOWED_EXT.has(ext)) {
    throw new Error(`saveWaybillPhoto: unsupported file extension "${ext}" for ${rawName}`);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const dir = path.join(process.cwd(), "public", "uploads", "waybills");
  await mkdir(dir, { recursive: true });
  const fileName = `${shipmentId}-${Date.now()}.${ext}`;
  await writeFile(path.join(dir, fileName), buffer);
  return `/uploads/waybills/${fileName}`;
}
