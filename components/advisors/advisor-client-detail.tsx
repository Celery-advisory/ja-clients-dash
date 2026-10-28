"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import {
  Archive,
  ArrowLeft,
  Calendar,
  Download,
  Mail,
  MapPin,
  MoreHorizontal,
  Pencil,
  Phone,
  Sparkles,
  UserCog,
} from "lucide-react";

import { AssignAdvisorControl } from "@/components/advisors/assign-advisor-control";
import { ClientOverviewTab } from "@/components/advisors/client-overview-tab";
import { PortfolioOverview } from "@/components/advisors/portfolio-overview";
import { ClientProfileEditor } from "@/components/advisors/client-profile-editor";
import { ClientGoalsWorkspace } from "@/components/advisors/client-goals-workspace";
import { ClientSessionsTab } from "@/components/advisors/client-sessions-tab";
import { ClientDocumentsTab } from "@/components/advisors/client-documents-tab";
import { ClientMessagesTab } from "@/components/advisors/client-messages-tab";
import { ClientNotesWorkspace } from "@/components/advisors/client-notes-workspace";
import { AdvisorReportsList } from "@/components/reports/advisor-reports-list";
import { Button, buttonVariants } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  DashCard,
  DashCardContent,
} from "@/components/ui/dash-card";
import { PageSpinner } from "@/components/ui/page-spinner";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { H1, Muted, TextSmall } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import type { JaPortfolioSummary } from "@/lib/api/domain/wealth-portfolio";
import type {
  AdvisorListRow,
  ClientAddress,
  ClientGoal,
  ClientUpdate,
  PortfolioSnapshot,
  StatementPeriod,
  WealthAdvisor,
  WealthClient,
} from "@/lib/wealth/types";

const TABS = [
  "Overview",
  "Profile",
  "Goals",
  "Portfolio",
  "Sessions",
  "Documents",
  "Messages",
  "Reports",
  "Notes",
] as const;
type Tab = (typeof TABS)[number];

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

function statusDotClass(status: string) {
  if (status === "active") return "bg-emerald-600";
  if (status === "review_due") return "bg-destructive";
  if (status === "onboarding") return "bg-brand-accent";
  return "bg-muted-foreground";
}

