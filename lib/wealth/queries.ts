import { queryDb } from "@/lib/supabase/db";
import type {
  AdvisorListRow,
  ClientAddress,
  ClientGoal,
  ClientListRow,
  ClientStatus,
  ClientUpdate,
  GoalStatus,
  PortfolioBucket,
  PortfolioHistoryPoint,
  PortfolioHolding,
  PortfolioSnapshot,
  SessionProfile,
  StatementPeriod,
  TransactionType,
  UpdateKind,
  UserRole,
  WealthAdvisor,
  WealthClient,
  WealthDisclaimer,
  WealthReport,
  WealthTransaction,
} from "@/lib/wealth/types";
import { CLIENT_SELECT } from "@/lib/wealth/types";
import type { GoalWriteInput } from "@/lib/wealth/goals";

function mapClient(row: WealthClient): WealthClient {
  return {
    ...row,
    dependents: Number(row.dependents ?? 0),
    status: (row.status as ClientStatus) ?? "onboarding",
  };
}

function mapSnapshot(
  r: PortfolioSnapshot & { previous_value_usd: string | number; current_value_usd: string | number },
): PortfolioSnapshot {
  return {
    ...r,
    previous_value_usd: Number(r.previous_value_usd),
    current_value_usd: Number(r.current_value_usd),
    period_change_pct: r.period_change_pct != null ? Number(r.period_change_pct) : null,
    ytd_pct: r.ytd_pct != null ? Number(r.ytd_pct) : null,
    inception_gain_usd: r.inception_gain_usd != null ? Number(r.inception_gain_usd) : null,
    inception_pct: r.inception_pct != null ? Number(r.inception_pct) : null,
    annualized_return_pct:
      r.annualized_return_pct != null ? Number(r.annualized_return_pct) : null,
  };
}

const ADVISOR_SELECT = `id, full_name, email, title, phone, is_admin, is_superadmin, is_active,
                        auth_user_id, invited_at::text, bio, timezone, availability_notes,
                        onboarding_completed_at::text, notify_sessions, notify_documents,
                        notify_messages, created_at::text`;

export async function listAdvisorsWithStats(): Promise<AdvisorListRow[]> {
  const rows = await queryDb<
    WealthAdvisor & { client_count: string; aum: string }
  >(
    `WITH latest_period AS (
       SELECT DISTINCT ON (client_id) id, client_id
       FROM wealth.statement_periods
       ORDER BY client_id, period_end DESC
     ),
     client_aum AS (
       SELECT c.id, c.advisor_id, COALESCE(SUM(s.current_value_usd), 0) AS aum
       FROM wealth.clients c
       LEFT JOIN latest_period lp ON lp.client_id = c.id
       LEFT JOIN wealth.portfolio_snapshots s ON s.period_id = lp.id
       GROUP BY c.id, c.advisor_id
     )
     SELECT a.id, a.full_name, a.email, a.title, a.phone, a.is_admin, a.is_superadmin, a.is_active,
            a.auth_user_id, a.invited_at::text, a.onboarding_completed_at::text, a.created_at::text,
            COUNT(ca.id)::int AS client_count,
            COALESCE(SUM(ca.aum), 0)::float8 AS aum
     FROM wealth.advisors a
     LEFT JOIN client_aum ca ON ca.advisor_id = a.id
     GROUP BY a.id
     ORDER BY a.is_active DESC, a.full_name ASC`,
  );
  return rows.map((r) => ({
    ...r,
    client_count: Number(r.client_count),
    aum: Number(r.aum),
  }));
}

export async function getAdvisorById(
  advisorId: string,
): Promise<WealthAdvisor | null> {
  const rows = await queryDb<WealthAdvisor>(
    `SELECT ${ADVISOR_SELECT} FROM wealth.advisors WHERE id = $1`,
    [advisorId],
  );
  return rows[0] ?? null;
}

export async function createAdvisor(input: {
  fullName: string;
  email: string;
  title?: string | null;
  phone?: string | null;
  isAdmin?: boolean;
}): Promise<WealthAdvisor> {
  const rows = await queryDb<WealthAdvisor>(
    `INSERT INTO wealth.advisors (full_name, email, title, phone, is_admin)
     VALUES ($1, lower($2), $3, $4, $5)
     RETURNING ${ADVISOR_SELECT}`,
    [
      input.fullName,
      input.email,
      input.title ?? "Wealth Manager",
      input.phone ?? null,
      input.isAdmin ?? false,
    ],
  );
  return rows[0];
}

export type AdvisorUpdate = {
  full_name?: string;
  email?: string;
  title?: string | null;
  phone?: string | null;
  bio?: string | null;
  timezone?: string | null;
  availability_notes?: string | null;
  onboarding_completed_at?: string | null;
  is_admin?: boolean;
  is_active?: boolean;
  notify_sessions?: string;
  notify_documents?: string;
  notify_messages?: string;
};

