"use client";

import { useEffect, useState } from "react";

import {
  AdvisorPageHeader,
  SurfaceCard,
  advisorSurface,
} from "@/components/advisors/advisor-surface";
import { PageShell } from "@/components/layout/page-shell";
import { AdvisorReportsList } from "@/components/reports/advisor-reports-list";
import { CoverImagePicker } from "@/components/reports/cover-image-picker";
import { GenerateReportButton } from "@/components/reports/generate-report-button";
import { GenerateReportsGuide } from "@/components/reports/generate-reports-guide";
import { OutstandingReportsNotice } from "@/components/reports/outstanding-reports-notice";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Muted, TextSmall } from "@/components/ui/typography";

export default function AdvisorReportsPage() {
  const [clientOptions, setClientOptions] = useState<{ id: string; name: string }[]>([]);
  const [clientId, setClientId] = useState("");
  const [coverImageId, setCoverImageId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    fetch("/api/me")
      .then((res) => res.json())
      .then((data) => setIsAdmin(data.role === "admin"))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    fetch("/api/clients")
      .then((res) => res.json())
      .then((data) =>
        setClientOptions(
          (data.clients ?? []).map((c: { id: string; full_name: string }) => ({
            id: c.id,
            name: c.full_name,
          })),
        ),
      )
      .catch(() => undefined);
  }, []);

  return (
    <PageShell className={advisorSurface.pageGap}>
      <AdvisorPageHeader
        title="Reports"
        description="Generate a report, check the draft, then publish. Clients only see a report after you publish it."
      />

      <OutstandingReportsNotice />

      <SurfaceCard>
        <div className="mb-3">
          <TextSmall className="font-semibold">Generate a statement</TextSmall>
          <Muted className="text-[12px]">
            Choose a client and a cover, then generate. The report is saved as a draft for you to check.
          </Muted>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-64 flex-1">
            <Label htmlFor="report-client">Client</Label>
            <Select
              id="report-client"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
            >
              <option value="">Select a client</option>
              {clientOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
          <GenerateReportButton clientId={clientId} coverImageId={coverImageId} />
        </div>
        <div className="mt-5 border-t border-border/70 pt-4">
          <CoverImagePicker
            value={coverImageId}
            onChange={setCoverImageId}
            canManage={isAdmin}
          />
        </div>
      </SurfaceCard>

      <AdvisorReportsList />
      <GenerateReportsGuide />
    </PageShell>
  );
}
