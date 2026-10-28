"use client";

import { useState } from "react";
import { ChevronDown, Eye, FileText, Loader2 } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { statementKindTitle, type ReportKind } from "@/lib/wealth/period-calendar";

type Props = {
  clientId: string;
  periodId?: string;
  kind?: ReportKind;
  className?: string;
  buttonVariant?: "default" | "outline";
  compact?: boolean;
  /** Cover photo from the image library; the firm default is used when omitted. */
  coverImageId?: string | null;
};

const KINDS: { kind: ReportKind; hint: string }[] = [
  { kind: "monthly", hint: "The month you have open" },
  { kind: "quarterly", hint: "Calendar quarter of that month" },
  { kind: "annual", hint: "Full calendar year" },
];

const KIND_ACTION: Record<ReportKind, string> = {
  monthly: "Generate monthly",
  quarterly: "Generate quarterly",
  annual: "Generate annual",
};

type ReadyReport = {
  id: string;
  title: string;
};

function ReportPreviewLink({ report }: { report: ReadyReport }) {
  return (
    <div className="flex flex-col items-start gap-1.5">
      <p className="text-xs text-muted-foreground">
        {report.title} is saved as a draft. Check it, then publish it from the drafts list.
      </p>
      <a
        href={`/api/reports/${report.id}/download?inline=1`}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
      >
        <Eye className="size-4" />
        Preview
      </a>
    </div>
  );
}

export function GenerateReportButton({
  clientId,
  periodId,
  kind,
  className,
  buttonVariant = "default",
  compact = false,
  coverImageId = null,
}: Props) {
  const [loading, setLoading] = useState<ReportKind | null>(null);
  const [ready, setReady] = useState<ReadyReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate(kind: ReportKind) {
    setLoading(kind);
    setReady(null);
    setError(null);
    try {
      const res = await fetch("/api/reports/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, periodId, kind, coverImageId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Generation failed");
      const title = typeof data.title === "string" ? data.title : "Report";
      if (typeof data.id === "string") {
        setReady({ id: data.id, title });
      }
      window.dispatchEvent(
        new CustomEvent("ja:report-generated", {
          detail:
            compact && typeof data.id === "string" ? { id: data.id, title } : null,
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setLoading(null);
    }
  }

  const busy = loading !== null;

  if (kind) {
    return (
      <div className={cn("flex flex-col items-start gap-2", className)}>
        <Button
          size="sm"
          variant={buttonVariant}
          disabled={busy || !clientId}
          onClick={() => handleGenerate(kind)}
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-4" />}
          {KIND_ACTION[kind]}
        </Button>
        {ready && !compact ? <ReportPreviewLink report={ready} /> : null}
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col items-start gap-2", className)}>
      <DropdownMenu>
        <DropdownMenuTrigger
          disabled={busy || !clientId}
          render={
            <Button size="sm" variant={buttonVariant} disabled={busy || !clientId}>
              {busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <FileText className="size-4" />
              )}
              Generate report
              <ChevronDown className="size-4" />
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="w-64" sideOffset={6}>
          <DropdownMenuLabel>PDF variant</DropdownMenuLabel>
          {KINDS.map(({ kind, hint }) => (
            <DropdownMenuItem
              key={kind}
              disabled={busy}
              onClick={() => handleGenerate(kind)}
            >
              <span className="flex min-w-0 flex-col">
                <span>{statementKindTitle(kind)}</span>
                <span className="text-xs text-muted-foreground">{hint}</span>
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {ready ? <ReportPreviewLink report={ready} /> : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