// Built from the keys actually supplied so a caller can clear a title or phone,
// which a COALESCE based update cannot express.
export async function updateAdvisorFields(
  advisorId: string,
  fields: AdvisorUpdate,
): Promise<WealthAdvisor | null> {
  const columns: Array<keyof AdvisorUpdate> = [
    "full_name",
    "email",
    "title",
    "phone",
    "bio",
    "timezone",
    "availability_notes",
    "onboarding_completed_at",
    "is_admin",
    "is_active",
    "notify_sessions",
    "notify_documents",
    "notify_messages",
  ];
  const provided = columns.filter((c) => fields[c] !== undefined);

  if (provided.length === 0) {
    return getAdvisorById(advisorId);
  }

  const assignments = provided.map(
    (column, i) => `${column} = $${i + 2}`,
  );
  const values = provided.map((column) =>
    column === "email" && typeof fields.email === "string"
      ? fields.email.trim().toLowerCase()
      : fields[column],
  );

  const rows = await queryDb<WealthAdvisor>(
    `UPDATE wealth.advisors SET ${assignments.join(", ")}
     WHERE id = $1
     RETURNING ${ADVISOR_SELECT}`,
    [advisorId, ...values],
  );
  return rows[0] ?? null;
}

export async function countActiveAdmins(excludeAdvisorId?: string): Promise<number> {
  const rows = await queryDb<{ count: string }>(
    `SELECT COUNT(*)::int AS count FROM wealth.advisors
     WHERE is_admin = true AND is_active = true
       AND ($1::uuid IS NULL OR id <> $1)`,
    [excludeAdvisorId ?? null],
  );
  return Number(rows[0]?.count ?? 0);
}

export async function countClientsForAdvisor(advisorId: string): Promise<number> {
  const rows = await queryDb<{ count: string }>(
    `SELECT COUNT(*)::int AS count FROM wealth.clients WHERE advisor_id = $1`,
    [advisorId],
  );
  return Number(rows[0]?.count ?? 0);
}

export async function setClientAdvisor(
  clientId: string,
  advisorId: string | null,
): Promise<WealthClient | null> {
  const rows = await queryDb<WealthClient>(
    `UPDATE wealth.clients SET advisor_id = $2
     WHERE id = $1
     RETURNING ${CLIENT_SELECT}`,
    [clientId, advisorId],
  );
  if (rows[0]) {
    await queryDb(
      `UPDATE wealth.message_threads SET advisor_id = $2, updated_at = now()
       WHERE client_id = $1`,
      [clientId, advisorId],
    );
    await queryDb(
      `UPDATE wealth.document_requests SET advisor_id = $2, updated_at = now()
       WHERE client_id = $1 AND status = 'pending'`,
      [clientId, advisorId],
    );
    await queryDb(
      `UPDATE wealth.session_requests SET advisor_id = $2
       WHERE client_id = $1 AND status = 'pending'`,
      [clientId, advisorId],
    );
  }
  return rows[0] ? mapClient(rows[0]) : null;
}

export async function bulkSetClientAdvisor(
  clientIds: string[],
  advisorId: string | null,
): Promise<number> {
  if (clientIds.length === 0) return 0;
  let count = 0;
  for (const clientId of clientIds) {
    const updated = await setClientAdvisor(clientId, advisorId);
    if (updated) count += 1;
  }
  return count;
}

/** Moves every client of one advisor to another, used when deactivating someone. */
export async function reassignAdvisorClients(
  fromAdvisorId: string,
  toAdvisorId: string | null,
): Promise<number> {
  const rows = await queryDb<{ id: string }>(
    `SELECT id FROM wealth.clients WHERE advisor_id = $1`,
    [fromAdvisorId],
  );
  let count = 0;
  for (const row of rows) {
    const updated = await setClientAdvisor(row.id, toAdvisorId);
    if (updated) count += 1;
  }
  return count;
}

export async function getClientById(clientId: string): Promise<WealthClient | null> {
  const rows = await queryDb<WealthClient>(
    `SELECT ${CLIENT_SELECT} FROM wealth.clients WHERE id = $1`,
    [clientId],
  );
  return rows[0] ? mapClient(rows[0]) : null;
}

export async function getClientByEmail(email: string): Promise<WealthClient | null> {
  const rows = await queryDb<WealthClient>(
    `SELECT ${CLIENT_SELECT} FROM wealth.clients WHERE lower(email) = lower($1) LIMIT 1`,
    [email],
  );
  return rows[0] ? mapClient(rows[0]) : null;
}

export async function getClientAddress(clientId: string): Promise<ClientAddress | null> {
  const rows = await queryDb<ClientAddress>(
    `SELECT line1, line2, city, region, postal_code, country
     FROM wealth.client_addresses
     WHERE client_id = $1 AND is_primary = true
     LIMIT 1`,
    [clientId],
  );
  return rows[0] ?? null;
}

export async function upsertClientAddress(
  clientId: string,
  address: ClientAddress,
): Promise<void> {
  await queryDb(
    `UPDATE wealth.client_addresses
     SET line1 = $2, line2 = $3, city = $4, region = $5, postal_code = $6, country = $7
     WHERE client_id = $1 AND is_primary = true`,
    [
      clientId,
      address.line1,
      address.line2,
      address.city,
      address.region,
      address.postal_code,
      address.country,
    ],
  );
  const existing = await queryDb<{ id: string }>(
    `SELECT id FROM wealth.client_addresses WHERE client_id = $1 AND is_primary = true LIMIT 1`,
    [clientId],
  );
  if (existing[0]) return;

  await queryDb(
    `INSERT INTO wealth.client_addresses (
      client_id, line1, line2, city, region, postal_code, country, is_primary
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, true)`,
    [
      clientId,
      address.line1,
      address.line2,
      address.city,
      address.region,
      address.postal_code,
      address.country,
    ],
  );
}

