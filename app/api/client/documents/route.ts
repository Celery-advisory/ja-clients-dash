import { NextResponse } from "next/server";

import { getClientReports } from "@/lib/api/domain/reports";
import { uploadInternalDocument } from "@/lib/wealth/internal-documents";
import {
  fulfillDocumentRequest,
  getDocumentRequestById,
  insertVaultDocument,
  listDocumentRequests,
  listExpiringDocuments,
  listVaultDocuments,
} from "@/lib/wealth/wm-queries";
import { getClientApiSession } from "@/lib/wealth/session";

export async function GET() {
  const session = await getClientApiSession();
  if (!session.ok) return session.response;

  const clientId = session.profile.client_id;
  const [requests, documents, reports] = await Promise.all([
    listDocumentRequests(null, clientId),
    listVaultDocuments(clientId),
    getClientReports(clientId, { forClient: true }),
  ]);

  const expiring = (await listExpiringDocuments(null, 30)).filter(
    (d) => d.client_id === clientId,
  );

  return NextResponse.json({
    requests: requests.filter((r) => r.status === "pending" || r.status === "uploaded"),
    documents,
    reports,
    expiring,
  });
}

export async function POST(request: Request) {
  const session = await getClientApiSession();
  if (!session.ok) return session.response;

  const clientId = session.profile.client_id;
  const formData = await request.formData();
  const file = formData.get("file");
  const documentRequestId = String(formData.get("documentRequestId") ?? "");

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "File is required" }, { status: 400 });
  }
  if (!documentRequestId) {
    return NextResponse.json({ error: "documentRequestId is required" }, { status: 400 });
  }

  const docRequest = await getDocumentRequestById(documentRequestId, clientId);
  if (!docRequest) {
    return NextResponse.json({ error: "Document request not found" }, { status: 404 });
  }
  if (docRequest.status !== "pending") {
    return NextResponse.json({ error: "This request is no longer pending" }, { status: 400 });
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `${clientId}/${crypto.randomUUID()}-${safeName}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  await uploadInternalDocument(storagePath, buffer, file.type || "application/octet-stream");

  const vaultDoc = await insertVaultDocument({
    clientId,
    title: docRequest.title,
    category: "kyc",
    storagePath,
    fileSizeBytes: file.size,
    mimeType: file.type || "application/octet-stream",
    documentRequestId,
    uploadedByRole: "client",
    uploadedBy: session.userId,
  });

  await fulfillDocumentRequest(documentRequestId);

  return NextResponse.json({ document: vaultDoc });
}
