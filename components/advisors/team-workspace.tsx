"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Loader2,
  Mail,
  MoreHorizontal,
  Shield,
  ShieldOff,
  UserMinus,
  UserPlus,
} from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DashCard,
  DashCardContent,
  DashCardDescription,
  DashCardHeader,
  DashCardTitle,
} from "@/components/ui/dash-card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { KpiItem, KpiStrip } from "@/components/ui/kpi-strip";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Muted, TextSmall } from "@/components/ui/typography";
import { formatUsd } from "@/lib/wealth/constants";
import type { AdvisorListRow } from "@/lib/wealth/types";

type TeamAction = "invite" | "admin" | "active";
type SavingState = { id: string; action: TeamAction } | null;

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function FieldGroup({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-1.5">{children}</div>;
}

function portalStatusLabel(advisor: AdvisorListRow) {
  if (advisor.onboarding_completed_at) return "Onboarded";
  if (advisor.auth_user_id) return "On portal";
  if (advisor.invited_at) return "Invite sent";
  return "Not invited";
}

function AdvisorRowMenu({
  advisor,
  isAdmin,
  isSuperadmin,
  saving,
  onInvite,
  onToggleAdmin,
  onToggleActive,
}: {
  advisor: AdvisorListRow;
  isAdmin: boolean;
  isSuperadmin: boolean;
  saving: SavingState;
  onInvite: () => void;
  onToggleAdmin: () => void;
  onToggleActive: () => void;
}) {
  const busy = saving?.id === advisor.id;
  const canManageAdmin = isSuperadmin && !advisor.is_superadmin;
  const canToggleActive = isAdmin && !advisor.is_superadmin;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={busy}
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Actions for ${advisor.full_name}`}
            disabled={busy}
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <MoreHorizontal className="size-4" />
            )}
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-52" sideOffset={6}>
        <DropdownMenuItem disabled={!advisor.is_active || busy} onClick={onInvite}>
          <Mail className="size-4" />
          {advisor.auth_user_id ? "Resend invite" : "Send invite"}
        </DropdownMenuItem>
        {canManageAdmin ? (
          <DropdownMenuItem disabled={!advisor.is_active || busy} onClick={onToggleAdmin}>
            {advisor.is_admin ? (
              <ShieldOff className="size-4" />
            ) : (
              <Shield className="size-4" />
            )}
            {advisor.is_admin ? "Remove admin" : "Make admin"}
          </DropdownMenuItem>
        ) : null}
        {canToggleActive ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant={advisor.is_active ? "destructive" : "default"}
              disabled={busy}
              onClick={onToggleActive}
            >
              <UserMinus className="size-4" />
              {advisor.is_active ? "Deactivate" : "Reactivate"}
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function TeamWorkspace({
  currentAdvisorId,
  isAdmin,
  isSuperadmin,
}: {
  currentAdvisorId: string | null;
  isAdmin: boolean;
  isSuperadmin: boolean;
}) {
  const [advisors, setAdvisors] = useState<AdvisorListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState<SavingState>(null);
  const [adding, setAdding] = useState(false);
  // Set when a deactivation is refused, so the admin can pick who takes over.
  const [handover, setHandover] = useState<{
    advisor: AdvisorListRow;
    clientCount: number;
    toAdvisorId: string;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/advisors");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load the team");
      setAdvisors(data.advisors ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the team");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const activeAdvisors = advisors.filter((a) => a.is_active);
  const unassignedNotice = advisors.some((a) => !a.is_active && a.client_count > 0);

  async function addAdvisor(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setAdding(true);
    setError(null);
    setNotice(null);

    try {
      const res = await fetch("/api/advisors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: String(data.get("fullName") ?? "").trim(),
          email: String(data.get("email") ?? "").trim(),
          isAdmin: data.get("isAdmin") === "on",
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not add advisor");
      form.reset();
      setNotice(
        body.inviteError
          ? `${body.advisor.full_name} was added, but the invite email failed: ${body.inviteError}`
          : `Invitation sent to ${body.advisor.email}. They can sign in with a one-time code.`,
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add advisor");
    } finally {
      setAdding(false);
    }
  }

  async function sendInvite(advisor: AdvisorListRow) {
    setSaving({ id: advisor.id, action: "invite" });
    setError(null);
    setNotice(null);

    try {
      const res = await fetch(`/api/advisors/${advisor.id}/invite`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not send invitation");
      setNotice(body.message ?? `Invitation sent to ${advisor.email}`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send invitation");
    } finally {
      setSaving(null);
    }
  }

  async function patchAdvisor(
    advisor: AdvisorListRow,
    payload: Record<string, unknown>,
    action: TeamAction,
  ) {
    setSaving({ id: advisor.id, action });
    setError(null);
    setNotice(null);

    try {
      const res = await fetch(`/api/advisors/${advisor.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json();

      if (res.status === 409 && typeof body.clientCount === "number") {
        setHandover({
          advisor,
          clientCount: body.clientCount,
          toAdvisorId:
            activeAdvisors.find((a) => a.id !== advisor.id)?.id ?? "",
        });
        setError(body.error);
        return;
      }
      if (!res.ok) throw new Error(body.error ?? "Could not update advisor");

      setHandover(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update advisor");
    } finally {
      setSaving(null);
    }
  }

  async function confirmHandover() {
    if (!handover?.toAdvisorId) return;
    const target = advisors.find((a) => a.id === handover.toAdvisorId);
    await patchAdvisor(
      handover.advisor,
      {
        isActive: false,
        reassignToAdvisorId: handover.toAdvisorId,
      },
      "active",
    );
    setNotice(
      target
        ? `${handover.clientCount} client${handover.clientCount === 1 ? "" : "s"} moved to ${target.full_name}.`
        : null,
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <KpiStrip>
          <KpiItem label="Active advisors" value="" loading />
          <KpiItem label="Admins" value="" loading />
          <KpiItem label="Clients assigned" value="" loading />
          <KpiItem label="Team AUM" value="" loading />
        </KpiStrip>
        <DashCard>
          <DashCardHeader>
            <Skeleton className="h-5 w-32" />
            <Skeleton className="mt-2 h-3 w-56" />
          </DashCardHeader>
          <DashCardContent className="flex flex-col gap-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-16 w-full rounded-lg" />
            ))}
          </DashCardContent>
        </DashCard>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <KpiStrip>
        <KpiItem
          label="Active advisors"
          value={String(activeAdvisors.length)}
          change={`${advisors.length} on record`}
          trend="neutral"
        />
        <KpiItem
          label="Admins"
          value={String(advisors.filter((a) => a.is_admin && a.is_active).length)}
          change="Can manage the team"
          trend="neutral"
        />
        <KpiItem
          label="Clients assigned"
          value={String(advisors.reduce((sum, a) => sum + a.client_count, 0))}
          change={unassignedNotice ? "Some sit with inactive advisors" : "All with active advisors"}
          trend={unassignedNotice ? "down" : "up"}
        />
        <KpiItem
          label="Team AUM"
          value={formatUsd(advisors.reduce((sum, a) => sum + a.aum, 0))}
          change="Latest statement values"
          trend="neutral"
        />
      </KpiStrip>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {notice ? <p className="text-sm text-muted-foreground">{notice}</p> : null}

      {handover ? (
        <DashCard>
          <DashCardHeader>
            <div>
              <DashCardTitle>
                Move {handover.advisor.full_name}&apos;s clients
              </DashCardTitle>
              <DashCardDescription>
                {handover.clientCount} client
                {handover.clientCount === 1 ? "" : "s"} need a new advisor before this
                account can be deactivated.
              </DashCardDescription>
            </div>
          </DashCardHeader>
          <DashCardContent className="gap-4 sm:flex-row sm:items-end">
            <FieldGroup>
              <Label htmlFor="handoverTo">Reassign to</Label>
              <Select
                id="handoverTo"
                value={handover.toAdvisorId}
                onChange={(e) =>
                  setHandover({ ...handover, toAdvisorId: e.target.value })
                }
              >
                <option value="">Select an advisor</option>
                {activeAdvisors
                  .filter((a) => a.id !== handover.advisor.id)
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.full_name}
                    </option>
                  ))}
              </Select>
            </FieldGroup>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={confirmHandover}
                disabled={!handover.toAdvisorId || saving?.id === handover.advisor.id}
              >
                {saving?.id === handover.advisor.id ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : null}
                Move and deactivate
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setHandover(null);
                  setError(null);
                }}
              >
                Cancel
              </Button>
            </div>
          </DashCardContent>
        </DashCard>
      ) : null}

      <DashCard>
        <DashCardHeader>
          <div>
            <DashCardTitle>Wealth managers</DashCardTitle>
            <DashCardDescription>
              {advisors.length} on record. Admins manage the team and can reassign clients.
            </DashCardDescription>
          </div>
        </DashCardHeader>
        <DashCardContent className="gap-0 p-0">
          {advisors.map((advisor) => (
            <div
              key={advisor.id}
              className="flex flex-col gap-3 border-b border-border/60 px-6 py-4 last:border-0 sm:flex-row sm:items-center"
            >
              <Avatar size="sm">
                <AvatarFallback className="bg-muted text-xs font-medium">
                  {initials(advisor.full_name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <TextSmall className="font-medium">{advisor.full_name}</TextSmall>
                  {advisor.is_superadmin ? (
                    <Badge variant="secondary">
                      <Shield className="size-3" />
                      Superadmin
                    </Badge>
                  ) : advisor.is_admin ? (
                    <Badge variant="secondary">
                      <Shield className="size-3" />
                      Admin
                    </Badge>
                  ) : null}
                  {advisor.is_active ? null : <Badge variant="outline">Inactive</Badge>}
                  {advisor.id === currentAdvisorId ? (
                    <Badge variant="outline">You</Badge>
                  ) : null}
                </div>
                <Muted>
                  {advisor.email}
                  {advisor.title ? ` · ${advisor.title}` : ""}
                  {` · ${advisor.client_count} client${advisor.client_count === 1 ? "" : "s"}`}
                  {advisor.aum > 0 ? ` · ${formatUsd(advisor.aum)} AUM` : ""}
                  {` · ${portalStatusLabel(advisor)}`}
                </Muted>
              </div>
              <div className="flex shrink-0">
                <AdvisorRowMenu
                  advisor={advisor}
                  isAdmin={isAdmin}
                  isSuperadmin={isSuperadmin}
                  saving={saving}
                  onInvite={() => sendInvite(advisor)}
                  onToggleAdmin={() =>
                    patchAdvisor(advisor, { isAdmin: !advisor.is_admin }, "admin")
                  }
                  onToggleActive={() =>
                    patchAdvisor(advisor, { isActive: !advisor.is_active }, "active")
                  }
                />
              </div>
            </div>
          ))}
        </DashCardContent>
      </DashCard>

      <DashCard>
        <DashCardHeader>
          <div>
            <DashCardTitle>Add wealth manager</DashCardTitle>
            <DashCardDescription>
              Name and work email only. They receive an onboarding link by email.
            </DashCardDescription>
          </div>
        </DashCardHeader>
        <DashCardContent>
          <form onSubmit={addAdvisor} className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FieldGroup>
                <Label htmlFor="fullName">Full name</Label>
                <Input id="fullName" name="fullName" required placeholder="Full name" />
              </FieldGroup>
              <FieldGroup>
                <Label htmlFor="email">Work email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  required
                  placeholder="name@jagroup.com"
                />
              </FieldGroup>
            </div>
            {isSuperadmin ? (
              <label className="flex items-start gap-3 text-sm">
                <input type="checkbox" name="isAdmin" className="mt-1 size-4 accent-primary" />
                <span>Grant admin access (manage team and clients)</span>
              </label>
            ) : null}
            <Button type="submit" className="w-fit" disabled={adding}>
              {adding ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
              {adding ? "Sending invite..." : "Invite wealth manager"}
            </Button>
          </form>
        </DashCardContent>
      </DashCard>
    </div>
  );
}