export async function getStatementPeriod(periodId: string): Promise<StatementPeriod | null> {
  const rows = await queryDb<StatementPeriod>(
    `SELECT id, client_id, period_start::text, period_end::text, label
     FROM wealth.statement_periods WHERE id = $1`,
    [periodId],
  );
  return rows[0] ?? null;
}

export async function getStatementPeriodsForClient(
  clientId: string,
): Promise<StatementPeriod[]> {
  return queryDb<StatementPeriod>(
    `SELECT id, client_id, period_start::text, period_end::text, label
     FROM wealth.statement_periods
     WHERE client_id = $1
     ORDER BY period_end DESC`,
    [clientId],
  );
}

export async function getLatestPeriodForClient(
  clientId: string,
): Promise<StatementPeriod | null> {
  const periods = await getStatementPeriodsForClient(clientId);
  return periods[0] ?? null;
}

export async function getPeriodEndingBefore(
  clientId: string,
  beforeDate: string,
): Promise<StatementPeriod | null> {
  const rows = await queryDb<StatementPeriod>(
    `SELECT id, client_id, period_start::text, period_end::text, label
     FROM wealth.statement_periods
     WHERE client_id = $1 AND period_end < $2::date
     ORDER BY period_end DESC
     LIMIT 1`,
    [clientId, beforeDate],
  );
  return rows[0] ?? null;
}

export async function getPortfolioSnapshots(
  clientId: string,
  periodId: string,
): Promise<PortfolioSnapshot[]> {
  const rows = await queryDb<PortfolioSnapshot & { previous_value_usd: string; current_value_usd: string }>(
    `SELECT id, client_id, period_id, bucket,
            previous_value_usd::float8, current_value_usd::float8,
            period_change_pct::float8, ytd_pct::float8,
            inception_gain_usd::float8, inception_pct::float8,
            annualized_return_pct::float8
     FROM wealth.portfolio_snapshots
     WHERE client_id = $1 AND period_id = $2
     ORDER BY bucket`,
    [clientId, periodId],
  );
  return rows.map(mapSnapshot);
}

export async function getPortfolioSnapshotsForPeriods(
  clientId: string,
  periodIds: string[],
): Promise<PortfolioSnapshot[]> {
  if (periodIds.length === 0) return [];
  const rows = await queryDb<PortfolioSnapshot & { previous_value_usd: string; current_value_usd: string }>(
    `SELECT id, client_id, period_id, bucket,
            previous_value_usd::float8, current_value_usd::float8,
            period_change_pct::float8, ytd_pct::float8,
            inception_gain_usd::float8, inception_pct::float8,
            annualized_return_pct::float8
     FROM wealth.portfolio_snapshots
     WHERE client_id = $1 AND period_id = ANY($2::uuid[])
     ORDER BY period_id, bucket`,
    [clientId, periodIds],
  );
  return rows.map(mapSnapshot);
}

function mapHolding(
  row: PortfolioHolding & {
    quantity: string | number | null;
    original_value_usd: string | number;
    market_value_usd: string | number;
  },
): PortfolioHolding {
  return {
    ...row,
    quantity: row.quantity == null ? null : Number(row.quantity),
    original_value_usd: Number(row.original_value_usd),
    market_value_usd: Number(row.market_value_usd),
  };
}

const HOLDING_COLUMNS = `id, client_id, period_id, bucket, investment_name, ticker,
            quantity::float8, original_value_usd::float8, market_value_usd::float8, sort_order`;

/** Period-specific rows win; otherwise client-level rows (period_id IS NULL) apply. */
export async function getPortfolioHoldings(
  clientId: string,
  periodId: string,
): Promise<PortfolioHolding[]> {
  const rows = await queryDb<
    PortfolioHolding & {
      quantity: string | null;
      original_value_usd: string;
      market_value_usd: string;
    }
  >(
    `SELECT ${HOLDING_COLUMNS}
     FROM wealth.portfolio_holdings
     WHERE client_id = $1
       AND (period_id = $2 OR period_id IS NULL)
     ORDER BY bucket, sort_order, investment_name`,
    [clientId, periodId],
  );

  const periodSpecific = rows.filter((row) => row.period_id === periodId);
  if (periodSpecific.length > 0) {
    return periodSpecific.map(mapHolding);
  }

  return rows.filter((row) => row.period_id == null).map(mapHolding);
}

export async function getCurrentPortfolioHoldings(clientId: string): Promise<PortfolioHolding[]> {
  const period = await getLatestPeriodForClient(clientId);
  if (period) return getPortfolioHoldings(clientId, period.id);

  const rows = await queryDb<
    PortfolioHolding & {
      quantity: string | null;
      original_value_usd: string;
      market_value_usd: string;
    }
  >(
    `SELECT ${HOLDING_COLUMNS}
     FROM wealth.portfolio_holdings
     WHERE client_id = $1 AND period_id IS NULL
     ORDER BY bucket, sort_order, investment_name`,
    [clientId],
  );
  return rows.map(mapHolding);
}

