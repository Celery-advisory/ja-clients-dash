import { getJaPortfolioForClient } from "@/lib/api/domain/wealth-portfolio";
import { computeGoalsAnalytics } from "@/lib/data/goals-analytics";
import { getLegacyHealthOverview, legacyProfile } from "@/lib/data/legacy";
import { formatPct, formatUsd } from "@/lib/wealth/constants";
import { formatCountryName, formatRegionName } from "@/lib/wealth/countries";
import { clientGoalToGoal } from "@/lib/wealth/goals";
import {
  getAdvisorById,
  getClientAddress,
  getClientById,
  getClientGoals,
  getLatestPeriodForClient,
  getReportsForClient,
  getTransactionsForClient,
  getUpdatesForClient,
  listClientsWithPortfolio,
} from "@/lib/wealth/queries";
import type { SessionProfile, WealthClient } from "@/lib/wealth/types";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isClientId(value: string | undefined | null): value is string {
  return Boolean(value && UUID_RE.test(value));
}

export async function buildCelereyContext(options: {
  profile: SessionProfile;
  focusClientId?: string | null;
}): Promise<{ context: string; audience: "client" | "advisor" }> {
  const { profile, focusClientId } = options;
  const isAdvisor = profile.role === "advisor" || profile.role === "admin";

  if (!isAdvisor) {
    if (!profile.client_id) {
      return {
        audience: "client",
        context: "No client record is linked to this login.",
      };
    }
    const dossier = await buildClientDossier(profile.client_id, {
      includeAdvisorNotes: false,
    });
    return {
      audience: "client",
      context: dossier ?? "No client data is on file for this login.",
    };
  }

  const book = await listClientsWithPortfolio(null);
  const sections: string[] = [
    `Advisor: ${profile.full_name ?? profile.email} (${profile.role})`,
    formatBookSummary(book),
  ];

  const focusId = isClientId(focusClientId) ? focusClientId : null;
  if (focusId) {
    const focused = book.find((c) => c.id === focusId) ?? (await getClientById(focusId));
    if (focused) {
      const dossier = await buildClientDossier(focusId, { includeAdvisorNotes: true });
      if (dossier) {
        sections.push("## Focused client file\n" + dossier);
      }
    }
  } else {
    sections.push(await formatGoalsSection());
    sections.push(formatLegacySection());
  }

  return { audience: "advisor", context: sections.join("\n\n") };
}

function formatBookSummary(
  clients: Array<
    WealthClient & { aum: number; location: string | null }
  >,
): string {
  const totalAum = clients.reduce((sum, c) => sum + c.aum, 0);
  const lines = [
    `## Client book (${clients.length} clients, ${formatUsd(totalAum)} AUM)`,
  ];

  if (clients.length === 0) {
    lines.push("No clients are assigned yet.");
    return lines.join("\n");
  }

  for (const client of clients.slice(0, 50)) {
    const bits = [
      `${client.full_name} (${client.client_number})`,
      `status ${client.status}`,
      formatUsd(client.aum),
    ];
    if (client.risk_profile) bits.push(`risk ${client.risk_profile}`);
    if (client.estate_status) bits.push(`estate: ${client.estate_status}`);
    if (client.financial_goals) bits.push(`goals: ${client.financial_goals.slice(0, 140)}`);
    if (client.location) bits.push(client.location);
    lines.push(`- ${bits.join(" | ")}`);
  }

  return lines.join("\n");
}

