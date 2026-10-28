import { ClientContactActions } from "@/components/clients/client-contact-actions";
import { ClientReportsList, LatestReportHero } from "@/components/clients/client-reports-view";
import { PageShell } from "@/components/layout/page-shell";
import { ClientEmptyState } from "@/components/ui/empty-state";
import { H1, Muted } from "@/components/ui/typography";
import { getClientReports } from "@/lib/api/domain/reports";
import { requireClient } from "@/lib/wealth/session";

export default async function ClientReportsPage() {
  const session = await requireClient();
  const clientId = session.profile.client_id;
  const reports = clientId ? await getClientReports(clientId, { forClient: true }) : [];
  const [latest, ...earlier] = reports;

  return (
    <PageShell className="flex flex-col gap-(--spacing-section)">
      <header className="flex flex-col gap-1">
        <H1>Reports</H1>
        <Muted>Your statements from your wealth manager, newest first.</Muted>
      </header>

      {latest ? (
        <>
          <LatestReportHero report={latest} />
          {earlier.length > 0 ? (
            <section className="flex flex-col gap-2">
              <h2 className="text-sm font-medium">Earlier reports</h2>
              <ClientReportsList reports={earlier} />
            </section>
          ) : null}
        </>
      ) : (
        <div className="rounded-xl border border-border/40 bg-card">
          <ClientEmptyState
            variant="documents"
            layout="inline"
            title="No reports yet"
            description="Your wealth manager will publish your first report here, and we will email you when it is ready."
            action={<ClientContactActions />}
          />
        </div>
      )}
    </PageShell>
  );
}