export async function replacePortfolioHoldings(
  clientId: string,
  periodId: string,
  rows: Array<{
    bucket: PortfolioBucket;
    investment_name: string;
    ticker: string;
    quantity: number | null;
    original_value_usd: number;
    market_value_usd: number;
  }>,
): Promise<PortfolioHolding[]> {
  await queryDb(
    `DELETE FROM wealth.portfolio_holdings WHERE client_id = $1 AND period_id = $2`,
    [clientId, periodId],
  );

  const inserted: PortfolioHolding[] = [];
  for (let index = 0; index < rows.length; index++) {
    const row = rows[index];
    const result = await queryDb<
      PortfolioHolding & {
        quantity: string | null;
        original_value_usd: string;
        market_value_usd: string;
      }
    >(
      `INSERT INTO wealth.portfolio_holdings (
        client_id, period_id, bucket, investment_name, ticker, quantity,
        original_value_usd, market_value_usd, sort_order
      ) VALUES ($1, $2, $3::wealth.portfolio_bucket, $4, $5, $6, $7, $8, $9)
      RETURNING ${HOLDING_COLUMNS}`,
      [
        clientId,
        periodId,
        row.bucket,
        row.investment_name.trim(),
        row.ticker.trim(),
        row.quantity,
        row.original_value_usd,
        row.market_value_usd,
        index + 1,
      ],
    );
    if (result[0]) inserted.push(mapHolding(result[0]));
  }

  return inserted;
}

/** Add a priced holding, or update quantity when the same ticker is already in that bucket. */
export async function saveTrackedHolding(
  clientId: string,
  input: {
    bucket: PortfolioBucket;
    investment_name: string;
    ticker: string;
    quantity: number;
    market_value_usd: number | null;
    original_value_usd?: number | null;
  },
): Promise<{ holding: PortfolioHolding; updated: boolean }> {
  const period = await getLatestPeriodForClient(clientId);
  const current = period
    ? await getPortfolioHoldings(clientId, period.id)
    : await getCurrentPortfolioHoldings(clientId);
  const periodId = current.length > 0 ? current[0].period_id : (period?.id ?? null);
  const ticker = input.ticker.trim().toUpperCase();
  const match = current.find(
    (row) => row.ticker.trim().toUpperCase() === ticker && row.bucket === input.bucket,
  );

  if (match) {
    const rows = await queryDb<
      PortfolioHolding & {
        quantity: string | null;
        original_value_usd: string;
        market_value_usd: string;
      }
    >(
      `UPDATE wealth.portfolio_holdings
       SET quantity = $2,
           market_value_usd = COALESCE($3, market_value_usd),
           investment_name = $4,
           original_value_usd = COALESCE($6, original_value_usd)
       WHERE id = $1 AND client_id = $5
       RETURNING ${HOLDING_COLUMNS}`,
      [
        match.id,
        input.quantity,
        input.market_value_usd,
        input.investment_name.trim(),
        clientId,
        input.original_value_usd ?? null,
      ],
    );
    if (!rows[0]) throw new Error("Could not update holding");
    return { holding: mapHolding(rows[0]), updated: true };
  }

  const rows = await queryDb<
    PortfolioHolding & {
      quantity: string | null;
      original_value_usd: string;
      market_value_usd: string;
    }
  >(
    `INSERT INTO wealth.portfolio_holdings (
      client_id, period_id, bucket, investment_name, ticker, quantity,
      original_value_usd, market_value_usd, sort_order
    ) VALUES ($1, $2, $3::wealth.portfolio_bucket, $4, $5, $6, $7, $8, $9)
    RETURNING ${HOLDING_COLUMNS}`,
    [
      clientId,
      periodId,
      input.bucket,
      input.investment_name.trim(),
      ticker,
      input.quantity,
      input.original_value_usd ?? 0,
      input.market_value_usd ?? 0,
      current.length + 1,
    ],
  );
  if (!rows[0]) throw new Error("Could not save holding");
  return { holding: mapHolding(rows[0]), updated: false };
}

export async function getPortfolioHistory(
  clientId: string,
): Promise<PortfolioHistoryPoint[]> {
  const rows = await queryDb<{ recorded_on: string; total_value_usd: string }>(
    `SELECT recorded_on::text, total_value_usd::float8
     FROM wealth.portfolio_history
     WHERE client_id = $1
     ORDER BY recorded_on ASC`,
    [clientId],
  );
  return rows.map((r) => ({
    recorded_on: r.recorded_on,
    total_value_usd: Number(r.total_value_usd),
  }));
}

export async function getTransactionsForPeriod(
  clientId: string,
  periodStart: string,
  periodEnd: string,
): Promise<WealthTransaction[]> {
  const rows = await queryDb<WealthTransaction & { amount_usd: string }>(
    `SELECT DISTINCT ON (occurred_on, amount_usd, description)
            id, client_id, bucket, occurred_on::text, amount_usd::float8,
            description, transaction_type
     FROM wealth.transactions
     WHERE client_id = $1
       AND occurred_on >= $2::date
       AND occurred_on <= $3::date
     ORDER BY occurred_on, amount_usd, description, created_at DESC`,
    [clientId, periodStart, periodEnd],
  );
  return rows
    .map((r) => ({ ...r, amount_usd: Number(r.amount_usd) }))
    .sort((a, b) => b.occurred_on.localeCompare(a.occurred_on));
}

export async function getTransactionsForClient(
  clientId: string,
  limit = 50,
): Promise<WealthTransaction[]> {
  const result = await getTransactionsPage(clientId, { pageSize: limit });
  return result.transactions;
}

export type TransactionsPageResult = {
  transactions: WealthTransaction[];
  total: number;
  page: number;
  pageSize: number;
};