async function buildClientDossier(
  clientId: string,
  options: { includeAdvisorNotes: boolean },
): Promise<string | null> {
  const client = await getClientById(clientId);
  if (!client) return null;

  const [address, period, portfolio, transactions, updates, reports, advisor] =
    await Promise.all([
      getClientAddress(clientId),
      getLatestPeriodForClient(clientId),
      getJaPortfolioForClient(clientId),
      getTransactionsForClient(clientId, 12),
      getUpdatesForClient(clientId, 8),
      // A client's own assistant must not know about reports still in draft.
      getReportsForClient(clientId, { publishedOnly: !options.includeAdvisorNotes }),
      client.advisor_id ? getAdvisorById(client.advisor_id) : Promise.resolve(null),
    ]);

  const lines: string[] = [
    `## ${client.full_name}`,
    `- Client reference: ${client.client_number}`,
    `- Status: ${client.status}`,
    `- Currency: ${client.currency}`,
  ];

  if (client.inception_date) lines.push(`- Inception: ${client.inception_date}`);
  if (client.date_of_birth) lines.push(`- Date of birth: ${client.date_of_birth}`);
  if (client.risk_profile) lines.push(`- Risk profile: ${client.risk_profile}`);
  if (client.investment_horizon) {
    lines.push(`- Investment horizon: ${client.investment_horizon}`);
  }
  if (client.primary_objective) {
    lines.push(`- Primary objective: ${client.primary_objective}`);
  }
  if (client.marital_status) lines.push(`- Marital status: ${client.marital_status}`);
  lines.push(`- Dependents: ${client.dependents}`);
  if (client.estate_status) lines.push(`- Estate status: ${client.estate_status}`);
  if (client.financial_goals) lines.push(`- Financial goals: ${client.financial_goals}`);
  if (advisor) lines.push(`- Assigned advisor: ${advisor.full_name}`);
  if (address) {
    const location = [
      address.line1,
      address.city,
      formatRegionName(address.country, address.region),
      formatCountryName(address.country),
    ]
      .filter(Boolean)
      .join(", ");
    lines.push(`- Address: ${location}`);
  }
  if (options.includeAdvisorNotes && client.advisor_notes) {
    lines.push(`- Advisor notes: ${client.advisor_notes}`);
  }

  if (portfolio) {
    lines.push("");
    lines.push(
      `### Portfolio${period ? ` (${period.label}, ${period.period_start} to ${period.period_end})` : ""}`,
    );
    lines.push(
      `- Total: ${formatUsd(portfolio.totalUSD)} | Period gain: ${formatUsd(portfolio.periodGainUsd, true)} (${formatPct(portfolio.periodReturnPct, true)}) | YTD: ${formatPct(portfolio.ytdPct, true)}`,
    );
    for (const bucket of portfolio.buckets) {
      lines.push(
        `- ${bucket.label}: ${formatUsd(bucket.totalUSD)} (${bucket.allocationPct.toFixed(1)}%) YTD ${formatPct(bucket.ytdPct, true)}`,
      );
    }
    if (portfolio.history.length > 0) {
      const recent = portfolio.history.slice(-8);
      lines.push(
        `- History: ${recent.map((p) => `${p.month} ${formatUsd(p.value)}`).join("; ")}`,
      );
    }
  } else {
    lines.push("");
    lines.push("### Portfolio");
    lines.push("- No statement snapshots on file yet.");
  }

  if (transactions.length > 0) {
    lines.push("");
    lines.push("### Recent transactions");
    for (const tx of transactions) {
      lines.push(
        `- ${tx.occurred_on} | ${tx.transaction_type} | ${formatUsd(tx.amount_usd, true)}${tx.bucket ? ` | ${tx.bucket}` : ""} | ${tx.description}`,
      );
    }
  }

  if (updates.length > 0) {
    lines.push("");
    lines.push("### Recent updates");
    for (const update of updates) {
      lines.push(`- ${update.created_at.slice(0, 10)} [${update.kind}] ${update.title}: ${update.body}`);
    }
  }

  if (reports.length > 0) {
    lines.push("");
    lines.push("### Reports");
    for (const report of reports.slice(0, 6)) {
      lines.push(
        `- ${report.title} (${report.reference}, ${report.generated_at.slice(0, 10)}, ${report.status})`,
      );
    }
  }

  lines.push("");
  lines.push(await formatGoalsSection(clientId));
  lines.push("");
  lines.push(formatLegacySection());

  return lines.join("\n");
}

