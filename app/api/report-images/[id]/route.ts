import { NextResponse } from "next/server";

import {
  deleteReportImage,
  isReportImageId,
  renameReportImage,
  setDefaultReportImage,
} from "@/lib/reports/cover-images";
import { getAdminApiSession } from "@/lib/wealth/session";

/** Changing the firm default or the shared library is limited to admins. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getAdminApiSession();
  if (!session.ok) return session.response;

  const { id } = await params;
  if (!isReportImageId(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  let image = null;

  if (typeof body.label === "string") {
    const label = body.label.trim().slice(0, 80);
    if (!label) return NextResponse.json({ error: "Enter a name" }, { status: 400 });
    image = await renameReportImage(id, label);
    if (!image) return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (body.isDefault === true) {
    image = await setDefaultReportImage(id);
    if (!image) return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!image) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  return NextResponse.json({ image });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getAdminApiSession();
  if (!session.ok) return session.response;

  const { id } = await params;
  const result = await deleteReportImage(id);
  if (result === "not_found") return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (result === "protected") {
    return NextResponse.json(
      { error: "Built-in images and the current default cannot be deleted" },
      { status: 409 },
    );
  }
  return NextResponse.json({ ok: true });
}