export async function getTransactionsPage(
  clientId: string,
  options: {
    periodStart?: string;
    periodEnd?: string;
    page?: number;
    pageSize?: number;
  } = {},
): Promise<TransactionsPageResult> {
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, options.pageSize ?? 10));
  const offset = (page - 1) * pageSize;

  const conditions = ["client_id = $1"];
  const params: unknown[] = [clientId];
  let paramIndex = 2;

  if (options.periodStart && options.periodEnd) {
    conditions.push(`occurred_on >= $${paramIndex}::date`);
    params.push(options.periodStart);
    paramIndex += 1;
    conditions.push(`occurred_on <= $${paramIndex}::date`);
    params.push(options.periodEnd);
    paramIndex += 1;
  }

  const where = conditions.join(" AND ");

  const countRows = await queryDb<{ count: number }>(
    `SELECT COUNT(*)::int AS count FROM wealth.transactions WHERE ${where}`,
    params,
  );
  const total = Number(countRows[0]?.count ?? 0);

  const rows = await queryDb<WealthTransaction & { amount_usd: string }>(
    `SELECT id, client_id, bucket, occurred_on::text, amount_usd::float8,
            description, transaction_type
     FROM wealth.transactions
     WHERE ${where}
     ORDER BY occurred_on DESC, created_at DESC
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    [...params, pageSize, offset],
  );

  return {
    transactions: rows.map((r) => ({ ...r, amount_usd: Number(r.amount_usd) })),
    total,
    page,
    pageSize,
  };
}

export async function getActiveDisclaimer(): Promise<WealthDisclaimer | null> {
  const rows = await queryDb<WealthDisclaimer>(
    `SELECT version, title, body
     FROM wealth.disclaimers
     WHERE is_active = true
     ORDER BY created_at DESC
     LIMIT 1`,
  );
  return rows[0] ?? null;
}

const REPORT_COLUMNS = `id, client_id, period_id, reference, title,
  generated_at::text, storage_path, file_size_bytes, status::text, sections, template_key,
  sent_at::text, cover_image_id, published_at::text, summary,
  first_viewed_at::text, last_viewed_at::text, view_count`;

/** Clients only ever see published reports; staff see drafts too. */
export async function getReportsForClient(
  clientId: string,
  options?: { publishedOnly?: boolean },
): Promise<WealthReport[]> {
  return queryDb<WealthReport>(
    `SELECT ${REPORT_COLUMNS}
     FROM wealth.reports
     WHERE client_id = $1
       AND ($2::boolean IS NOT TRUE OR status = 'published')
     ORDER BY generated_at DESC`,
    [clientId, options?.publishedOnly ?? false],
  );
}

export async function getReportById(reportId: string): Promise<WealthReport | null> {
  const rows = await queryDb<WealthReport>(
    `SELECT ${REPORT_COLUMNS} FROM wealth.reports WHERE id = $1`,
    [reportId],
  );
  return rows[0] ?? null;
}

/**
 * Saves a generated report as a draft. Regenerating a report that was already
 * published takes it back to draft, so the new file is reviewed before the client sees it.
 */
export async function insertReport(row: {
  clientId: string;
  periodId: string;
  reference: string;
  title: string;
  storagePath: string;
  fileSizeBytes: number;
  generatedBy?: string | null;
  templateKey?: string | null;
  sections?: string[] | null;
  coverImageId?: string | null;
  summary?: unknown;
}): Promise<WealthReport> {
  const rows = await queryDb<WealthReport>(
    `INSERT INTO wealth.reports (
      client_id, period_id, reference, title, storage_path, file_size_bytes,
      generated_by, template_key, sections, cover_image_id, summary, status
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11::jsonb, 'draft')
    ON CONFLICT (client_id, period_id, reference) DO UPDATE SET
      title = EXCLUDED.title,
      storage_path = EXCLUDED.storage_path,
      file_size_bytes = EXCLUDED.file_size_bytes,
      generated_by = EXCLUDED.generated_by,
      template_key = EXCLUDED.template_key,
      sections = EXCLUDED.sections,
      cover_image_id = EXCLUDED.cover_image_id,
      summary = EXCLUDED.summary,
      generated_at = now(),
      status = 'draft',
      published_at = NULL,
      published_by = NULL,
      sent_at = NULL
    RETURNING ${REPORT_COLUMNS}`,
    [
      row.clientId,
      row.periodId,
      row.reference,
      row.title,
      row.storagePath,
      row.fileSizeBytes,
      row.generatedBy ?? null,
      row.templateKey ?? null,
      row.sections ? JSON.stringify(row.sections) : null,
      row.coverImageId ?? null,
      row.summary ? JSON.stringify(row.summary) : null,
    ],
  );
  return rows[0];
}

/** Publishes a draft. Returns null when the report is missing or already published. */
export async function publishReport(reportId: string, userId: string): Promise<WealthReport | null> {
  const rows = await queryDb<WealthReport>(
    `UPDATE wealth.reports
     SET status = 'published', published_at = now(), published_by = $2
     WHERE id = $1 AND status = 'draft'
     RETURNING ${REPORT_COLUMNS}`,
    [reportId, userId],
  );
  return rows[0] ?? null;
}

export async function markReportSent(reportId: string) {
  await queryDb(`UPDATE wealth.reports SET sent_at = now() WHERE id = $1`, [reportId]);
}

export async function markReportViewed(reportId: string) {
  await queryDb(
    `UPDATE wealth.reports
     SET first_viewed_at = COALESCE(first_viewed_at, now()),
         last_viewed_at = now(),
         view_count = view_count + 1
     WHERE id = $1 AND status = 'published'`,
    [reportId],
  );
}

/** Only drafts can be discarded; published reports stay on the client's record. */
export async function deleteDraftReport(reportId: string): Promise<WealthReport | null> {
  const rows = await queryDb<WealthReport>(
    `DELETE FROM wealth.reports WHERE id = $1 AND status = 'draft'
     RETURNING ${REPORT_COLUMNS}`,
    [reportId],
  );
  return rows[0] ?? null;
}

export async function listClients(advisorId?: string | null): Promise<WealthClient[]> {
  if (advisorId) {
    const rows = await queryDb<WealthClient>(
      `SELECT ${CLIENT_SELECT} FROM wealth.clients
       WHERE advisor_id = $1
       ORDER BY full_name ASC`,
      [advisorId],
    );
    return rows.map(mapClient);
  }
  const rows = await queryDb<WealthClient>(
    `SELECT ${CLIENT_SELECT} FROM wealth.clients ORDER BY full_name ASC`,
  );
  return rows.map(mapClient);
}

export async function listClientsWithPortfolio(
  advisorId?: string | null,
): Promise<ClientListRow[]> {
  const rows = await queryDb<ClientListRow & { aum: string }>(
    `WITH latest_period AS (
       SELECT DISTINCT ON (client_id) id, client_id
       FROM wealth.statement_periods
       ORDER BY client_id, period_end DESC
     )
     SELECT
       c.id, c.client_number, c.reference_code, c.full_name, c.email, c.phone,
       c.currency, c.inception_date::text, c.advisor_id, c.status::text,
       c.risk_profile, c.investment_horizon, c.primary_objective,
       c.marital_status, c.dependents, c.estate_status, c.financial_goals,
       c.advisor_notes, c.date_of_birth::text, c.auth_user_id,
       c.invited_at::text, c.last_login_at::text, c.created_at::text,
       COALESCE(SUM(s.current_value_usd), 0)::float8 AS aum,
       NULLIF(CONCAT_WS(', ', NULLIF(a.city, ''), NULLIF(a.region, '')), '') AS location
     FROM wealth.clients c
     LEFT JOIN latest_period lp ON lp.client_id = c.id
     LEFT JOIN wealth.portfolio_snapshots s ON s.period_id = lp.id
     LEFT JOIN wealth.client_addresses a ON a.client_id = c.id AND a.is_primary = true
     WHERE ($1::uuid IS NULL OR c.advisor_id = $1)
     GROUP BY c.id, a.city, a.region
     ORDER BY c.full_name ASC`,
    [advisorId ?? null],
  );
  return rows.map((r) => ({
    ...mapClient(r),
    aum: Number(r.aum),
    location: r.location,
  }));
}

export async function getProfileByUserId(userId: string): Promise<SessionProfile | null> {
  const rows = await queryDb<SessionProfile>(
    `SELECT p.id, p.role::text AS role, p.client_id, p.advisor_id, p.full_name,
            COALESCE(u.email, '') AS email,
            COALESCE(a.is_superadmin, false) AS is_superadmin,
            COALESCE(p.email_notifications, true) AS email_notifications
     FROM wealth.profiles p
     JOIN auth.users u ON u.id = p.id
     LEFT JOIN wealth.advisors a ON a.id = p.advisor_id
     WHERE p.id = $1`,
    [userId],
  );
  return rows[0]
    ? {
        ...rows[0],
        role: rows[0].role as UserRole,
        is_superadmin: Boolean(rows[0].is_superadmin),
        email_notifications: Boolean(rows[0].email_notifications),
      }
    : null;
}

export async function updateProfileNotifications(
  userId: string,
  emailNotifications: boolean,
): Promise<void> {
  await queryDb(
    `UPDATE wealth.profiles SET email_notifications = $2 WHERE id = $1`,
    [userId, emailNotifications],
  );
}

export async function updateProfileFullNameForAdvisor(
  advisorId: string,
  fullName: string,
): Promise<void> {
  await queryDb(`UPDATE wealth.profiles SET full_name = $2 WHERE advisor_id = $1`, [
    advisorId,
    fullName,
  ]);
}

export async function insertSessionRequest(row: {
  clientId: string;
  advisorId: string;
  topic: string;
  preferredTimes: string;
}) {
  const rows = await queryDb<{ id: string }>(
    `INSERT INTO wealth.session_requests (client_id, advisor_id, topic, preferred_times)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [row.clientId, row.advisorId, row.topic, row.preferredTimes],
  );
  return rows[0];
}

