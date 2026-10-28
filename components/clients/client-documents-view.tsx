"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Download, Loader2, Upload } from "lucide-react";

import { ClientEmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DashCard,
  DashCardContent,
  DashCardDescription,
  DashCardHeader,
  DashCardTitle,
} from "@/components/ui/dash-card";
import { H3, Muted, TextSmall } from "@/components/ui/typography";
import type { ReportDoc } from "@/lib/api/domain/reports";
import type { DocumentRequest, VaultDocument } from "@/lib/wealth/wm-types";

type DocumentsPayload = {
  requests: DocumentRequest[];
  documents: VaultDocument[];
  reports: ReportDoc[];
  expiring: VaultDocument[];
};

function formatDate(value: string | null) {
  if (!value) return null;
  return new Date(`${value}T12:00:00`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function UploadRequestRow({
  request,
  onUploaded,
}: {
  request: DocumentRequest;
  onUploaded: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("documentRequestId", request.id);
      const res = await fetch("/api/client/documents", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      onUploaded();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border/40 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <TextSmall className="font-medium">{request.title}</TextSmall>
        {request.description ? (
          <Muted className="mt-1 text-sm">{request.description}</Muted>
        ) : null}
        {request.due_date ? (
          <Muted className="mt-1 text-sm">Due {formatDate(request.due_date)}</Muted>
        ) : null}
        {error ? <p className="mt-1 text-sm text-destructive">{error}</p> : null}
      </div>
      <div className="flex items-center gap-2">
        <Badge variant={request.status === "pending" ? "destructive" : "secondary"}>
          {request.status}
        </Badge>
        {request.status === "pending" ? (
          <>
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              accept=".pdf,.png,.jpg,.jpeg,.csv,.xlsx"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleFile(file);
              }}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
            >
              {uploading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Upload className="size-4" />
              )}
              Upload
            </Button>
          </>
        ) : null}
      </div>
    </div>
  );
}

export function ClientDocumentsView() {
  const [data, setData] = useState<DocumentsPayload | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/client/documents");
      const json = await res.json();
      setData(json);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const pendingRequests = (data?.requests ?? []).filter((r) => r.status === "pending");
  const sharedVault = data?.documents ?? [];
  const reports = data?.reports ?? [];
  const expiring = data?.expiring ?? [];
  const hasAnything = pendingRequests.length > 0 || sharedVault.length > 0;
  const reportsPointer =
    reports.length > 0 ? (
      <Link
        href="/clients/dashboard/reports"
        className="flex items-center justify-between gap-3 rounded-xl border border-border/40 bg-card px-4 py-3 text-sm hover:bg-muted/40"
      >
        <span>
          Your {reports.length === 1 ? "report is" : `${reports.length} reports are`} in{" "}
          <span className="font-medium">Reports</span>.
        </span>
        <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
      </Link>
    ) : null;

  if (!hasAnything) {
    return (
      <div className="flex flex-col gap-4">
        {reportsPointer}
        <DashCard>
          <DashCardContent>
            <ClientEmptyState
              variant="documents"
              title="No documents yet"
              description="When your wealth manager requests files or shares documents, they will appear here."
            />
          </DashCardContent>
        </DashCard>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {reportsPointer}
      {expiring.length > 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50/60 px-4 py-3">
          <TextSmall className="font-medium text-amber-900">
            {expiring.length} document{expiring.length === 1 ? "" : "s"} expiring soon
          </TextSmall>
          <Muted className="text-sm text-amber-800">
            Your wealth manager may ask you to renew these. Check the shared documents below.
          </Muted>
        </div>
      ) : null}

      <section>
        <H3 className="mb-3 text-base">Requested by your wealth manager</H3>
        {pendingRequests.length > 0 ? (
          <div className="flex flex-col gap-2">
            {pendingRequests.map((r) => (
              <UploadRequestRow key={r.id} request={r} onUploaded={load} />
            ))}
          </div>
        ) : (
          <Muted className="text-sm">No outstanding upload requests.</Muted>
        )}
      </section>

      <section>
        <H3 className="mb-3 text-base">Shared by your wealth manager</H3>
        <div className="flex flex-col gap-2">
          {sharedVault.map((d) => (
            <div
              key={d.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-border/40 p-4"
            >
              <div>
                <TextSmall className="font-medium">{d.title}</TextSmall>
                <Muted className="text-sm capitalize">
                  {d.category.replace(/_/g, " ")} ·{" "}
                  {formatDate(d.created_at.slice(0, 10))}
                </Muted>
              </div>
              <a href={`/api/client/documents/${d.id}/download`}>
                <Button size="sm" variant="outline">
                  <Download className="size-4" />
                  Download
                </Button>
              </a>
            </div>
          ))}
          {sharedVault.length === 0 ? (
            <Muted className="text-sm">No shared documents yet.</Muted>
          ) : null}
        </div>
      </section>
    </div>
  );
}
