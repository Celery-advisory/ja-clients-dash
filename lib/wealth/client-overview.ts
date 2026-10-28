import { getClientReports, type ReportDoc } from "@/lib/api/domain/reports";
import { getJaPortfolioForClient } from "@/lib/api/domain/wealth-portfolio";
import { clientGoalToGoal } from "@/lib/wealth/goals";
import {
  getClientById,
  getClientGoals,
  getStatementPeriodsForClient,
  getUpdatesForClient,
} from "@/lib/wealth/queries";
import type { DocumentRequest, WmSession } from "@/lib/wealth/wm-types";
import {
  getFirstPendingDocumentRequest,
  getNextSessionForClient,
} from "@/lib/wealth/wm-queries";
import type { Goal } from "@/lib/data/goals";

export type ClientOverviewData = {
  clientName: string;
  portfolioLastUpdated: string | null;
  portfolio: {
    totalUSD: number;
    periodGainUsd: number;
    periodReturnPct: number;
    ytdPct: number;
    hasData: boolean;
  } | null;
  latestUpdate: {
    id: string;
    title: string;
    body: string;
    createdAt: string;
  } | null;
  nextSession: WmSession | null;
  pendingDocumentRequest: DocumentRequest | null;
  primaryGoal: Goal | null;
  latestReport: ReportDoc | null;
};

export async function getClientOverviewData(
  clientId: string,
): Promise<ClientOverviewData | null> {
  const client = await getClientById(clientId);
  if (!client) return null;

  const periodsPromise = getStatementPeriodsForClient(clientId);
  const [
    periods,
    portfolio,
    updates,
    nextSession,
    pendingDocumentRequest,
    goals,
    reports,
  ] = await Promise.all([
    periodsPromise,
    periodsPromise.then((p) => getJaPortfolioForClient(clientId, p)),
    getUpdatesForClient(clientId, 1),
    getNextSessionForClient(clientId),
    getFirstPendingDocumentRequest(clientId),
    getClientGoals(clientId),
    getClientReports(clientId, { forClient: true }),
  ]);

  const portfolioLastUpdated = periods[0]?.period_end
    ? new Date(`${periods[0].period_end}T12:00:00`).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  const primaryGoalRow = goals[0];
  const latestUpdate = updates[0];
  const latestReport = reports[0];

  return {
    clientName: client.full_name,
    portfolioLastUpdated,
    portfolio: portfolio
      ? {
          totalUSD: portfolio.totalUSD,
          periodGainUsd: portfolio.periodGainUsd,
          periodReturnPct: portfolio.periodReturnPct,
          ytdPct: portfolio.ytdPct,
          hasData: portfolio.totalUSD > 0,
        }
      : null,
    latestUpdate: latestUpdate
      ? {
          id: latestUpdate.id,
          title: latestUpdate.title,
          body: latestUpdate.body,
          createdAt: latestUpdate.created_at,
        }
      : null,
    nextSession,
    pendingDocumentRequest,
    primaryGoal: primaryGoalRow ? clientGoalToGoal(primaryGoalRow) : null,
    latestReport: latestReport ?? null,
  };
}
