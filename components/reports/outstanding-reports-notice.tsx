"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, Eye, FileWarning } from "lucide-react";

import { GenerateReportButton } from "@/components/reports/generate-report-button";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Muted, TextSmall } from "@/components/ui/typography";
import { statementKindTitle } from "@/lib/wealth/period-calendar";
import type { OutstandingReport } from "@/lib/wealth/wm-types";

export function OutstandingReportsNotice({ clientId }: { clientId?: string }) {
  const [items, setItems] = useState<OutstandingReport[]>([]);
  const [justGenerated, setJustGenerated] = useState<{ id: string; title: string } | null>(
    null,
  );
  const [expanded, setExpanded] = useState(false);

  const load = useCallback(async () => {
    const url = clientId
      ? `/api/reports/outstanding?clientId=${clientId}`
      : "/api/reports/outstanding";
    const res = await fetch(url);
    const data = await res.json().catch(() => ({}));
    setItems(Array.isArray(data.items) ? data.items : []);
  }, [clientId]);

  useEffect(() => {
    load();
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ id?: string; title?: string } | null>).detail;
      if (detail?.id) {
        setJustGenerated({ id: detail.id, title: detail.title ?? "Report" });
      }
      load();
    };
    window.addEventListener("ja:report-generated", handler);
    return () => window.removeEventListener("ja:report-generated", handler);
  }, [load]);

  const groups = useMemo(() => {
    const map = new Map<string, OutstandingReport[]>();
    for (const item of items) {
      const list = map.get(item.clientId) ?? [];
      list.push(item);
      map.set(item.clientId, list);
    }
    return [...map.entries()].map(([id, rows]) => ({
      clientId: id,
      clientName: rows[0]?.clientName ?? "",
      rows,
    }));
  }, [items]);

  if (groups.length === 0 && !justGenerated) return null;

  const clientCount = groups.length;
  const heading = clientId
    ? "Statement PDFs still to generate"
    : `${clientCount} client${clientCount === 1 ? "" : "s"} need a statement generated`;

  const readyPreview = justGenerated ? (
    <div className="flex flex-col gap-2 rounded-lg border border-border/50 bg-background/70 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <TextSmall className="font-medium">{justGenerated.title} is saved as a draft.</TextSmall>
        <Muted className="text-[13px]">Preview it, then publish it from the drafts list.</Muted>
      </div>
      <a
        href={`/api/reports/${justGenerated.id}/download?inline=1`}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
      >
        <Eye className="size-4" />
        Preview
      </a>
    </div>
  ) : null;

  if (groups.length === 0) {
    return <div className="flex flex-col gap-3">{readyPreview}</div>;
  }

  // One compact line per statement; long lists fold so the drafts below stay in view.
  const rows = groups.flatMap((group) => group.rows);
  const COLLAPSED_ROWS = 4;
  const visibleRows = expanded ? rows : rows.slice(0, COLLAPSED_ROWS);
  const hiddenCount = rows.length - visibleRows.length;

  return (
    <div className="rounded-(--radius-card) border border-brand-accent/35 bg-brand-accent/6 p-4">
      {readyPreview ? <div className="mb-3">{readyPreview}</div> : null}
      <div className="mb-3 flex items-start gap-2.5">
        <FileWarning className="mt-0.5 size-4 shrink-0 text-brand-accent" />
        <div>
          <TextSmall className="font-semibold">
            {heading}
            {clientId ? null : (
              <span className="font-normal text-muted-foreground">
                {" "}
                · {rows.length} statement{rows.length === 1 ? "" : "s"}
              </span>
            )}
          </TextSmall>
          <Muted className="text-[13px]">
            Statement data is on file. Generate a draft, check it, then publish it to the client.
          </Muted>
        </div>
      </div>
      <ul className="divide-y divide-border/60 overflow-hidden rounded-lg border border-border/60 bg-card">
        {visibleRows.map((row) => (
          <li
            key={`${row.clientId}-${row.kind}-${row.periodId}`}
            className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2"
          >
            <div className="min-w-0 flex-1 text-[13px]">
              {clientId ? null : (
                <>
                  <Link
                    href={`/advisors/dashboard/clients/${row.clientId}?tab=Reports`}
                    className="font-medium text-foreground underline-offset-4 hover:underline"
                  >
                    {row.clientName}
                  </Link>
                  <span className="text-muted-foreground"> · </span>
                </>
              )}
              <span>{statementKindTitle(row.kind)}</span>
              <span className="text-muted-foreground"> · {row.windowLabel}</span>
            </div>
            <GenerateReportButton
              clientId={row.clientId}
              periodId={row.periodId}
              kind={row.kind}
              buttonVariant="outline"
              compact
            />
          </li>
        ))}
      </ul>
      {rows.length > COLLAPSED_ROWS ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 inline-flex items-center gap-1 text-[13px] font-medium text-brand-primary hover:underline"
        >
          <ChevronDown className={cn("size-4 transition-transform", expanded && "rotate-180")} />
          {expanded ? "Show fewer" : `Show ${hiddenCount} more`}
        </button>
      ) : null}
    </div>
  );
}
