import { NextResponse } from "next/server";

import {
  createReportImage,
  listReportImages,
  REPORT_IMAGE_MAX_BYTES,
} from "@/lib/reports/cover-images";
import { getAdvisorApiSession } from "@/lib/wealth/session";

export async function GET() {
  const session = await getAdvisorApiSession();
  if (!session.ok) return session.response;

  const images = await listReportImages();
  return NextResponse.json({ images });
}

export async function POST(request: Request) {
  const session = await getAdvisorApiSession();
  if (!session.ok) return session.response;

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Choose an image to upload" }, { status: 400 });
  }
  if (file.size > REPORT_IMAGE_MAX_BYTES) {
    return NextResponse.json({ error: "Images must be 8 MB or smaller" }, { status: 400 });
  }

  const fallbackLabel = file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim();
  const label = String(form?.get("label") ?? "").trim() || fallbackLabel || "Cover image";

  try {
    const image = await createReportImage({
      label: label.slice(0, 80),
      bytes: Buffer.from(await file.arrayBuffer()),
      uploadedBy: session.userId,
    });
    return NextResponse.json({ image });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
