"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Download, Eye, FileText, Loader2, Send, Trash2 } from "lucide-react";

import { GenerateReportButton } from "@/components/reports/generate-report-button";
import { OutstandingReportsNotice } from "@/components/reports/outstanding-reports-notice";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DashCard,
  DashCardContent,
  DashCardDescription,
  DashCardHeader,
  DashCardTitle,
} from "@/components/ui/dash-card";
import { Muted, TextSmall } from "@/components/ui/typography";
import type { ReportDoc } from "@/lib/api/domain/reports";
import { cn } from "@/lib/utils";

type AdvisorReport = ReportDoc & { clientName?: string; clientId?: string };

function shortDate(value: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function usd(value: number) {
  return `$${Math.round(value).toLocaleString("en-US")}`;
}

export function AdvisorReportsList({ clientId }: { clientId?: string }) {
  const [reports, setReports] = useState<AdvisorReport[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [notify, setNotify] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const load = useCallback(async () => {
    const url = clientId ? `/api/reports?clientId=${clientId}` : "/api/reports";
    const res = await fetch(url);
    const data = await res.json();
    setReports(data.reports ?? []);
  }, [clientId]);

  useEffect(() => {
    load();
    const handler = () => load();
    window.addEventListener("ja:report-generated", handler);
    return () => window.removeEventListener("ja:report-generated", handler);
  }, [load]);

  const drafts = useMemo(() => reports.filter((r) => r.status === "draft"), [reports]);
  const published = useMemo(() => reports.filter((r) => r.status !== "draft"), [reports]);
  const selectedDrafts = drafts.filter((d) => selected.has(d.id));

  async function publish(ids: string[]) {
    setBusy(ids.length === 1 ? ids[0] : "bulk");
    setMessage(null);
    try {
      const res = await fetch("/api/reports/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportIds: ids, notify }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not publish");
      const results = (data.results ?? []) as { ok: boolean; emailed?: boolean }[];
      const done = results.filter((r) => r.ok).length;
      const emailed = results.filter((r) => r.emailed).length;
      const failed = results.length - done;
      setMessage({
        tone: failed ? "error" : "ok",
        text:
          `Published ${done} report${done === 1 ? "" : "s"}` +
          (notify ? `, ${emailed} emailed` : ", no emails sent") +
          (failed ? `. ${failed} could not be published.` : "."),
      });
      setSelected(new Set());
      await load();
    } catch (err) {
      setMessage({ tone: "error", text: err instanceof Error ? err.message : "Could not publish" });
    } finally {
      setBusy(null);
    }
  }

  async function discard(report: AdvisorReport) {
    if (!window.confirm(`Discard the draft "${report.name}"? You can generate it again later.`)) {
      return;
    }
    setBusy(report.id);
    setMessage(null);
    try {
      const res = await fetch(`/api/reports/${report.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not discard");
      await load();
    } catch (err) {
      setMessage({ tone: "error", text: err instanceof Error ? err.message : "Could not discard" });
    } finally {
      setBusy(null);
    }
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allSelected = drafts.length > 0 && selectedDrafts.length === drafts.length;

  return (
    <div className="flex flex-col gap-4">
      {clientId ? <OutstandingReportsNotice clientId={clientId} /> : null}
      {clientId ? (
        <div className="flex items-center justify-between gap-3">
          <div>
            <TextSmall className="font-semibold">Wealth reports</TextSmall>
            <Muted>New reports are saved as drafts. The client sees them once you publish.</Muted>
          </div>
          <GenerateReportButton clientId={clientId} />
        </div>
      ) : null}

      <DashCard>
        <DashCardHeader>
          <DashCardTitle>Waiting to publish</DashCardTitle>
          <DashCardDescription>
            {drafts.length === 0
              ? "No drafts. Generated reports land here for a check before the client sees them."
              : `${drafts.length} draft${drafts.length === 1 ? "" : "s"}. Preview each one, then publish.`}
          </DashCardDescription>
        </DashCardHeader>
        {drafts.length > 0 ? (
          <DashCardContent className="gap-0">
            <div className="flex flex-wrap items-center gap-3 border-b border-border/60 pb-3">
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  className="size-4 accent-[var(--brand-primary,#202353)]"
                  checked={allSelected}
                  onChange={() =>
                    setSelected(allSelected ? new Set() : new Set(drafts.map((d) => d.id)))
                  }
                />
                Select all
              </label>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  className="size-4"
                  checked={notify}
                  onChange={(e) => setNotify(e.target.checked)}
                />
                Email clients their headline numbers
              </label>
              <Button
                size="sm"
                className="ml-auto"
                disabled={selectedDrafts.length === 0 || busy !== null}
                onClick={() => publish(selectedDrafts.map((d) => d.id))}
              >
                {busy === "bulk" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
                Publish {selectedDrafts.length || ""} selected
              </Button>
            </div>
            {drafts.map((doc) => (
              <div
                key={doc.id}
                className="flex flex-wrap items-center gap-3 border-b border-border/60 py-3 last:border-0 last:pb-0"
              >
                <input
                  type="checkbox"
                  aria-label={`Select ${doc.name}`}
                  className="size-4"
                  checked={selected.has(doc.id)}
                  onChange={() => toggle(doc.id)}
                />
                <div className="min-w-0 flex-1">
                  <TextSmall className="truncate font-medium">
                    {doc.clientName ? `${doc.clientName} · ` : ""}
                    {doc.name}
                  </TextSmall>
                  <Muted className="text-xs">
                    Generated {doc.date}
                    {doc.summary ? ` · Value ${usd(doc.summary.totalValueUsd)}` : ""}
                  </Muted>
                </div>
                <Badge variant="secondary">Draft</Badge>
                <a
                  href={doc.readUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "text-xs")}
                >
                  <Eye className="size-3.5" />
                  Preview
                </a>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs"
                  disabled={busy !== null}
                  onClick={() => publish([doc.id])}
                >
                  {busy === doc.id ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Send className="size-3.5" />
                  )}
                  Publish
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`Discard ${doc.name}`}
                  disabled={busy !== null}
                  onClick={() => discard(doc)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))}
          </DashCardContent>
        ) : clientId && published.length === 0 ? (
          <DashCardContent>
            <Link href={`/advisors/dashboard/clients/${clientId}/statement`}>
              <Button variant="outline" size="sm" className="w-fit">
                Enter statement data
              </Button>
            </Link>
          </DashCardContent>
        ) : null}
      </DashCard>

      {message ? (
        <p
          className={cn(
            "text-xs",
            message.tone === "ok" ? "text-emerald-700" : "text-destructive",
          )}
          role="status"
        >
          {message.text}
        </p>
      ) : null}

      <DashCard>
        <DashCardHeader>
          <DashCardTitle>Published</DashCardTitle>
          <DashCardDescription>
            {published.length === 0
              ? "Nothing published yet."
              : `${published.length} in client portals. Opened shows when the client first read it.`}
          </DashCardDescription>
        </DashCardHeader>
        <DashCardContent className="gap-3">
          {published.map((doc) => (
            <div
              key={doc.id}
              className="flex flex-wrap items-center gap-3 border-b border-border/60 pb-3 last:border-0 last:pb-0"
            >
              <FileText className="size-4 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <TextSmall className="truncate font-medium">
                  {doc.clientName ? `${doc.clientName} · ` : ""}
                  {doc.name}
                </TextSmall>
                <Muted className="text-xs">Published {doc.date}</Muted>
              </div>
              {doc.status === "viewed" ? (
                <Badge variant="outline" className="gap-1 text-emerald-700">
                  <CheckCircle2 className="size-3" />
                  Opened {shortDate(doc.firstViewedAt)}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground">
                  Not opened yet
                </Badge>
              )}
              <a
                href={doc.readUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "text-xs")}
              >
                <Eye className="size-3.5" />
                Preview
              </a>
              <a
                href={doc.downloadUrl}
                aria-label={`Download ${doc.name}`}
                className="inline-flex size-8 items-center justify-center rounded-md hover:bg-muted"
              >
                <Download className="size-4" />
              </a>
            </div>
          ))}
        </DashCardContent>
      </DashCard>
    </div>
  );
}
