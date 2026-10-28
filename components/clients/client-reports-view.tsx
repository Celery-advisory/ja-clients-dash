import { Download, FileText } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import type { ReportDoc } from "@/lib/api/domain/reports";
import type { ReportSummary } from "@/lib/reports/summary";
import { cn } from "@/lib/utils";

function usd(value: number) {
  return `$${Math.round(Math.abs(value)).toLocaleString("en-US")}`;
}

function signedUsd(value: number) {
  return `${value < 0 ? "-" : "+"}${usd(value)}`;
}

function signedPct(value: number | null) {
  if (value == null || !Number.isFinite(value)) return null;
  return `${value < 0 ? "-" : "+"}${Math.abs(value).toFixed(1)}%`;
}

function Change({ gain, pct }: { gain: number | null; pct: number | null }) {
  if (gain == null) return <span className="text-white/60">Not yet available</span>;
  const pctLabel = signedPct(pct);
  return (
    <span className={gain < 0 ? "text-red-200" : "text-emerald-200"}>
      {signedUsd(gain)}
      {pctLabel ? <span className="ml-1.5 text-sm text-white/70">{pctLabel}</span> : null}
    </span>
  );
}

function HeadlineNumbers({ summary }: { summary: ReportSummary }) {
  return (
    <dl className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
      <div>
        <dt className="text-[11px] font-medium tracking-wide text-white/60 uppercase">
          Portfolio value
        </dt>
        <dd className="font-numeric mt-1 text-2xl font-medium">{usd(summary.totalValueUsd)}</dd>
      </div>
      <div>
        <dt className="text-[11px] font-medium tracking-wide text-white/60 uppercase">
          This period
        </dt>
        <dd className="font-numeric mt-1 text-xl font-medium">
          <Change gain={summary.periodGainUsd} pct={summary.periodReturnPct} />
        </dd>
      </div>
      <div>
        <dt className="text-[11px] font-medium tracking-wide text-white/60 uppercase">
          Since you started
        </dt>
        <dd className="font-numeric mt-1 text-xl font-medium">
          <Change gain={summary.sinceStartGainUsd} pct={summary.sinceStartPct} />
        </dd>
      </div>
    </dl>
  );
}

/** The newest report, front and centre: what most clients sign in for. */
export function LatestReportHero({ report }: { report: ReportDoc }) {
  const isNew = report.status === "new";
  return (
    <section
      aria-labelledby="latest-report-title"
      className="rounded-2xl bg-brand-primary px-5 py-6 text-white sm:px-7 sm:py-7"
    >
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs font-medium tracking-wide text-brand-accent uppercase">
          {isNew ? "Your new report is ready" : "Your latest report"}
        </p>
        {isNew ? (
          <span className="rounded-full bg-brand-accent px-2 py-0.5 text-[10px] font-semibold text-brand-primary uppercase">
            New
          </span>
        ) : null}
      </div>
      <h2 id="latest-report-title" className="mt-2 font-heading text-xl font-medium sm:text-2xl">
        {report.summary?.periodLabel ?? report.name}
      </h2>
      <p className="mt-1 text-sm text-white/70">Published {report.date}</p>

      {report.summary ? <HeadlineNumbers summary={report.summary} /> : null}

      <div className="mt-6 flex flex-wrap gap-2">
        <a
          href={report.readUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            buttonVariants({ size: "sm" }),
            "h-9 bg-brand-accent px-4 text-brand-primary hover:bg-brand-accent/90",
          )}
        >
          <FileText className="size-4" />
          Read report
        </a>
        <a
          href={report.downloadUrl}
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "h-9 border-white/30 bg-transparent px-4 text-white hover:bg-white/10 hover:text-white",
          )}
        >
          <Download className="size-4" />
          Download PDF
        </a>
      </div>
    </section>
  );
}

/** Every published report, newest first. */
export function ClientReportsList({ reports }: { reports: ReportDoc[] }) {
  return (
    <ul className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/60 bg-card">
      {reports.map((report) => (
        <li key={report.id} className="flex flex-wrap items-center gap-3 px-4 py-3.5">
          <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{report.name}</p>
            <p className="text-xs text-muted-foreground">
              Published {report.date}
              {report.summary ? ` · Value ${usd(report.summary.totalValueUsd)}` : ""}
            </p>
          </div>
          {report.status === "new" ? (
            <span className="rounded-full bg-brand-accent/15 px-2 py-0.5 text-[11px] font-medium text-brand-primary">
              New
            </span>
          ) : null}
          <a
            href={report.readUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8 text-xs")}
          >
            Read
          </a>
          <a
            href={report.downloadUrl}
            aria-label={`Download ${report.name}`}
            className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Download className="size-4" />
          </a>
        </li>
      ))}
    </ul>
  );
}