export function AdvisorClientDetail() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const tabFromUrl = searchParams.get("tab");
  const invitedFromUrl = searchParams.get("invited");
  const inviteErrorFromUrl = searchParams.get("inviteError");
  const initialTab =
    tabFromUrl && TABS.includes(tabFromUrl as Tab) ? (tabFromUrl as Tab) : "Overview";

  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [client, setClient] = useState<WealthClient | null>(null);
  const [address, setAddress] = useState<ClientAddress | null>(null);
  const [periods, setPeriods] = useState<StatementPeriod[]>([]);
  const [portfolio, setPortfolio] = useState<JaPortfolioSummary | null>(null);
  const [snapshots, setSnapshots] = useState<PortfolioSnapshot[]>([]);
  const [updates, setUpdates] = useState<ClientUpdate[]>([]);
  const [goals, setGoals] = useState<ClientGoal[]>([]);
  const [assignedAdvisor, setAssignedAdvisor] = useState<WealthAdvisor | null>(null);
  const [advisors, setAdvisors] = useState<AdvisorListRow[]>([]);
  const [nextSession, setNextSession] = useState<string | null>(null);
  const [sessionAdvisorId, setSessionAdvisorId] = useState<string | null>(null);
  const [reassignOpen, setReassignOpen] = useState(false);
  const [inviteMessage, setInviteMessage] = useState<string | null>(
    inviteErrorFromUrl
      ? inviteErrorFromUrl
      : invitedFromUrl === "1"
        ? "Invitation sent."
        : null,
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/clients/${params.id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load client");
      setClient(data.client);
      setAddress(data.address);
      setPeriods(data.periods ?? []);
      setPortfolio(data.portfolio);
      setSnapshots(data.snapshots ?? []);
      setUpdates(data.updates ?? []);
      setGoals(data.goals ?? []);
      setAssignedAdvisor(data.assignedAdvisor ?? null);
      setSessionAdvisorId(data.sessionAdvisorId ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load client");
      setClient(null);
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    fetch(`/api/sessions?clientId=${params.id}`)
      .then((res) => res.json())
      .then((data) => {
        const upcoming = (data.sessions ?? []).find(
          (s: { scheduled_at: string | null; status: string }) =>
            s.scheduled_at &&
            new Date(s.scheduled_at) >= new Date() &&
            s.status !== "cancelled",
        );
        setNextSession(upcoming?.scheduled_at ?? null);
      })
      .catch(() => undefined);
  }, [params.id]);

  useEffect(() => {
    fetch("/api/advisors")
      .then((res) => res.json())
      .then((body) => setAdvisors(body.advisors ?? []))
      .catch(() => undefined);
  }, []);

  const isAssignedClient =
    sessionAdvisorId == null || client?.advisor_id === sessionAdvisorId;
  const privateTabs = new Set(["Messages", "Notes"]);
  const visibleTabs = TABS.filter((tab) => !privateTabs.has(tab) || isAssignedClient);

  useEffect(() => {
    if (
      client &&
      (activeTab === "Messages" || activeTab === "Notes") &&
      !isAssignedClient
    ) {
      setActiveTab("Overview");
    }
  }, [activeTab, isAssignedClient, client]);

  async function sendInvite() {
    if (!client) return;
    setInviteMessage(null);
    const res = await fetch(`/api/clients/${client.id}/invite`, { method: "POST" });
    const data = await res.json();
    setInviteMessage(res.ok ? "Invitation sent." : data.error ?? "Invite failed");
    if (res.ok) load();
  }

  async function setClientStatus(status: string) {
    if (!client) return;
    await fetch(`/api/clients/${client.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    load();
  }

  if (loading) {
    return <PageSpinner className="px-4 sm:px-6" />;
  }

  if (!client) {
    return (
      <div className="flex flex-col gap-3 px-4 py-16 sm:px-6">
        <H1>Client not found</H1>
        <Muted>{error ?? "This client is not in the book."}</Muted>
        <Link href="/advisors/dashboard/clients" className="text-sm underline">
          Back to clients
        </Link>
      </div>
    );
  }

  const location = address
    ? [address.city, address.region].filter(Boolean).join(", ")
    : null;
  const slices = (portfolio?.buckets ?? []).map((b) => ({
    name: b.label,
    value: Math.round(b.allocationPct),
    color:
      b.id === "income"
        ? "#b2936b"
        : b.id === "growth"
          ? "#202356"
          : b.id === "venture"
            ? "#829850"
            : b.id === "treasury"
              ? "#484848"
              : "#c4b5a0",
  }));
  const statementHref = `/advisors/dashboard/clients/${client.id}/statement`;

  return (
    <div className="flex flex-col gap-6 px-4 py-6 sm:px-6">
      <Link
        href="/advisors/dashboard/clients"
        className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        All clients
      </Link>

      <header className="flex flex-col gap-5 border-b border-border/70 pb-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <Avatar className="size-14">
              <AvatarFallback className="bg-brand-primary text-base font-medium text-primary-foreground">
                {initials(client.full_name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-col gap-2">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <H1 className="leading-none">{client.full_name}</H1>
                <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                  <span className={cn("size-1.5 rounded-full", statusDotClass(client.status))} />
                  {STATUS_LABEL[client.status] ?? client.status}
                </span>
              </div>
              <p className="text-[12px] tracking-wide text-muted-foreground">
                {client.client_number}
              </p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Mail className="size-3.5" />
                  {client.email}
                </span>
                {client.phone ? (
                  <span className="flex items-center gap-1.5">
                    <Phone className="size-3.5" />
                    {client.phone}
                  </span>
                ) : null}
                {location ? (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="size-3.5" />
                    {location}
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          <div className="flex shrink-0 flex-col gap-3 sm:items-end">
            <div className="flex items-center gap-3">
              {assignedAdvisor ? (
                <div className="flex items-center gap-2.5">
                  <Avatar size="sm">
                    <AvatarFallback className="bg-muted text-[10px] font-medium">
                      {initials(assignedAdvisor.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="leading-tight">
                    <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                      Wealth manager
                    </p>
                    <TextSmall className="font-medium">{assignedAdvisor.full_name}</TextSmall>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setReassignOpen(true)}
                  className="text-sm font-medium text-brand-primary hover:underline"
                >
                  Assign wealth manager
                </button>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Client actions"
                    >
                      <MoreHorizontal className="size-4" />
                    </Button>
                  }
                />
                <DropdownMenuContent align="end" className="w-56" sideOffset={6}>
                  <DropdownMenuItem onClick={() => setActiveTab("Profile")}>
                    <Pencil className="size-4" />
                    Edit client
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setReassignOpen(true)}>
                    <UserCog className="size-4" />
                    Reassign wealth manager
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={sendInvite}>
                    <Mail className="size-4" />
                    {client.invited_at ? "Resend invite" : "Send invite"}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    render={
                      <Link href={`/advisors/dashboard/demo/celerey?clientId=${client.id}`} />
                    }
                  >
                    <Sparkles className="size-4" />
                    Ask Celerey
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    render={<a href={`/api/clients/${client.id}/export`} download />}
                  >
                    <Download className="size-4" />
                    Export data
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    variant={client.status === "inactive" ? "default" : "destructive"}
                    onClick={() =>
                      setClientStatus(client.status === "inactive" ? "active" : "inactive")
                    }
                  >
                    <Archive className="size-4" />
                    {client.status === "inactive" ? "Restore client" : "Archive client"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => setActiveTab("Sessions")}>
                <Calendar className="size-4" />
                Schedule session
              </Button>
              <Link href={statementHref} className={cn(buttonVariants({ size: "sm" }))}>
                Add statement data
              </Link>
            </div>
          </div>
        </div>
        {inviteMessage ? <Muted>{inviteMessage}</Muted> : null}
      </header>

      <div className="sticky top-14 z-10 -mx-4 border-b border-border/70 bg-background/90 px-4 backdrop-blur-sm sm:-mx-6 sm:px-6">
        <nav className="flex gap-5 overflow-x-auto [scrollbar-width:none] [&>*]:shrink-0">
          {visibleTabs.map((tab) => {
            const active = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "relative whitespace-nowrap py-3 text-sm transition-[color] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)]",
                  active
                    ? "font-semibold text-brand-primary"
                    : "font-medium text-muted-foreground hover:text-foreground",
                )}
              >
                {tab}
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

      {activeTab === "Overview" && (
        <ClientOverviewTab
          client={client}
          portfolio={portfolio}
          periodsCount={periods.length}
          goals={goals}
          updates={updates}
          nextSession={nextSession}
          advisorName={assignedAdvisor?.full_name ?? null}
          slices={slices}
          onOpenTab={setActiveTab}
          onActivate={() => setClientStatus("active")}
          onInvite={sendInvite}
        />
      )}

      {activeTab === "Profile" && (
        <ClientProfileEditor
          client={client}
          address={address}
          advisors={advisors}
          onSaved={load}
        />
      )}

      {activeTab === "Goals" && (
        <ClientGoalsWorkspace clientId={client.id} clientName={client.full_name} />
      )}

      {activeTab === "Portfolio" && (
        <PortfolioOverview
          clientId={client.id}
          portfolio={portfolio}
          snapshots={snapshots}
          latestPeriod={periods[0] ?? null}
          onRefresh={load}
        />
      )}

      {activeTab === "Sessions" && <ClientSessionsTab clientId={client.id} />}

      {activeTab === "Documents" && <ClientDocumentsTab clientId={client.id} />}

      {activeTab === "Messages" && <ClientMessagesTab clientId={client.id} />}

      {activeTab === "Reports" && (
        <div className="flex flex-col gap-4 pb-12">
          <DashCard padding="sm" className="border-brand-primary/20 bg-brand-primary/5">
            <DashCardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <TextSmall className="leading-relaxed text-muted-foreground">
                The PDF uses monthly values saved on the statement data page. Enter a month of
                figures there, then generate a monthly, quarterly, or annual statement.
              </TextSmall>
              <Link href={statementHref}>
                <Button variant="outline" size="sm" className="shrink-0">
                  Enter statement data
                </Button>
              </Link>
            </DashCardContent>
          </DashCard>
          <AdvisorReportsList clientId={client.id} />
        </div>
      )}

      {activeTab === "Notes" && <ClientNotesWorkspace clientId={client.id} />}

      <Sheet open={reassignOpen} onOpenChange={setReassignOpen}>
        <SheetContent className="p-0">
          <SheetHeader className="border-b border-border/60">
            <SheetTitle>Reassign wealth manager</SheetTitle>
            <SheetDescription>
              Sessions, messages, and document requests follow the assigned manager.
            </SheetDescription>
          </SheetHeader>
          <div className="px-4 py-5">
            <AssignAdvisorControl
              clientId={client.id}
              advisorId={client.advisor_id}
              advisors={advisors}
              onAssigned={() => {
                load();
                setReassignOpen(false);
              }}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