async function formatGoalsSection(clientId?: string): Promise<string> {
  if (!clientId) {
    return [
      "### Financial goals",
      "- Structured goals (amounts and dates) live on each client Goals tab. Open a client file to review them.",
    ].join("\n");
  }

  const rows = await getClientGoals(clientId);
  const goals = rows.map(clientGoalToGoal);
  if (goals.length === 0) {
    return [
      "### Financial goals",
      "- No structured goals on file yet. The wealth manager adds target amounts and dates on the Goals tab.",
    ].join("\n");
  }

  const analytics = computeGoalsAnalytics(goals);
  const lines = [
    "### Financial goals",
    `- ${goals.length} goals | ${analytics.onTrackCount} on track | ${analytics.atRiskCount} at risk | ${analytics.inProgressCount} in progress | ${analytics.aheadCount} ahead`,
    `- Funded ${formatUsd(analytics.totalCurrentUSD)} of ${formatUsd(analytics.totalTargetUSD)} (${analytics.overallProgressPct}%). Gap ${formatUsd(analytics.totalGapUSD)}. Average probability ${analytics.avgProbabilityPct}%.`,
  ];

  for (const goal of goals) {
    const gap = Math.max(0, goal.targetUSD - goal.currentUSD);
    const fundedPct =
      goal.targetUSD > 0 ? Math.round((goal.currentUSD / goal.targetUSD) * 100) : 0;
    lines.push(
      `- ${goal.name} [${goal.status}] ${goal.category}: ${formatUsd(goal.currentUSD)} of ${formatUsd(goal.targetUSD)} (${fundedPct}%, gap ${formatUsd(gap)}), target ${goal.targetDate}, probability ${goal.probabilityPct}%`,
    );
    if (goal.advisorNote) {
      lines.push(`  Advisor note: ${goal.advisorNote}`);
    }
  }

  return lines.join("\n");
}

function formatLegacySection(): string {
  const health = getLegacyHealthOverview(legacyProfile);
  const lines = [
    "### Legacy and estate",
    `- Readiness ${health.readinessScorePct}% (${health.statusLabel})`,
    `- Will: ${legacyProfile.willStatus}, last updated ${legacyProfile.willLastUpdated}, solicitor ${legacyProfile.willSolicitor}`,
    `- Power of attorney: ${legacyProfile.powerOfAttorney}, holder ${legacyProfile.poaHolder}`,
  ];

  for (const dependent of legacyProfile.dependents) {
    lines.push(
      `- Dependent: ${dependent.name} (${dependent.relation}, born ${dependent.dateOfBirth})${dependent.guardian ? `, guardian ${dependent.guardian}` : ""}`,
    );
  }
  for (const beneficiary of legacyProfile.beneficiaries) {
    lines.push(
      `- Beneficiary: ${beneficiary.name} (${beneficiary.relation}) ${beneficiary.allocationPct}% via ${beneficiary.instrument}`,
    );
  }
  for (const trust of legacyProfile.trustStructures) {
    lines.push(
      `- Trust: ${trust.name} (${trust.type}, ${trust.status}) ${formatUsd(trust.estimatedValueUSD)}, formed ${trust.jurisdictionFormed} ${trust.established}. Beneficiaries: ${trust.beneficiaries.join(", ")}`,
    );
  }
  for (const milestone of legacyProfile.successionMilestones) {
    lines.push(`- Milestone [${milestone.status}]: ${milestone.title} (${milestone.targetDate})`);
  }
  if (health.risks.length > 0) {
    lines.push(`- Risks: ${health.risks.join(" ")}`);
  }
  if (health.missingItems.length > 0) {
    lines.push(`- Missing: ${health.missingItems.join("; ")}`);
  }
  if (legacyProfile.advisorNote) {
    lines.push(`- Advisor note: ${legacyProfile.advisorNote}`);
  }

  return lines.join("\n");
}
