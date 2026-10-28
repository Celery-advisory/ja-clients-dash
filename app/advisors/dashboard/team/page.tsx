import { AdvisorPageHeader, advisorSurface } from "@/components/advisors/advisor-surface";
import { TeamWorkspace } from "@/components/advisors/team-workspace";
import { PageShell } from "@/components/layout/page-shell";
import { requireAdvisor } from "@/lib/wealth/session";

export default async function AdvisorTeamPage() {
  const session = await requireAdvisor();

  return (
    <PageShell className={advisorSurface.pageGap}>
      <AdvisorPageHeader
        title="Team"
        description="Advisors, wealth managers, and who looks after which client"
      />
      <TeamWorkspace
        currentAdvisorId={session.profile.advisor_id}
        isAdmin={session.profile.role === "admin"}
        isSuperadmin={session.profile.is_superadmin}
      />
    </PageShell>
  );
}
