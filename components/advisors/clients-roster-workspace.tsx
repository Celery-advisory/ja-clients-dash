"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, Search } from "lucide-react";

import { SectionLabel } from "@/components/advisors/section-label";
import { SurfaceCard, advisorSurface } from "@/components/advisors/advisor-surface";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ColumnLabel, StatusMark, TableFooterBar, usePagedRows } from "@/components/ui/table";
import { Muted, TextSmall } from "@/components/ui/typography";
import { formatUsd } from "@/lib/wealth/constants";
import { cn } from "@/lib/utils";
import type { AdvisorListRow } from "@/lib/wealth/types";
import type { ClientListExtended } from "@/lib/wealth/wm-types";

const STATUS_TABS = [
  { id: "all", label: "All" },
  { id: "onboarding", label: "Onboarding" },
  { id: "active", label: "Active" },
  { id: "review_due", label: "Review due" },
  { id: "inactive", label: "Inactive" },
] as const;

const STATUS_LABEL: Record<string, string> = {
  onboarding: "Onboarding",
  active: "Active",
  review_due: "Review due",
  inactive: "Inactive",
};

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function formatReturn(pct: number | null) {
  if (pct == null) return null;
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

function statusTone(status: string): "open" | "closed" | "attention" | "neutral" {
  if (status === "active") return "open";
  if (status === "review_due") return "closed";
  if (status === "onboarding") return "attention";
  return "neutral";
}

export function ClientsRosterWorkspace({
  clients,
  advisors,
  reportsDueCount = 0,
}: {
  clients: ClientListExtended[];
  advisors: AdvisorListRow[];
  reportsDueCount?: number;
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [advisorFilter, setAdvisorFilter] = useState("all");
  const [openOnly, setOpenOnly] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkAdvisorId, setBulkAdvisorId] = useState("");

  const counts = useMemo(() => {
    const next: Record<string, number> = { all: clients.length };
    for (const tab of STATUS_TABS) {
      if (tab.id === "all") continue;
      next[tab.id] = clients.filter((c) => c.status === tab.id).length;
    }
    return next;
  }, [clients]);

  const attentionOnboarding = counts.onboarding ?? 0;
  const attentionReview = counts.review_due ?? 0;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return clients.filter((c) => {
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (advisorFilter !== "all" && c.advisor_id !== advisorFilter) return false;
      if (openOnly && !c.has_open_request) return false;
      if (!q) return true;
      return (
        c.full_name.toLowerCase().includes(q) ||
        c.client_number.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q)
      );
    });
  }, [clients, search, statusFilter, advisorFilter, openOnly]);

  const page = usePagedRows(filtered, {
    resetKey: `${search}|${statusFilter}|${advisorFilter}|${openOnly}`,
  });

  async function bulkAssign() {
    if (selected.size === 0 || !bulkAdvisorId) return;
    setBulkLoading(true);
    try {
      await fetch("/api/clients/bulk-assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientIds: [...selected], advisorId: bulkAdvisorId }),
      });
      setSelected(new Set());
      window.location.reload();
    } finally {
      setBulkLoading(false);
    }
  }

  async function tagForReview() {
    if (selected.size === 0) return;
    setBulkLoading(true);
    try {
      await fetch("/api/clients/bulk-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientIds: [...selected] }),
      });
      setSelected(new Set());
      window.location.reload();
    } finally {
      setBulkLoading(false);
    }
  }

  function toggleAll(checked: boolean) {
    if (checked) setSelected(new Set(page.rows.map((c) => c.id)));
    else setSelected(new Set());
  }

  return (
    <section className="flex flex-col gap-4">
      {attentionOnboarding + attentionReview + reportsDueCount > 0 && statusFilter === "all" ? (
        <SurfaceCard tint="bg-[#fff8f0]" className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <TextSmall className="font-medium">Needs attention</TextSmall>
            <Muted className="text-[12px]">
              {[
                attentionOnboarding > 0 ? `${attentionOnboarding} still onboarding` : null,
                attentionReview > 0 ? `${attentionReview} review due` : null,
                reportsDueCount > 0
                  ? `${reportsDueCount} missing a statement PDF`
                  : null,
              ]
                .filter(Boolean)
                .join(". ")}
              .
            </Muted>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {attentionOnboarding > 0 ? (
              <Button size="xs" variant="outline" onClick={() => setStatusFilter("onboarding")}>
                View onboarding
              </Button>
            ) : null}
            {attentionReview > 0 ? (
              <Button size="xs" variant="outline" onClick={() => setStatusFilter("review_due")}>
                View reviews
              </Button>
            ) : null}
            {reportsDueCount > 0 ? (
              <Link
                href="/advisors/dashboard/reports"
                className={buttonVariants({ size: "xs", variant: "outline" })}
              >
                View reports
              </Link>
            ) : null}
          </div>
        </SurfaceCard>
      ) : null}

      <div className="flex flex-col gap-3">
        <SectionLabel>Roster</SectionLabel>
        <nav className="flex gap-5 overflow-x-auto border-b border-border/70 [scrollbar-width:none] [&>*]:shrink-0">
          {STATUS_TABS.map((tab) => {
            const active = statusFilter === tab.id;
            const count = counts[tab.id] ?? 0;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={cn(
                  "relative whitespace-nowrap py-2.5 text-sm transition-[color] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)]",
                  active
                    ? "font-semibold text-brand-primary"
                    : "font-medium text-muted-foreground hover:text-foreground",
                )}
              >
                {tab.label}
                <span className="ml-1.5 text-[11px] font-medium text-muted-foreground">
                  {count}
                </span>
                <span
                  className={cn(
                    "absolute inset-x-0 bottom-0 h-0.5 origin-left bg-brand-accent transition-transform duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none",
                    active ? "scale-x-100" : "scale-x-0",
                  )}
                />
              </button>
            );
          })}
        </nav>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by name, email, or client number"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {advisors.length > 1 ? (
          <Select value={advisorFilter} onChange={(e) => setAdvisorFilter(e.target.value)}>
            <option value="all">All managers</option>
            {advisors.map((a) => (
              <option key={a.id} value={a.id}>
                {a.full_name}
              </option>
            ))}
          </Select>
        ) : null}
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={openOnly}
            onChange={(e) => setOpenOnly(e.target.checked)}
            className="size-4 rounded border-border"
          />
          Open requests
        </label>
      </div>

      {selected.size > 0 ? (
        <SurfaceCard className="flex flex-wrap items-center gap-2 py-2.5">
          <TextSmall className="font-medium">{selected.size} selected</TextSmall>
          <Select
            value={bulkAdvisorId}
            onChange={(e) => setBulkAdvisorId(e.target.value)}
            className="h-8 w-44 text-xs"
          >
            <option value="">Assign to...</option>
            {advisors.filter((a) => a.is_active).map((a) => (
              <option key={a.id} value={a.id}>
                {a.full_name}
              </option>
            ))}
          </Select>
          <Button
            size="xs"
            disabled={bulkLoading || !bulkAdvisorId}
            onClick={bulkAssign}
          >
            Assign manager
          </Button>
          <Button size="xs" variant="outline" disabled={bulkLoading} onClick={tagForReview}>
            Tag for review
          </Button>
        </SurfaceCard>
      ) : null}

      <div className={cn(advisorSurface.card, "overflow-hidden")}>
        <div className="hidden items-center gap-3 border-b border-[#e6ebf2] bg-[#f4f7fb] px-4 py-3 text-[13px] font-medium text-[#64748b] lg:grid lg:grid-cols-[auto_minmax(0,1.6fr)_minmax(0,0.9fr)_minmax(0,0.8fr)_minmax(0,1fr)_auto]">
          <input
            type="checkbox"
            checked={page.rows.length > 0 && page.rows.every((client) => selected.has(client.id))}
            onChange={(e) => toggleAll(e.target.checked)}
            className="size-4 rounded border-[#d5dbe3]"
            aria-label="Select all clients on this page"
          />
          <ColumnLabel>Client</ColumnLabel>
          <ColumnLabel>Portfolio</ColumnLabel>
          <ColumnLabel>Status</ColumnLabel>
          <ColumnLabel>Wealth manager</ColumnLabel>
          <span />
        </div>

        {filtered.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <TextSmall className="font-medium">No clients match these filters</TextSmall>
            <Muted className="mt-1">Try another status, or clear search.</Muted>
          </div>
        ) : (
          page.rows.map((client) => {
            const ret = formatReturn(client.period_return_pct);
            return (
              <div
                key={client.id}
                className="flex items-center gap-3 border-b border-[#eef1f4] px-4 py-3.5 last:border-0 transition-colors duration-150 hover:bg-[#fafbfd] lg:grid lg:grid-cols-[auto_minmax(0,1.6fr)_minmax(0,0.9fr)_minmax(0,0.8fr)_minmax(0,1fr)_auto]"
              >
                <input
                  type="checkbox"
                  checked={selected.has(client.id)}
                  onChange={(e) => {
                    const next = new Set(selected);
                    if (e.target.checked) next.add(client.id);
                    else next.delete(client.id);
                    setSelected(next);
                  }}
                  className="size-4 rounded border-border"
                  aria-label={`Select ${client.full_name}`}
                />
                <Link
                  href={`/advisors/dashboard/clients/${client.id}`}
                  className="flex min-w-0 flex-1 items-center gap-3 lg:flex-none"
                >
                  <Avatar>
                    <AvatarFallback className="bg-brand-primary/10 text-xs font-medium text-brand-primary">
                      {initials(client.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <TextSmall className="truncate font-medium">{client.full_name}</TextSmall>
                    <Muted className="truncate text-[12px]">
                      {STATUS_LABEL[client.status] ?? client.status}
                      {" · "}
                      {client.client_number}
                      {client.location ? ` · ${client.location}` : ""}
                    </Muted>
                    <Muted className="mt-0.5 tabular-nums text-[12px] lg:hidden">
                      {formatUsd(client.aum)}
                      {ret ? ` · ${ret}` : ""}
                    </Muted>
                  </div>
                </Link>
                <div className="hidden min-w-0 lg:block">
                  <TextSmall className="tabular-nums">{formatUsd(client.aum)}</TextSmall>
                  <Muted className="text-[12px]">
                    {ret ? (
                      <span
                        className={
                          client.period_return_pct != null && client.period_return_pct < 0
                            ? "text-destructive"
                            : "text-emerald-700"
                        }
                      >
                        {ret} period
                      </span>
                    ) : (
                      "No data yet"
                    )}
                  </Muted>
                </div>
                <div className="hidden min-w-0 lg:block">
                  <StatusMark tone={statusTone(client.status)}>
                    {STATUS_LABEL[client.status] ?? client.status}
                  </StatusMark>
                  {client.has_open_request ? (
                    <Muted className="text-[12px]">Open request</Muted>
                  ) : client.next_review_date ? (
                    <Muted className="text-[12px]">
                      Review{" "}
                      {new Date(`${client.next_review_date}T12:00:00`).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                      })}
                    </Muted>
                  ) : (
                    <Muted className="text-[12px]">No review set</Muted>
                  )}
                </div>
                <Muted className="hidden truncate text-sm lg:block">
                  {client.advisor_name ?? "Unassigned"}
                </Muted>
                <Link
                  href={`/advisors/dashboard/clients/${client.id}`}
                  className="shrink-0 text-muted-foreground transition-colors duration-150 hover:text-foreground"
                  aria-label={`Open ${client.full_name}`}
                >
                  <ChevronRight className="size-4" />
                </Link>
              </div>
            );
          })
        )}
        {filtered.length > 0 ? (
          <TableFooterBar
            total={page.total}
            page={page.page}
            pageCount={page.pageCount}
            pageSize={page.pageSize}
            onPageChange={page.setPage}
            onPageSizeChange={page.setPageSize}
          />
        ) : null}
      </div>
    </section>
  );
}