export async function insertClientUpdate(row: {
  clientId: string;
  kind: UpdateKind;
  title: string;
  body: string;
  createdBy?: string | null;
}): Promise<ClientUpdate> {
  const rows = await queryDb<ClientUpdate>(
    `INSERT INTO wealth.client_updates (client_id, kind, title, body, created_by)
     VALUES ($1, $2::wealth.update_kind, $3, $4, $5)
     RETURNING id, client_id, kind::text, title, body, created_at::text, read_at::text`,
    [row.clientId, row.kind, row.title, row.body, row.createdBy ?? null],
  );
  return { ...rows[0], kind: rows[0].kind as UpdateKind };
}

export async function getUpdatesForClient(
  clientId: string,
  limit = 20,
): Promise<ClientUpdate[]> {
  const rows = await queryDb<ClientUpdate>(
    `SELECT id, client_id, kind::text, title, body, created_at::text, read_at::text
     FROM wealth.client_updates
     WHERE client_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [clientId, limit],
  );
  return rows.map((r) => ({ ...r, kind: r.kind as UpdateKind }));
}

export async function markUpdatesRead(clientId: string): Promise<void> {
  await queryDb(
    `UPDATE wealth.client_updates
     SET read_at = now()
     WHERE client_id = $1 AND read_at IS NULL`,
    [clientId],
  );
}

export async function upsertSnapshots(
  clientId: string,
  periodId: string,
  rows: Array<{
    bucket: PortfolioBucket;
    previous_value_usd: number;
    current_value_usd: number;
    period_change_pct: number | null;
    ytd_pct: number | null;
    inception_gain_usd: number | null;
    inception_pct: number | null;
    annualized_return_pct: number | null;
  }>,
): Promise<void> {
  for (const row of rows) {
    await queryDb(
      `INSERT INTO wealth.portfolio_snapshots (
        client_id, period_id, bucket, previous_value_usd, current_value_usd,
        period_change_pct, ytd_pct, inception_gain_usd, inception_pct, annualized_return_pct
      ) VALUES ($1, $2, $3::wealth.portfolio_bucket, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (client_id, period_id, bucket) DO UPDATE SET
        previous_value_usd = EXCLUDED.previous_value_usd,
        current_value_usd = EXCLUDED.current_value_usd,
        period_change_pct = EXCLUDED.period_change_pct,
        ytd_pct = EXCLUDED.ytd_pct,
        inception_gain_usd = EXCLUDED.inception_gain_usd,
        inception_pct = EXCLUDED.inception_pct,
        annualized_return_pct = EXCLUDED.annualized_return_pct`,
      [
        clientId,
        periodId,
        row.bucket,
        row.previous_value_usd,
        row.current_value_usd,
        row.period_change_pct,
        row.ytd_pct,
        row.inception_gain_usd,
        row.inception_pct,
        row.annualized_return_pct,
      ],
    );
  }
}

export async function insertTransaction(row: {
  clientId: string;
  bucket: PortfolioBucket | null;
  occurredOn: string;
  amountUsd: number;
  description: string;
  transactionType: TransactionType;
}): Promise<WealthTransaction> {
  const rows = await queryDb<WealthTransaction & { amount_usd: string }>(
    `INSERT INTO wealth.transactions (
      client_id, bucket, occurred_on, amount_usd, description, transaction_type
    ) VALUES ($1, $2::wealth.portfolio_bucket, $3::date, $4, $5, $6::wealth.transaction_type)
    RETURNING id, client_id, bucket, occurred_on::text, amount_usd::float8,
              description, transaction_type`,
    [
      row.clientId,
      row.bucket,
      row.occurredOn,
      row.amountUsd,
      row.description,
      row.transactionType,
    ],
  );
  return { ...rows[0], amount_usd: Number(rows[0].amount_usd) };
}

export async function upsertHistoryPoint(
  clientId: string,
  recordedOn: string,
  totalValueUsd: number,
): Promise<void> {
  await queryDb(
    `INSERT INTO wealth.portfolio_history (client_id, recorded_on, total_value_usd)
     VALUES ($1, $2::date, $3)
     ON CONFLICT (client_id, recorded_on) DO UPDATE SET
       total_value_usd = EXCLUDED.total_value_usd`,
    [clientId, recordedOn, totalValueUsd],
  );
}

export async function insertStatementPeriod(row: {
  clientId: string;
  periodStart: string;
  periodEnd: string;
  label: string;
}): Promise<StatementPeriod> {
  const rows = await queryDb<StatementPeriod>(
    `INSERT INTO wealth.statement_periods (client_id, period_start, period_end, label)
     VALUES ($1, $2::date, $3::date, $4)
     ON CONFLICT (client_id, period_start, period_end) DO UPDATE SET label = EXCLUDED.label
     RETURNING id, client_id, period_start::text, period_end::text, label`,
    [row.clientId, row.periodStart, row.periodEnd, row.label],
  );
  return rows[0];
}

export async function updateClientNotes(clientId: string, notes: string): Promise<void> {
  await queryDb(`UPDATE wealth.clients SET advisor_notes = $2 WHERE id = $1`, [
    clientId,
    notes,
  ]);
}

export type ClientFieldsUpdate = Partial<
  Pick<
    WealthClient,
    | "full_name"
    | "email"
    | "phone"
    | "status"
    | "currency"
    | "inception_date"
    | "risk_profile"
    | "investment_horizon"
    | "primary_objective"
    | "advisor_notes"
    | "marital_status"
    | "dependents"
    | "estate_status"
    | "financial_goals"
    | "date_of_birth"
    | "reference_code"
    | "review_cadence"
    | "next_review_date"
    | "last_contact_date"
    | "risk_assessed_at"
  >
>;

// Casts live next to each column because the advisor forms post strings for
// dates, enums and numbers.
const CLIENT_UPDATE_CASTS: Record<keyof ClientFieldsUpdate, string> = {
  full_name: "",
  email: "",
  phone: "",
  status: "::wealth.client_status",
  currency: "",
  inception_date: "::date",
  risk_profile: "",
  investment_horizon: "",
  primary_objective: "",
  advisor_notes: "",
  marital_status: "",
  dependents: "::integer",
  estate_status: "",
  financial_goals: "",
  date_of_birth: "::date",
  reference_code: "",
  review_cadence: "::wealth.review_cadence",
  next_review_date: "::date",
  last_contact_date: "::date",
  risk_assessed_at: "::date",
};

export async function updateClientFields(
  clientId: string,
  fields: ClientFieldsUpdate,
): Promise<WealthClient | null> {
  const columns = (Object.keys(CLIENT_UPDATE_CASTS) as Array<keyof ClientFieldsUpdate>)
    .filter((column) => fields[column] !== undefined && fields[column] !== "");

  if (columns.length === 0) {
    return getClientById(clientId);
  }

  const assignments = columns.map(
    (column, i) =>
      `${column} = COALESCE($${i + 2}${CLIENT_UPDATE_CASTS[column]}, ${column})`,
  );

  const rows = await queryDb<WealthClient>(
    `UPDATE wealth.clients SET ${assignments.join(", ")}
     WHERE id = $1
     RETURNING ${CLIENT_SELECT}`,
    [clientId, ...columns.map((column) => fields[column] ?? null)],
  );
  return rows[0] ? mapClient(rows[0]) : null;
}

export async function findAuthUserIdByEmail(email: string): Promise<string | null> {
  const rows = await queryDb<{ id: string }>(
    `SELECT id FROM auth.users WHERE lower(email) = lower($1) LIMIT 1`,
    [email],
  );
  return rows[0]?.id ?? null;
}

const CLIENT_GOAL_SELECT = `
  id, client_id, name, category, icon_name,
  target_usd::float8, current_usd::float8, target_date::text, is_ongoing,
  probability_pct::float8, status::text, advisor_note, linked_bucket::text,
  created_at::text, updated_at::text
`;

function mapClientGoal(row: ClientGoal & { status: string; linked_bucket?: string | null }): ClientGoal {
  return {
    ...row,
    target_usd: Number(row.target_usd),
    current_usd: Number(row.current_usd),
    probability_pct: Number(row.probability_pct),
    status: row.status as GoalStatus,
    linked_bucket: (row.linked_bucket as ClientGoal["linked_bucket"]) ?? null,
  };
}

export async function getClientGoals(clientId: string): Promise<ClientGoal[]> {
  const rows = await queryDb<ClientGoal & { status: string }>(
    `SELECT ${CLIENT_GOAL_SELECT}
     FROM wealth.client_goals
     WHERE client_id = $1
     ORDER BY is_ongoing ASC, target_date ASC NULLS LAST, created_at DESC`,
    [clientId],
  );
  return rows.map(mapClientGoal);
}

export async function getClientGoalById(
  clientId: string,
  goalId: string,
): Promise<ClientGoal | null> {
  const rows = await queryDb<ClientGoal & { status: string }>(
    `SELECT ${CLIENT_GOAL_SELECT}
     FROM wealth.client_goals
     WHERE client_id = $1 AND id = $2
     LIMIT 1`,
    [clientId, goalId],
  );
  return rows[0] ? mapClientGoal(rows[0]) : null;
}

export async function insertClientGoal(
  clientId: string,
  input: GoalWriteInput,
): Promise<ClientGoal> {
  const rows = await queryDb<ClientGoal & { status: string }>(
    `INSERT INTO wealth.client_goals (
       client_id, name, category, icon_name, target_usd, current_usd,
       target_date, is_ongoing, probability_pct, status, advisor_note, linked_bucket
     )
     VALUES (
       $1, $2, $3, $4, $5, $6, $7::date, $8, $9, $10::wealth.goal_status, $11, $12::wealth.portfolio_bucket
     )
     RETURNING ${CLIENT_GOAL_SELECT}`,
    [
      clientId,
      input.name,
      input.category,
      input.iconName,
      input.targetUsd,
      input.currentUsd,
      input.targetDate,
      input.isOngoing,
      input.probabilityPct,
      input.status,
      input.advisorNote,
      input.linkedBucket ?? null,
    ],
  );
  return mapClientGoal(rows[0]!);
}

export async function updateClientGoal(
  clientId: string,
  goalId: string,
  input: GoalWriteInput,
): Promise<ClientGoal | null> {
  const rows = await queryDb<ClientGoal & { status: string }>(
    `UPDATE wealth.client_goals
     SET name = $3,
         category = $4,
         icon_name = $5,
         target_usd = $6,
         current_usd = $7,
         target_date = $8::date,
         is_ongoing = $9,
         probability_pct = $10,
         status = $11::wealth.goal_status,
         advisor_note = $12,
         linked_bucket = $13::wealth.portfolio_bucket
     WHERE client_id = $1 AND id = $2
     RETURNING ${CLIENT_GOAL_SELECT}`,
    [
      clientId,
      goalId,
      input.name,
      input.category,
      input.iconName,
      input.targetUsd,
      input.currentUsd,
      input.targetDate,
      input.isOngoing,
      input.probabilityPct,
      input.status,
      input.advisorNote,
      input.linkedBucket ?? null,
    ],
  );
  return rows[0] ? mapClientGoal(rows[0]) : null;
}

export async function deleteClientGoal(
  clientId: string,
  goalId: string,
): Promise<boolean> {
  const rows = await queryDb<{ id: string }>(
    `DELETE FROM wealth.client_goals
     WHERE client_id = $1 AND id = $2
     RETURNING id`,
    [clientId, goalId],
  );
  return Boolean(rows[0]);
}
