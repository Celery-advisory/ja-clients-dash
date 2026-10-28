import { readFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { createAdminClient } from "@/lib/supabase/admin";
import { queryDb } from "@/lib/supabase/db";
import { supabaseUrl } from "@/lib/supabase/env";
import { COVER_SKYLINE } from "@/lib/reports/pdf/report-assets";

export const REPORT_IMAGES_BUCKET = "report-images";
export const REPORT_IMAGE_MAX_BYTES = 8 * 1024 * 1024;
/** Narrower than this and the cover photo (half an A4 landscape page) prints soft. */
export const REPORT_IMAGE_MIN_WIDTH = 800;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isReportImageId(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

type ReportImageRow = {
  id: string;
  label: string;
  builtin_file: string | null;
  storage_path: string | null;
  content_type: "image/jpeg" | "image/png";
  width: number | null;
  height: number | null;
  is_default: boolean;
  created_at: string;
};

export type ReportImage = {
  id: string;
  label: string;
  url: string;
  builtin: boolean;
  isDefault: boolean;
  width: number | null;
  height: number | null;
  createdAt: string;
};

/** What @react-pdf/renderer's <Image src> accepts: a file path or raw bytes. */
export type ReportImageSource = string | { data: Buffer; format: "jpg" | "png" };

const SELECT_COLUMNS = `id, label, builtin_file, storage_path, content_type, width, height,
  is_default, created_at::text`;

function publicUrl(row: ReportImageRow) {
  if (row.builtin_file) return `/${row.builtin_file}`;
  return `${supabaseUrl}/storage/v1/object/public/${REPORT_IMAGES_BUCKET}/${row.storage_path}`;
}

function toReportImage(row: ReportImageRow): ReportImage {
  return {
    id: row.id,
    label: row.label,
    url: publicUrl(row),
    builtin: Boolean(row.builtin_file),
    isDefault: row.is_default,
    width: row.width,
    height: row.height,
    createdAt: row.created_at,
  };
}

export async function listReportImages(): Promise<ReportImage[]> {
  const rows = await queryDb<ReportImageRow>(
    `SELECT ${SELECT_COLUMNS} FROM wealth.report_images
     ORDER BY is_default DESC, builtin_file IS NULL, created_at DESC`,
  );
  return rows.map(toReportImage);
}

async function getReportImageRow(id: string) {
  if (!isReportImageId(id)) return null;
  const rows = await queryDb<ReportImageRow>(
    `SELECT ${SELECT_COLUMNS} FROM wealth.report_images WHERE id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

/** Reads type and pixel size from the file header, so uploads are checked by content, not name. */
export function inspectImage(
  bytes: Buffer,
): { contentType: "image/jpeg" | "image/png"; width: number; height: number } | null {
  if (bytes.length > 24 && bytes.readUInt32BE(0) === 0x89504e47) {
    return { contentType: "image/png", width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  }
  if (bytes.length > 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < bytes.length) {
      if (bytes[offset] !== 0xff) return null;
      const marker = bytes[offset + 1];
      const length = bytes.readUInt16BE(offset + 2);
      // SOF0 to SOF15 carry the frame size, except DHT (C4), JPG (C8) and DAC (CC).
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return {
          contentType: "image/jpeg",
          height: bytes.readUInt16BE(offset + 5),
          width: bytes.readUInt16BE(offset + 7),
        };
      }
      offset += 2 + length;
    }
  }
  return null;
}

export async function createReportImage(input: {
  label: string;
  bytes: Buffer;
  uploadedBy: string;
}): Promise<ReportImage> {
  const info = inspectImage(input.bytes);
  if (!info) throw new Error("Upload a JPEG or PNG image");
  if (input.bytes.length > REPORT_IMAGE_MAX_BYTES) throw new Error("Images must be 8 MB or smaller");
  if (info.width < REPORT_IMAGE_MIN_WIDTH) {
    throw new Error(`Images must be at least ${REPORT_IMAGE_MIN_WIDTH}px wide to print sharply`);
  }

  const extension = info.contentType === "image/png" ? "png" : "jpg";
  const storagePath = `covers/${randomUUID()}.${extension}`;
  const admin = createAdminClient();
  const { error } = await admin.storage
    .from(REPORT_IMAGES_BUCKET)
    .upload(storagePath, input.bytes, { contentType: info.contentType, upsert: false });
  if (error) throw new Error(error.message);

  try {
    const rows = await queryDb<ReportImageRow>(
      `INSERT INTO wealth.report_images (label, storage_path, content_type, width, height, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING ${SELECT_COLUMNS}`,
      [input.label, storagePath, info.contentType, info.width, info.height, input.uploadedBy],
    );
    return toReportImage(rows[0]);
  } catch (insertError) {
    // Do not leave an orphaned file in the bucket when the row could not be written.
    await admin.storage.from(REPORT_IMAGES_BUCKET).remove([storagePath]);
    throw insertError;
  }
}

export async function setDefaultReportImage(id: string) {
  const row = await getReportImageRow(id);
  if (!row) return null;
  await queryDb(
    `UPDATE wealth.report_images SET is_default = (id = $1)
     WHERE is_default OR id = $1`,
    [id],
  );
  return toReportImage({ ...row, is_default: true });
}

export async function renameReportImage(id: string, label: string) {
  const rows = await queryDb<ReportImageRow>(
    `UPDATE wealth.report_images SET label = $2 WHERE id = $1 RETURNING ${SELECT_COLUMNS}`,
    [id, label],
  );
  return rows[0] ? toReportImage(rows[0]) : null;
}

/** Built-in images and the current default stay, so there is always a cover to fall back to. */
export async function deleteReportImage(id: string): Promise<"deleted" | "not_found" | "protected"> {
  const row = await getReportImageRow(id);
  if (!row) return "not_found";
  if (row.builtin_file || row.is_default) return "protected";

  await queryDb(`DELETE FROM wealth.report_images WHERE id = $1`, [id]);
  if (row.storage_path) {
    await createAdminClient().storage.from(REPORT_IMAGES_BUCKET).remove([row.storage_path]);
  }
  return "deleted";
}

async function loadSource(row: ReportImageRow): Promise<ReportImageSource> {
  const format = row.content_type === "image/png" ? "png" : "jpg";
  if (row.builtin_file) {
    const data = await readFile(path.join(process.cwd(), "public", row.builtin_file));
    return { data, format };
  }
  const { data, error } = await createAdminClient()
    .storage.from(REPORT_IMAGES_BUCKET)
    .download(row.storage_path!);
  if (error || !data) throw new Error(error?.message ?? "Could not load the cover image");
  return { data: Buffer.from(await data.arrayBuffer()), format };
}

/**
 * The image to print on a report cover: the one requested, else the firm default,
 * else the bundled skyline, so a missing library never blocks a report.
 */
export async function resolveCoverImage(
  requestedId?: string | null,
): Promise<{ id: string | null; src: ReportImageSource }> {
  try {
    const rows = await queryDb<ReportImageRow>(
      `SELECT ${SELECT_COLUMNS} FROM wealth.report_images
       WHERE ($1::uuid IS NOT NULL AND id = $1::uuid) OR is_default
       ORDER BY (id = $1::uuid) DESC NULLS LAST
       LIMIT 1`,
      [isReportImageId(requestedId) ? requestedId : null],
    );
    if (rows[0]) return { id: rows[0].id, src: await loadSource(rows[0]) };
  } catch (error) {
    console.error("Falling back to the bundled report cover", error);
  }
  return { id: null, src: COVER_SKYLINE };
}
