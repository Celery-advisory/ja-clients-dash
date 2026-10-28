import { NextResponse } from "next/server";

import { getAllReports, getClientReports } from "@/lib/api/domain/reports";
import { canAccessClient, getApiSession } from "@/lib/wealth/session";
import { getClientById } from "@/lib/wealth/queries";

export async function GET(request: Request) {
  try {
    const session = await getApiSession();
    if (!session.ok) return session.response;

    const { searchParams } = new URL(request.url);
    const requestedId = searchParams.get("clientId");
    const clientId =
      session.profile.role === "client"
        ? session.profile.client_id
        : requestedId;

    if (clientId) {
      const client = await getClientById(clientId);
      if (!client) return NextResponse.json({ reports: [] });
      if (!canAccessClient(session.profile, client.id, client.advisor_id)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const reports = await getClientReports(clientId, {
        forClient: session.profile.role === "client",
      });
      return NextResponse.json({ reports });
    }

    if (session.profile.role !== "advisor" && session.profile.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const reports = await getAllReports();
    return NextResponse.json({ reports });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load reports";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
