import { queryDb } from "@/lib/supabase/db";
import { isReportKind, statementKindTitle } from "@/lib/wealth/period-calendar";
import type { PortfolioBucket } from "@/lib/wealth/types";
import { BUCKET_LABELS } from "@/lib/wealth/constants";
import type {
  AttentionGroup,
  AttentionItem,
  AuditLogEntry,
  BookActivityItem,
  BookAllocationSlice,
  BookAumHistoryPoint,
  ClientAdvisorNote,
  ClientInternalDocument,
  ClientListExtended,
  DocumentRequest,
  MessageThread,
  OutstandingReport,
  ReviewCadence,
  SessionRequest,
  SessionRequestStatus,
  VaultDocument,
  WmMessage,
  WmSession,
  WmSessionStatus,
} from "@/lib/wealth/wm-types";

const BUCKET_SHORT_LABELS: Record<PortfolioBucket, string> = {
  income: "Income",
  growth: "Growth",
  venture: "Venture",
  treasury: "Treasury",
  coa: "Cash On Account",
};

export async function insertAuditLog(row: {
  actorId?: string | null;
  action: string;
  targetType: string;
  targetId: string;
  beforeValue?: Record<string, unknown> | null;
  afterValue?: Record<string, unknown> | null;
  note?: string | null;
}): Promise<AuditLogEntry> {
  const rows = await queryDb<AuditLogEntry>(
    `INSERT INTO wealth.audit_log (actor_id, action, target_type, target_id, before_value, after_value, note)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7)
     RETURNING id, actor_id, action, target_type, target_id,
               before_value, after_value, note, created_at::text`,
    [
      row.actorId ?? null,
      row.action,
      row.targetType,
      row.targetId,
      row.beforeValue ? JSON.stringify(row.beforeValue) : null,
      row.afterValue ? JSON.stringify(row.afterValue) : null,
      row.note ?? null,
    ],
  );
  return rows[0]!;
}

export async function listAuditLogForClient(
  clientId: string,
  limit = 50,
): Promise<AuditLogEntry[]> {
  return queryDb<AuditLogEntry>(
    `SELECT id, actor_id, action, target_type, target_id,
            before_value, after_value, note, created_at::text
     FROM wealth.audit_log
     WHERE target_type = 'client' AND target_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [clientId, limit],
  );
}

export async function countSessionsThisWeek(advisorId?: string | null): Promise<number> {
  const rows = await queryDb<{ count: string }>(
    `SELECT COUNT(*)::int AS count
     FROM wealth.sessions s
     WHERE s.scheduled_at >= date_trunc('week', now())
       AND s.scheduled_at < date_trunc('week', now()) + interval '7 days'
       AND s.status IN ('confirmed', 'completed')
       AND ($1::uuid IS NULL OR s.advisor_id = $1)`,
    [advisorId ?? null],
  );
  return Number(rows[0]?.count ?? 0);
}

export async function listClientsExtended(
  advisorId?: string | null,
): Promise<ClientListExtended[]> {
  const rows = await queryDb<ClientListExtended & { aum: string; period_return_pct: string | null; has_open_request: boolean }>(
    `WITH latest_period AS (
       SELECT DISTINCT ON (client_id) id, client_id
       FROM wealth.statement_periods
       ORDER BY client_id, period_end DESC
     ),
     bucket_returns AS (
       SELECT s.client_id,
         CASE WHEN SUM(s.previous_value_usd) > 0
           THEN ((SUM(s.current_value_usd) - SUM(s.previous_value_usd)) / SUM(s.previous_value_usd)) * 100
           ELSE NULL
         END AS period_return_pct
       FROM wealth.portfolio_snapshots s
       JOIN latest_period lp ON lp.id = s.period_id AND lp.client_id = s.client_id
       GROUP BY s.client_id
     ),
     open_flags AS (
       SELECT c.id AS client_id,
         EXISTS (
           SELECT 1 FROM wealth.session_requests sr
           WHERE sr.client_id = c.id AND sr.status = 'pending'
         ) OR EXISTS (
           SELECT 1 FROM wealth.document_requests dr
           WHERE dr.client_id = c.id AND dr.status = 'pending'
         ) AS has_open_request
       FROM wealth.clients c
     )
     SELECT
       c.id, c.client_number, c.full_name, c.email, c.phone,
       c.status::text, c.risk_profile, c.advisor_id,
       a.full_name AS advisor_name,
       COALESCE(SUM(ps.current_value_usd), 0)::float8 AS aum,
       br.period_return_pct::float8,
       c.next_review_date::text, c.last_contact_date::text,
       c.review_cadence::text,
       NULLIF(CONCAT_WS(', ', NULLIF(addr.city, ''), NULLIF(addr.region, '')), '') AS location,
       COALESCE(of.has_open_request, false) AS has_open_request
     FROM wealth.clients c
     LEFT JOIN latest_period lp ON lp.client_id = c.id
     LEFT JOIN wealth.portfolio_snapshots ps ON ps.period_id = lp.id
     LEFT JOIN bucket_returns br ON br.client_id = c.id
     LEFT JOIN open_flags of ON of.client_id = c.id
     LEFT JOIN wealth.advisors a ON a.id = c.advisor_id
     LEFT JOIN wealth.client_addresses addr ON addr.client_id = c.id AND addr.is_primary = true
     WHERE ($1::uuid IS NULL OR c.advisor_id = $1)
     GROUP BY c.id, a.full_name, br.period_return_pct, of.has_open_request, addr.city, addr.region
     ORDER BY c.full_name ASC`,
    [advisorId ?? null],
  );
  return rows.map((r) => ({
    ...r,
    aum: Number(r.aum),
    period_return_pct: r.period_return_pct != null ? Number(r.period_return_pct) : null,
    review_cadence: r.review_cadence as ReviewCadence | null,
  }));
}

export async function listOutstandingReports(
  advisorId?: string | null,
  clientId?: string | null,
): Promise<OutstandingReport[]> {
  const rows = await queryDb<{
    client_id: string;
    client_name: string;
    period_id: string;
    period_end: string;
    kind: string;
    window_label: string;
  }>(
    `WITH scoped AS (
       SELECT c.id, c.full_name
       FROM wealth.clients c
       WHERE c.status IS DISTINCT FROM 'inactive'
         AND ($1::uuid IS NULL OR c.advisor_id = $1)
         AND ($2::uuid IS NULL OR c.id = $2)
     ),
     latest_month AS (
       SELECT DISTINCT ON (p.client_id)
         p.client_id,
         s.full_name AS client_name,
         p.id AS period_id,
         p.period_end,
         p.label
       FROM wealth.statement_periods p
       INNER JOIN scoped s ON s.id = p.client_id
       ORDER BY p.client_id, p.period_end DESC
     ),
     latest_quarter AS (
       SELECT DISTINCT ON (p.client_id)
         p.client_id,
         s.full_name AS client_name,
         p.id AS period_id,
         p.period_end
       FROM wealth.statement_periods p
       INNER JOIN scoped s ON s.id = p.client_id
       WHERE EXTRACT(MONTH FROM p.period_end) IN (3, 6, 9, 12)
       ORDER BY p.client_id, p.period_end DESC
     ),
     latest_year AS (
       SELECT DISTINCT ON (p.client_id)
         p.client_id,
         s.full_name AS client_name,
         p.id AS period_id,
         p.period_end
       FROM wealth.statement_periods p
       INNER JOIN scoped s ON s.id = p.client_id
       WHERE EXTRACT(MONTH FROM p.period_end) = 12
       ORDER BY p.client_id, p.period_end DESC
     ),
     needed AS (
       SELECT
         m.client_id,
         m.client_name,
         m.period_id,
         m.period_end,
         'monthly'::text AS kind,
         m.label AS window_label,
         'M'::text AS token,
         to_char(m.period_end, 'YYYYMMDD') AS window_stamp,
         true AS match_period
       FROM latest_month m
       UNION ALL
       SELECT
         q.client_id,
         q.client_name,
         q.period_id,
         q.period_end,
         'quarterly',
         'Q' || EXTRACT(QUARTER FROM q.period_end)::int || ' ' || EXTRACT(YEAR FROM q.period_end)::int,
         'Q',
         to_char(
           (date_trunc('quarter', q.period_end::timestamp)
             + interval '3 months'
             - interval '1 day')::date,
           'YYYYMMDD'
         ),
         false
       FROM latest_quarter q
       UNION ALL
       SELECT
         y.client_id,
         y.client_name,
         y.period_id,
         y.period_end,
         'annual',
         EXTRACT(YEAR FROM y.period_end)::int::text,
         'A',
         to_char(make_date(EXTRACT(YEAR FROM y.period_end)::int, 12, 31), 'YYYYMMDD'),
         false
       FROM latest_year y
     )
     SELECT
       n.client_id,
       n.client_name,
       n.period_id,
       n.period_end::text,
       n.kind,
       n.window_label
     FROM needed n
     WHERE NOT EXISTS (
       SELECT 1
       FROM wealth.reports r
       WHERE r.client_id = n.client_id
         AND r.status = 'published'
         AND split_part(r.reference, '/', 2) = n.token
         AND (
           (n.match_period AND r.period_id = n.period_id)
           OR (NOT n.match_period AND split_part(r.reference, '/', 3) = n.window_stamp)
         )
     )
     ORDER BY n.client_name ASC,
       CASE n.kind WHEN 'monthly' THEN 1 WHEN 'quarterly' THEN 2 ELSE 3 END`,
    [advisorId ?? null, clientId ?? null],
  );

  return rows.flatMap((r) => {
    if (!isReportKind(r.kind)) return [];
    return [
      {
        clientId: r.client_id,
        clientName: r.client_name,
        periodId: r.period_id,
        periodEnd: r.period_end,
        kind: r.kind,
        windowLabel: r.window_label,
      },
    ];
  });
}

export async function getAttentionFeed(advisorId?: string | null): Promise<AttentionItem[]> {
  const items: AttentionItem[] = [];

  const sessionRequests = await queryDb<{
    id: string;
    client_id: string;
    client_name: string;
    topic: string;
    created_at: string;
  }>(
    `SELECT sr.id, sr.client_id, c.full_name AS client_name, sr.topic, sr.created_at::text
     FROM wealth.session_requests sr
     JOIN wealth.clients c ON c.id = sr.client_id
     WHERE sr.status = 'pending'
       AND ($1::uuid IS NULL OR sr.advisor_id = $1)
     ORDER BY sr.created_at DESC
     LIMIT 10`,
    [advisorId ?? null],
  );
  for (const sr of sessionRequests) {
    items.push({
      id: `sr-${sr.id}`,
      type: "session_request",
      title: `${sr.client_name} requested a session: ${sr.topic}`,
      clientId: sr.client_id,
      clientName: sr.client_name,
      href: `/advisors/dashboard/sessions?request=${sr.id}`,
      createdAt: sr.created_at,
    });
  }

  const docRequests = await queryDb<{
    id: string;
    client_id: string;
    client_name: string;
    title: string;
    created_at: string;
  }>(
    `SELECT dr.id, dr.client_id, c.full_name AS client_name, dr.title, dr.created_at::text
     FROM wealth.document_requests dr
     JOIN wealth.clients c ON c.id = dr.client_id
     WHERE dr.status = 'pending'
       AND ($1::uuid IS NULL OR dr.advisor_id = $1)
     ORDER BY dr.created_at DESC
     LIMIT 10`,
    [advisorId ?? null],
  );
  for (const dr of docRequests) {
    items.push({
      id: `dr-${dr.id}`,
      type: "document_request",
      title: `${dr.client_name} has not uploaded: ${dr.title}`,
      clientId: dr.client_id,
      clientName: dr.client_name,
      href: `/advisors/dashboard/clients/${dr.client_id}?tab=Documents`,
      createdAt: dr.created_at,
    });
  }

  const reviewDue = await queryDb<{
    id: string;
    full_name: string;
    next_review_date: string;
  }>(
    `SELECT id, full_name, next_review_date::text
     FROM wealth.clients
     WHERE status = 'review_due'
       AND ($1::uuid IS NULL OR advisor_id = $1)
     ORDER BY next_review_date ASC NULLS LAST
     LIMIT 5`,
    [advisorId ?? null],
  );
  for (const c of reviewDue) {
    items.push({
      id: `rv-${c.id}`,
      type: "review_due",
      title: `${c.full_name} is due for review`,
      clientId: c.id,
      clientName: c.full_name,
      href: `/advisors/dashboard/clients/${c.id}?tab=Profile`,
      createdAt: c.next_review_date,
    });
  }

  const recapBacklog = await queryDb<{
    id: string;
    client_id: string;
    client_name: string;
    scheduled_at: string;
  }>(
    `SELECT s.id, s.client_id, c.full_name AS client_name, s.scheduled_at::text
     FROM wealth.sessions s
     JOIN wealth.clients c ON c.id = s.client_id
     WHERE s.recap_logged_at IS NULL
       AND s.scheduled_at < now()
       AND s.status IN ('confirmed', 'completed')
       AND ($1::uuid IS NULL OR s.advisor_id = $1)
     ORDER BY s.scheduled_at ASC
     LIMIT 5`,
    [advisorId ?? null],
  );
  for (const s of recapBacklog) {
    items.push({
      id: `rc-${s.id}`,
      type: "recap_backlog",
      title: `Session recap needed for ${s.client_name}`,
      clientId: s.client_id,
      clientName: s.client_name,
      href: `/advisors/dashboard/clients/${s.client_id}?tab=Sessions`,
      createdAt: s.scheduled_at,
    });
  }

  const unread = await queryDb<{ count: string }>(
    `SELECT COUNT(DISTINCT t.id)::int AS count
     FROM wealth.message_threads t
     JOIN wealth.messages m ON m.thread_id = t.id
     WHERE m.sender_role = 'client'
       AND (t.advisor_last_read_at IS NULL OR m.created_at > t.advisor_last_read_at)
       AND ($1::uuid IS NULL OR t.advisor_id = $1)`,
    [advisorId ?? null],
  );
  const unreadCount = Number(unread[0]?.count ?? 0);
  if (unreadCount > 0) {
    items.push({
      id: "unread-messages",
      type: "message",
      title: `${unreadCount} unread message${unreadCount === 1 ? "" : "s"} from clients`,
      clientId: "",
      clientName: "",
      href: "/advisors/dashboard/messages",
      createdAt: new Date().toISOString(),
    });
  }

  const outstanding = await listOutstandingReports(advisorId);
  for (const row of outstanding.slice(0, 12)) {
    items.push({
      id: `rp-${row.clientId}-${row.kind}-${row.periodId}`,
      type: "report_due",
      title: `${statementKindTitle(row.kind)} not generated for ${row.clientName} (${row.windowLabel})`,
      clientId: row.clientId,
      clientName: row.clientName,
      href: `/advisors/dashboard/clients/${row.clientId}?tab=Reports`,
      createdAt: `${row.periodEnd}T12:00:00`,
    });
  }

  return items.sort((a, b) => {
    const dueRank = (type: AttentionItem["type"]) => (type === "report_due" ? 1 : 0);
    const byDue = dueRank(b.type) - dueRank(a.type);
    if (byDue !== 0) return byDue;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

export async function bulkTagReviewDue(clientIds: string[]): Promise<number> {
  if (clientIds.length === 0) return 0;
  const rows = await queryDb<{ id: string }>(
    `UPDATE wealth.clients SET status = 'review_due'
     WHERE id = ANY($1::uuid[])
     RETURNING id`,
    [clientIds],
  );
  return rows.length;
}

// Sessions
export async function listSessions(
  advisorId?: string | null,
  clientId?: string | null,
): Promise<WmSession[]> {
  const rows = await queryDb<WmSession & { client_name: string }>(
    `SELECT s.id, s.client_id, s.advisor_id, s.session_request_id,
            s.title, s.scheduled_at::text, s.status::text, s.format,
            s.recap_topics, s.recap_decisions, s.recap_action_items, s.recap_next_steps,
            s.recap_logged_at::text, s.created_at::text,
            c.full_name AS client_name
     FROM wealth.sessions s
     JOIN wealth.clients c ON c.id = s.client_id
     WHERE ($1::uuid IS NULL OR s.advisor_id = $1)
       AND ($2::uuid IS NULL OR s.client_id = $2)
     ORDER BY s.scheduled_at DESC NULLS LAST`,
    [advisorId ?? null, clientId ?? null],
  );
  return rows.map((r) => ({
    ...r,
    status: r.status as WmSessionStatus,
    recap_topics: r.recap_topics ?? [],
    recap_decisions: r.recap_decisions ?? [],
    recap_action_items: r.recap_action_items ?? [],
    recap_next_steps: r.recap_next_steps ?? [],
  }));
}

export async function listSessionRequests(
  advisorId?: string | null,
  clientId?: string | null,
): Promise<SessionRequest[]> {
  const rows = await queryDb<SessionRequest & { client_name: string }>(
    `SELECT sr.id, sr.client_id, sr.advisor_id, sr.topic, sr.preferred_times,
            sr.proposed_times, sr.proposed_at::text, sr.proposed_by,
            sr.client_agreed_at::text, sr.advisor_agreed_at::text, sr.format,
            sr.status::text, sr.session_id, sr.response_note,
            sr.created_at::text, sr.responded_at::text,
            c.full_name AS client_name
     FROM wealth.session_requests sr
     JOIN wealth.clients c ON c.id = sr.client_id
     WHERE ($1::uuid IS NULL OR sr.advisor_id = $1)
       AND ($2::uuid IS NULL OR sr.client_id = $2)
     ORDER BY sr.created_at DESC`,
    [advisorId ?? null, clientId ?? null],
  );
  return rows.map((r) => ({
    ...r,
    status: r.status as SessionRequestStatus,
    proposed_by: r.proposed_by as SessionRequest["proposed_by"],
  }));
}

export async function getSessionRequestById(id: string): Promise<SessionRequest | null> {
  const rows = await queryDb<SessionRequest>(
    `SELECT sr.id, sr.client_id, sr.advisor_id, sr.topic, sr.preferred_times,
            sr.proposed_times, sr.proposed_at::text, sr.proposed_by,
            sr.client_agreed_at::text, sr.advisor_agreed_at::text, sr.format,
            sr.status::text, sr.session_id, sr.response_note,
            sr.created_at::text, sr.responded_at::text
     FROM wealth.session_requests sr
     WHERE sr.id = $1`,
    [id],
  );
  const row = rows[0];
  if (!row) return null;
  return {
    ...row,
    status: row.status as SessionRequestStatus,
    proposed_by: row.proposed_by as SessionRequest["proposed_by"],
  };
}

export async function insertSessionProposal(row: {
  clientId: string;
  advisorId: string;
  topic: string;
  proposedAt: string;
  proposedBy: "client" | "advisor";
  format?: string;
  preferredTimesLabel: string;
}) {
  const clientAgreedAt = row.proposedBy === "client" ? new Date().toISOString() : null;
  const advisorAgreedAt = row.proposedBy === "advisor" ? new Date().toISOString() : null;
  const rows = await queryDb<SessionRequest>(
    `INSERT INTO wealth.session_requests (
       client_id, advisor_id, topic, preferred_times, proposed_at, proposed_by,
       client_agreed_at, advisor_agreed_at, format, status
     ) VALUES ($1, $2, $3, $4, $5::timestamptz, $6, $7::timestamptz, $8::timestamptz, $9, 'pending')
     RETURNING id, client_id, advisor_id, topic, preferred_times, proposed_times,
               proposed_at::text, proposed_by, client_agreed_at::text, advisor_agreed_at::text,
               format, status::text, session_id, response_note, created_at::text, responded_at::text`,
    [
      row.clientId,
      row.advisorId,
      row.topic,
      row.preferredTimesLabel,
      row.proposedAt,
      row.proposedBy,
      clientAgreedAt,
      advisorAgreedAt,
      row.format ?? "video",
    ],
  );
  const created = rows[0]!;
  return {
    ...created,
    status: created.status as SessionRequestStatus,
    proposed_by: created.proposed_by as SessionRequest["proposed_by"],
  };
}

export async function updateSessionRequest(
  id: string,
  fields: {
    status?: SessionRequestStatus;
    proposedTimes?: string;
    proposedAt?: string;
    proposedBy?: "client" | "advisor";
    clientAgreedAt?: string | null;
    advisorAgreedAt?: string | null;
    sessionId?: string;
    responseNote?: string;
    format?: string;
    preferredTimesLabel?: string;
  },
): Promise<SessionRequest | null> {
  const rows = await queryDb<SessionRequest>(
    `UPDATE wealth.session_requests SET
       status = COALESCE($2::wealth.session_request_status, status),
       proposed_times = COALESCE($3, proposed_times),
       proposed_at = COALESCE($4::timestamptz, proposed_at),
       proposed_by = COALESCE($5, proposed_by),
       client_agreed_at = CASE WHEN $6::text = '__clear__' THEN NULL
                             WHEN $6 IS NOT NULL THEN $6::timestamptz
                             ELSE client_agreed_at END,
       advisor_agreed_at = CASE WHEN $7::text = '__clear__' THEN NULL
                              WHEN $7 IS NOT NULL THEN $7::timestamptz
                              ELSE advisor_agreed_at END,
       session_id = COALESCE($8::uuid, session_id),
       response_note = COALESCE($9, response_note),
       format = COALESCE($10, format),
       preferred_times = COALESCE($11, preferred_times),
       responded_at = CASE WHEN $2 IS NOT NULL THEN now() ELSE responded_at END
     WHERE id = $1
     RETURNING id, client_id, advisor_id, topic, preferred_times, proposed_times,
               proposed_at::text, proposed_by, client_agreed_at::text, advisor_agreed_at::text,
               format, status::text, session_id, response_note, created_at::text, responded_at::text`,
    [
      id,
      fields.status ?? null,
      fields.proposedTimes ?? null,
      fields.proposedAt ?? null,
      fields.proposedBy ?? null,
      fields.clientAgreedAt === null
        ? "__clear__"
        : (fields.clientAgreedAt ?? null),
      fields.advisorAgreedAt === null
        ? "__clear__"
        : (fields.advisorAgreedAt ?? null),
      fields.sessionId ?? null,
      fields.responseNote ?? null,
      fields.format ?? null,
      fields.preferredTimesLabel ?? null,
    ],
  );
  const row = rows[0];
  if (!row) return null;
  return {
    ...row,
    status: row.status as SessionRequestStatus,
    proposed_by: row.proposed_by as SessionRequest["proposed_by"],
  };
}

export async function updateSessionSchedule(
  sessionId: string,
  fields: {
    scheduledAt?: string;
    status?: WmSessionStatus;
    title?: string;
    format?: string;
  },
): Promise<WmSession | null> {
  const rows = await queryDb<WmSession>(
    `UPDATE wealth.sessions SET
       scheduled_at = COALESCE($2::timestamptz, scheduled_at),
       status = COALESCE($3::wealth.session_status, status),
       title = COALESCE($4, title),
       format = COALESCE($5, format),
       updated_at = now()
     WHERE id = $1
     RETURNING id, client_id, advisor_id, session_request_id, title, scheduled_at::text,
               status::text, format, recap_topics, recap_decisions, recap_action_items,
               recap_next_steps, recap_logged_at::text, created_at::text`,
    [
      sessionId,
      fields.scheduledAt ?? null,
      fields.status ?? null,
      fields.title ?? null,
      fields.format ?? null,
    ],
  );
  const row = rows[0];
  if (!row) return null;
  return {
    ...row,
    status: row.status as WmSessionStatus,
    recap_topics: row.recap_topics ?? [],
    recap_decisions: row.recap_decisions ?? [],
    recap_action_items: row.recap_action_items ?? [],
    recap_next_steps: row.recap_next_steps ?? [],
  };
}

export async function insertSession(row: {
  clientId: string;
  advisorId: string;
  sessionRequestId?: string | null;
  title: string;
  scheduledAt: string;
  status?: WmSessionStatus;
  format?: string;
}): Promise<WmSession> {
  const rows = await queryDb<WmSession>(
    `INSERT INTO wealth.sessions (
       client_id, advisor_id, session_request_id, title, scheduled_at, status, format
     ) VALUES ($1, $2, $3, $4, $5::timestamptz, $6::wealth.session_status, $7)
     RETURNING id, client_id, advisor_id, session_request_id, title, scheduled_at::text,
               status::text, format, recap_topics, recap_decisions, recap_action_items,
               recap_next_steps, recap_logged_at::text, created_at::text`,
    [
      row.clientId,
      row.advisorId,
      row.sessionRequestId ?? null,
      row.title,
      row.scheduledAt,
      row.status ?? "confirmed",
      row.format ?? "video",
    ],
  );
  return { ...rows[0]!, status: rows[0]!.status as WmSessionStatus };
}

export async function updateSessionRecap(
  sessionId: string,
  recap: {
    topics: string[];
    decisions: string[];
    actionItems: string[];
    nextSteps: string[];
  },
): Promise<WmSession | null> {
  const rows = await queryDb<WmSession>(
    `UPDATE wealth.sessions SET
       recap_topics = $2,
       recap_decisions = $3,
       recap_action_items = $4,
       recap_next_steps = $5,
       recap_logged_at = now(),
       status = 'completed',
       updated_at = now()
     WHERE id = $1
     RETURNING id, client_id, advisor_id, session_request_id, title, scheduled_at::text,
               status::text, format, recap_topics, recap_decisions, recap_action_items,
               recap_next_steps, recap_logged_at::text, created_at::text`,
    [
      sessionId,
      recap.topics,
      recap.decisions,
      recap.actionItems,
      recap.nextSteps,
    ],
  );
  return rows[0] ? { ...rows[0], status: rows[0].status as WmSessionStatus } : null;
}

// Documents
export async function listDocumentRequests(
  advisorId?: string | null,
  clientId?: string | null,
): Promise<DocumentRequest[]> {
  const rows = await queryDb<DocumentRequest & { client_name: string }>(
    `SELECT dr.id, dr.client_id, dr.advisor_id, dr.title, dr.description,
            dr.due_date::text, dr.status::text, dr.created_at::text,
            c.full_name AS client_name
     FROM wealth.document_requests dr
     JOIN wealth.clients c ON c.id = dr.client_id
     WHERE ($1::uuid IS NULL OR dr.advisor_id = $1)
       AND ($2::uuid IS NULL OR dr.client_id = $2)
     ORDER BY dr.due_date ASC NULLS LAST, dr.created_at DESC`,
    [advisorId ?? null, clientId ?? null],
  );
  return rows;
}

export async function insertDocumentRequest(row: {
  clientId: string;
  advisorId: string;
  title: string;
  description?: string;
  dueDate?: string | null;
}): Promise<DocumentRequest> {
  const rows = await queryDb<DocumentRequest>(
    `INSERT INTO wealth.document_requests (client_id, advisor_id, title, description, due_date)
     VALUES ($1, $2, $3, $4, $5::date)
     RETURNING id, client_id, advisor_id, title, description, due_date::text,
               status::text, created_at::text`,
    [row.clientId, row.advisorId, row.title, row.description ?? "", row.dueDate ?? null],
  );
  return rows[0]!;
}

export async function listVaultDocuments(clientId: string): Promise<VaultDocument[]> {
  return queryDb<VaultDocument>(
    `SELECT id, client_id, title, category, storage_path, file_size_bytes,
            mime_type, expires_on::text, document_request_id, uploaded_by_role,
            created_at::text
     FROM wealth.vault_documents
     WHERE client_id = $1
     ORDER BY created_at DESC`,
    [clientId],
  );
}

export async function listExpiringDocuments(
  advisorId?: string | null,
  withinDays = 30,
): Promise<(VaultDocument & { client_name: string })[]> {
  return queryDb<VaultDocument & { client_name: string }>(
    `SELECT v.id, v.client_id, v.title, v.category, v.storage_path, v.file_size_bytes,
            v.mime_type, v.expires_on::text, v.document_request_id, v.uploaded_by_role,
            v.created_at::text, c.full_name AS client_name
     FROM wealth.vault_documents v
     JOIN wealth.clients c ON c.id = v.client_id
     WHERE v.expires_on IS NOT NULL
       AND v.expires_on <= (CURRENT_DATE + $2::int)
       AND ($1::uuid IS NULL OR c.advisor_id = $1)
     ORDER BY v.expires_on ASC`,
    [advisorId ?? null, withinDays],
  );
}

// Messages
export async function getOrCreateThread(
  clientId: string,
  advisorId: string,
): Promise<MessageThread> {
  const existing = await queryDb<MessageThread>(
    `SELECT id, client_id, advisor_id, advisor_last_read_at::text,
            client_last_read_at::text, updated_at::text
     FROM wealth.message_threads WHERE client_id = $1`,
    [clientId],
  );
  if (existing[0]) return existing[0];

  const rows = await queryDb<MessageThread>(
    `INSERT INTO wealth.message_threads (client_id, advisor_id)
     VALUES ($1, $2)
     RETURNING id, client_id, advisor_id, advisor_last_read_at::text,
               client_last_read_at::text, updated_at::text`,
    [clientId, advisorId],
  );
  return rows[0]!;
}

export async function listMessageThreads(
  advisorId?: string | null,
): Promise<MessageThread[]> {
  const rows = await queryDb<MessageThread & { client_name: string; last_message: string; unread_count: string }>(
    `SELECT t.id, t.client_id, t.advisor_id, t.advisor_last_read_at::text,
            t.client_last_read_at::text, t.updated_at::text,
            c.full_name AS client_name,
            (SELECT body FROM wealth.messages m WHERE m.thread_id = t.id ORDER BY m.created_at DESC LIMIT 1) AS last_message,
            (SELECT COUNT(*)::int FROM wealth.messages m
             WHERE m.thread_id = t.id AND m.sender_role = 'client'
               AND (t.advisor_last_read_at IS NULL OR m.created_at > t.advisor_last_read_at)
            ) AS unread_count
     FROM wealth.message_threads t
     JOIN wealth.clients c ON c.id = t.client_id
     WHERE ($1::uuid IS NULL OR t.advisor_id = $1)
     ORDER BY t.updated_at DESC`,
    [advisorId ?? null],
  );
  return rows.map((r) => ({
    ...r,
    unread_count: Number(r.unread_count),
  }));
}

export async function listMessages(threadId: string): Promise<WmMessage[]> {
  return queryDb<WmMessage & { sender_name: string | null }>(
    `SELECT m.id, m.thread_id, m.sender_role, m.sender_id, m.body,
            m.attachment_type, m.attachment_id, m.created_at::text,
            COALESCE(a.full_name, p.full_name) AS sender_name
     FROM wealth.messages m
     LEFT JOIN wealth.profiles p ON p.id = m.sender_id
     LEFT JOIN wealth.advisors a ON a.id = p.advisor_id
     WHERE m.thread_id = $1
     ORDER BY m.created_at ASC`,
    [threadId],
  );
}

export async function insertMessage(row: {
  threadId: string;
  senderRole: "advisor" | "client";
  senderId?: string | null;
  body: string;
  attachmentType?: string | null;
  attachmentId?: string | null;
}): Promise<WmMessage> {
  const rows = await queryDb<WmMessage>(
    `INSERT INTO wealth.messages (thread_id, sender_role, sender_id, body, attachment_type, attachment_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, thread_id, sender_role, sender_id, body,
               attachment_type, attachment_id, created_at::text`,
    [
      row.threadId,
      row.senderRole,
      row.senderId ?? null,
      row.body,
      row.attachmentType ?? null,
      row.attachmentId ?? null,
    ],
  );
  await queryDb(`UPDATE wealth.message_threads SET updated_at = now() WHERE id = $1`, [
    row.threadId,
  ]);
  return rows[0]!;
}

export async function markThreadReadByAdvisor(threadId: string): Promise<void> {
  await queryDb(
    `UPDATE wealth.message_threads SET advisor_last_read_at = now() WHERE id = $1`,
    [threadId],
  );
}

export async function syncGoalsFromPortfolio(
  clientId: string,
  bucketValues: Partial<Record<PortfolioBucket, number>>,
): Promise<void> {
  for (const [bucket, value] of Object.entries(bucketValues)) {
    if (value == null) continue;
    await queryDb(
      `UPDATE wealth.client_goals
       SET current_usd = $3, updated_at = now()
       WHERE client_id = $1 AND linked_bucket = $2::wealth.portfolio_bucket`,
      [clientId, bucket, value],
    );
  }
}

export async function enforceReviewDueStatus(): Promise<number> {
  const rows = await queryDb<{ id: string }>(
    `UPDATE wealth.clients
     SET status = 'review_due'
     WHERE next_review_date IS NOT NULL
       AND next_review_date < CURRENT_DATE
       AND status = 'active'
     RETURNING id`,
  );
  return rows.length;
}

export async function getNextSessionForClient(clientId: string): Promise<WmSession | null> {
  const rows = await queryDb<WmSession>(
    `SELECT id, client_id, advisor_id, session_request_id, title, scheduled_at::text,
            status::text, format, recap_topics, recap_decisions, recap_action_items,
            recap_next_steps, recap_logged_at::text, created_at::text
     FROM wealth.sessions
     WHERE client_id = $1
       AND scheduled_at >= now()
       AND status IN ('confirmed', 'requested')
     ORDER BY scheduled_at ASC
     LIMIT 1`,
    [clientId],
  );
  return rows[0] ? { ...rows[0], status: rows[0].status as WmSessionStatus } : null;
}

export function computeNextReviewDate(
  cadence: ReviewCadence,
  fromDate = new Date(),
): string {
  const d = new Date(fromDate);
  if (cadence === "quarterly") d.setMonth(d.getMonth() + 3);
  else if (cadence === "semi_annual") d.setMonth(d.getMonth() + 6);
  else d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

// Handover notes and internal documents
export async function listClientAdvisorNotes(
  clientId: string,
): Promise<ClientAdvisorNote[]> {
  const notes = await queryDb<
    Omit<ClientAdvisorNote, "attachments"> & { author_name: string }
  >(
    `SELECT n.id, n.client_id, n.author_user_id, n.author_advisor_id, n.body,
            n.created_at::text,
            COALESCE(a.full_name, p.full_name, 'Unknown') AS author_name
     FROM wealth.client_advisor_notes n
     LEFT JOIN wealth.profiles p ON p.id = n.author_user_id
     LEFT JOIN wealth.advisors a ON a.id = n.author_advisor_id
     WHERE n.client_id = $1
     ORDER BY n.created_at DESC`,
    [clientId],
  );

  const noteIds = notes.map((n) => n.id);
  if (noteIds.length === 0) return [];

  const attachments = await queryDb<ClientInternalDocument & { note_id: string }>(
    `SELECT na.note_id, d.id, d.client_id, d.title, d.description, d.storage_path,
            d.mime_type, d.file_size_bytes, d.uploaded_by, d.uploaded_by_advisor_id,
            d.created_at::text,
            COALESCE(a.full_name, p.full_name, 'Unknown') AS uploader_name
     FROM wealth.client_note_attachments na
     JOIN wealth.client_internal_documents d ON d.id = na.document_id
     LEFT JOIN wealth.profiles p ON p.id = d.uploaded_by
     LEFT JOIN wealth.advisors a ON a.id = d.uploaded_by_advisor_id
     WHERE na.note_id = ANY($1::uuid[])`,
    [noteIds],
  );

  const byNote = new Map<string, ClientInternalDocument[]>();
  for (const row of attachments) {
    const { note_id, ...doc } = row;
    const list = byNote.get(note_id) ?? [];
    list.push(doc);
    byNote.set(note_id, list);
  }

  return notes.map((n) => ({
    ...n,
    attachments: byNote.get(n.id) ?? [],
  }));
}

export async function insertClientAdvisorNote(row: {
  clientId: string;
  authorUserId: string;
  authorAdvisorId?: string | null;
  body: string;
  attachmentIds?: string[];
}): Promise<ClientAdvisorNote> {
  const rows = await queryDb<{ id: string }>(
    `INSERT INTO wealth.client_advisor_notes (client_id, author_user_id, author_advisor_id, body)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [row.clientId, row.authorUserId, row.authorAdvisorId ?? null, row.body],
  );
  const noteId = rows[0]!.id;

  for (const documentId of row.attachmentIds ?? []) {
    await queryDb(
      `INSERT INTO wealth.client_note_attachments (note_id, document_id) VALUES ($1, $2)`,
      [noteId, documentId],
    );
  }

  const list = await listClientAdvisorNotes(row.clientId);
  return list.find((n) => n.id === noteId)!;
}

export async function listClientInternalDocuments(
  clientId: string,
): Promise<ClientInternalDocument[]> {
  return queryDb<ClientInternalDocument>(
    `SELECT d.id, d.client_id, d.title, d.description, d.storage_path,
            d.mime_type, d.file_size_bytes, d.uploaded_by, d.uploaded_by_advisor_id,
            d.created_at::text,
            COALESCE(a.full_name, p.full_name, 'Unknown') AS uploader_name
     FROM wealth.client_internal_documents d
     LEFT JOIN wealth.profiles p ON p.id = d.uploaded_by
     LEFT JOIN wealth.advisors a ON a.id = d.uploaded_by_advisor_id
     WHERE d.client_id = $1
     ORDER BY d.created_at DESC`,
    [clientId],
  );
}

export async function getClientInternalDocument(
  documentId: string,
): Promise<ClientInternalDocument | null> {
  const rows = await queryDb<ClientInternalDocument>(
    `SELECT d.id, d.client_id, d.title, d.description, d.storage_path,
            d.mime_type, d.file_size_bytes, d.uploaded_by, d.uploaded_by_advisor_id,
            d.created_at::text,
            COALESCE(a.full_name, p.full_name, 'Unknown') AS uploader_name
     FROM wealth.client_internal_documents d
     LEFT JOIN wealth.profiles p ON p.id = d.uploaded_by
     LEFT JOIN wealth.advisors a ON a.id = d.uploaded_by_advisor_id
     WHERE d.id = $1`,
    [documentId],
  );
  return rows[0] ?? null;
}

export async function insertClientInternalDocument(row: {
  clientId: string;
  title: string;
  description?: string;
  storagePath: string;
  mimeType: string;
  fileSizeBytes: number;
  uploadedBy: string;
  uploadedByAdvisorId?: string | null;
}): Promise<ClientInternalDocument> {
  const rows = await queryDb<ClientInternalDocument>(
    `INSERT INTO wealth.client_internal_documents (
       client_id, title, description, storage_path, mime_type,
       file_size_bytes, uploaded_by, uploaded_by_advisor_id
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, client_id, title, description, storage_path,
               mime_type, file_size_bytes, uploaded_by, uploaded_by_advisor_id,
               created_at::text`,
    [
      row.clientId,
      row.title,
      row.description ?? "",
      row.storagePath,
      row.mimeType,
      row.fileSizeBytes,
      row.uploadedBy,
      row.uploadedByAdvisorId ?? null,
    ],
  );
  const doc = rows[0]!;
  const full = await getClientInternalDocument(doc.id);
  return full ?? { ...doc, uploader_name: "Unknown" };
}

export async function getDocumentRequestById(
  requestId: string,
  clientId: string,
): Promise<DocumentRequest | null> {
  const rows = await queryDb<DocumentRequest>(
    `SELECT id, client_id, advisor_id, title, description, due_date::text,
            status::text, created_at::text
     FROM wealth.document_requests
     WHERE id = $1 AND client_id = $2`,
    [requestId, clientId],
  );
  return rows[0] ?? null;
}

export async function getFirstPendingDocumentRequest(
  clientId: string,
): Promise<DocumentRequest | null> {
  const rows = await queryDb<DocumentRequest>(
    `SELECT id, client_id, advisor_id, title, description, due_date::text,
            status::text, created_at::text
     FROM wealth.document_requests
     WHERE client_id = $1 AND status = 'pending'
     ORDER BY due_date ASC NULLS LAST, created_at DESC
     LIMIT 1`,
    [clientId],
  );
  return rows[0] ?? null;
}

export async function insertVaultDocument(row: {
  clientId: string;
  title: string;
  category: string;
  storagePath: string;
  fileSizeBytes: number;
  mimeType: string;
  documentRequestId?: string | null;
  uploadedByRole: "client" | "advisor";
  uploadedBy?: string | null;
}): Promise<VaultDocument> {
  const rows = await queryDb<VaultDocument>(
    `INSERT INTO wealth.vault_documents (
       client_id, title, category, storage_path, file_size_bytes, mime_type,
       document_request_id, uploaded_by_role, uploaded_by
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id, client_id, title, category, storage_path, file_size_bytes,
               mime_type, expires_on::text, document_request_id, uploaded_by_role,
               created_at::text`,
    [
      row.clientId,
      row.title,
      row.category,
      row.storagePath,
      row.fileSizeBytes,
      row.mimeType,
      row.documentRequestId ?? null,
      row.uploadedByRole,
      row.uploadedBy ?? null,
    ],
  );
  return rows[0]!;
}

export async function fulfillDocumentRequest(requestId: string): Promise<void> {
  await queryDb(
    `UPDATE wealth.document_requests
     SET status = 'uploaded', updated_at = now()
     WHERE id = $1`,
    [requestId],
  );
}

export async function getVaultDocumentById(
  documentId: string,
  clientId: string,
): Promise<VaultDocument | null> {
  const rows = await queryDb<VaultDocument>(
    `SELECT id, client_id, title, category, storage_path, file_size_bytes,
            mime_type, expires_on::text, document_request_id, uploaded_by_role,
            created_at::text
     FROM wealth.vault_documents
     WHERE id = $1 AND client_id = $2`,
    [documentId, clientId],
  );
  return rows[0] ?? null;
}

export async function markThreadReadByClient(threadId: string): Promise<void> {
  await queryDb(
    `UPDATE wealth.message_threads SET client_last_read_at = now() WHERE id = $1`,
    [threadId],
  );
}

export async function getClientUnreadMessageCount(clientId: string): Promise<number> {
  const rows = await queryDb<{ count: string }>(
    `SELECT COUNT(*)::int AS count
     FROM wealth.messages m
     JOIN wealth.message_threads t ON t.id = m.thread_id
     WHERE t.client_id = $1
       AND m.sender_role = 'advisor'
       AND (t.client_last_read_at IS NULL OR m.created_at > t.client_last_read_at)`,
    [clientId],
  );
  return Number(rows[0]?.count ?? 0);
}

/** Aggregate portfolio history across an advisor's book by recorded date. */
export async function getBookAumHistory(
  advisorId?: string | null,
): Promise<BookAumHistoryPoint[]> {
  // Month-end forward-fill so each point reflects the full book, not only
  // clients that share an identical history stamp. Statements are the source of
  // truth (they feed the reports and the book total), so a client's history
  // points are used only when that client has no statements yet. The last point
  // then matches the book total built from the latest statements.
  const rows = await queryDb<{ recorded_on: string; total: string }>(
    `WITH scoped_clients AS (
       SELECT id
       FROM wealth.clients
       WHERE ($1::uuid IS NULL OR advisor_id = $1)
     ),
     points AS (
       SELECT h.client_id, h.recorded_on::date AS on_date, h.total_value_usd AS value, 1 AS source_rank
       FROM wealth.portfolio_history h
       JOIN scoped_clients c ON c.id = h.client_id
       WHERE NOT EXISTS (
         SELECT 1 FROM wealth.statement_periods sp WHERE sp.client_id = h.client_id
       )
       UNION ALL
       SELECT sp.client_id, sp.period_end::date, SUM(ps.current_value_usd), 0
       FROM wealth.statement_periods sp
       JOIN scoped_clients c ON c.id = sp.client_id
       JOIN wealth.portfolio_snapshots ps ON ps.period_id = sp.id
       GROUP BY sp.client_id, sp.period_end
     ),
     months AS (
       SELECT DISTINCT date_trunc('month', on_date)::date AS month_start
       FROM points
     ),
     filled AS (
       SELECT
         m.month_start,
         c.id AS client_id,
         (
           SELECT p.value
           FROM points p
           WHERE p.client_id = c.id
             AND p.on_date < (m.month_start + interval '1 month')
           ORDER BY p.on_date DESC, p.source_rank ASC
           LIMIT 1
         ) AS value
       FROM months m
       CROSS JOIN scoped_clients c
     )
     SELECT month_start::text AS recorded_on, COALESCE(SUM(value), 0)::float8 AS total
     FROM filled
     GROUP BY month_start
     ORDER BY month_start ASC`,
    [advisorId ?? null],
  );
  return rows.map((r) => {
    const recordedOn = r.recorded_on;
    return {
      recordedOn,
      month: new Date(`${recordedOn.slice(0, 10)}T12:00:00`).toLocaleDateString(
        "en-GB",
        {
          month: "short",
          year: "2-digit",
        },
      ),
      value: Number(r.total),
    };
  });
}

/** Latest statement allocation rolled up across the book by portfolio bucket. */
export async function getBookAllocation(
  advisorId?: string | null,
): Promise<BookAllocationSlice[]> {
  const rows = await queryDb<{ bucket: PortfolioBucket; value: string }>(
    `WITH latest_period AS (
       SELECT DISTINCT ON (client_id) id, client_id
       FROM wealth.statement_periods
       ORDER BY client_id, period_end DESC
     )
     SELECT ps.bucket, COALESCE(SUM(ps.current_value_usd), 0)::float8 AS value
     FROM wealth.portfolio_snapshots ps
     JOIN latest_period lp ON lp.id = ps.period_id AND lp.client_id = ps.client_id
     JOIN wealth.clients c ON c.id = ps.client_id
     WHERE ($1::uuid IS NULL OR c.advisor_id = $1)
     GROUP BY ps.bucket`,
    [advisorId ?? null],
  );

  const byBucket = new Map(rows.map((r) => [r.bucket, Number(r.value)]));
  const total = [...byBucket.values()].reduce((sum, v) => sum + v, 0);
  const order: PortfolioBucket[] = ["income", "growth", "venture", "treasury", "coa"];

  return order.map((bucket) => {
    const value = byBucket.get(bucket) ?? 0;
    return {
      bucket,
      label: BUCKET_LABELS[bucket],
      shortLabel: BUCKET_SHORT_LABELS[bucket],
      value,
      pct: total > 0 ? (value / total) * 100 : 0,
    };
  });
}

/** Dominant portfolio bucket per client (largest current value on latest statement). */
export async function getClientPrimaryBuckets(
  advisorId?: string | null,
): Promise<Map<string, PortfolioBucket>> {
  const rows = await queryDb<{ client_id: string; bucket: PortfolioBucket }>(
    `WITH latest_period AS (
       SELECT DISTINCT ON (client_id) id, client_id
       FROM wealth.statement_periods
       ORDER BY client_id, period_end DESC
     ),
     ranked AS (
       SELECT ps.client_id, ps.bucket,
         ROW_NUMBER() OVER (
           PARTITION BY ps.client_id
           ORDER BY ps.current_value_usd DESC, ps.bucket ASC
         ) AS rn
       FROM wealth.portfolio_snapshots ps
       JOIN latest_period lp ON lp.id = ps.period_id AND lp.client_id = ps.client_id
       JOIN wealth.clients c ON c.id = ps.client_id
       WHERE ($1::uuid IS NULL OR c.advisor_id = $1)
     )
     SELECT client_id, bucket FROM ranked WHERE rn = 1`,
    [advisorId ?? null],
  );
  return new Map(rows.map((r) => [r.client_id, r.bucket]));
}

/** Upcoming confirmed sessions for the advisor book. */
export async function listUpcomingSessions(
  advisorId?: string | null,
  limit = 5,
): Promise<WmSession[]> {
  const rows = await queryDb<WmSession & { client_name: string }>(
    `SELECT s.id, s.client_id, s.advisor_id, s.session_request_id,
            s.title, s.scheduled_at::text, s.status::text, s.format,
            s.recap_topics, s.recap_decisions, s.recap_action_items, s.recap_next_steps,
            s.recap_logged_at::text, s.created_at::text,
            c.full_name AS client_name
     FROM wealth.sessions s
     JOIN wealth.clients c ON c.id = s.client_id
     WHERE s.scheduled_at >= now()
       AND s.status = 'confirmed'
       AND ($1::uuid IS NULL OR s.advisor_id = $1)
     ORDER BY s.scheduled_at ASC
     LIMIT $2`,
    [advisorId ?? null, limit],
  );
  return rows.map((r) => ({
    ...r,
    status: r.status as WmSessionStatus,
    recap_topics: r.recap_topics ?? [],
    recap_decisions: r.recap_decisions ?? [],
    recap_action_items: r.recap_action_items ?? [],
    recap_next_steps: r.recap_next_steps ?? [],
  }));
}

/** Recent client update events across the advisor book. */
export async function listRecentBookActivity(
  advisorId?: string | null,
  limit = 8,
): Promise<BookActivityItem[]> {
  const rows = await queryDb<{
    id: string;
    client_id: string;
    client_name: string;
    kind: string;
    title: string;
    created_at: string;
  }>(
    `SELECT u.id, u.client_id, c.full_name AS client_name,
            u.kind::text, u.title, u.created_at::text
     FROM wealth.client_updates u
     JOIN wealth.clients c ON c.id = u.client_id
     WHERE ($1::uuid IS NULL OR c.advisor_id = $1)
     ORDER BY u.created_at DESC
     LIMIT $2`,
    [advisorId ?? null, limit],
  );
  return rows.map((r) => ({
    id: r.id,
    clientId: r.client_id,
    clientName: r.client_name,
    kind: r.kind,
    title: r.title,
    createdAt: r.created_at,
  }));
}

/** Group identical attention items so the overview stays scannable. */
export function aggregateAttentionGroups(
  items: AttentionItem[],
  outstanding: OutstandingReport[],
): AttentionGroup[] {
  const groups: AttentionGroup[] = [];

  const byKind = {
    monthly: outstanding.filter((r) => r.kind === "monthly").length,
    quarterly: outstanding.filter((r) => r.kind === "quarterly").length,
    annual: outstanding.filter((r) => r.kind === "annual").length,
  };
  if (byKind.monthly > 0) {
    groups.push({
      key: "monthly-statements",
      label: "Monthly statements",
      count: byKind.monthly,
      href: "/advisors/dashboard/reports",
      urgent: false,
    });
  }
  if (byKind.quarterly > 0) {
    groups.push({
      key: "quarterly-statements",
      label: "Quarterly statements",
      count: byKind.quarterly,
      href: "/advisors/dashboard/reports",
      urgent: false,
    });
  }
  if (byKind.annual > 0) {
    groups.push({
      key: "annual-statements",
      label: "Annual statements",
      count: byKind.annual,
      href: "/advisors/dashboard/reports",
      urgent: false,
    });
  }

  const reviews = items.filter((i) => i.type === "review_due");
  if (reviews.length > 0) {
    groups.push({
      key: "reviews",
      label: "Client reviews due",
      count: reviews.length,
      href: "/advisors/dashboard/clients",
      urgent: true,
    });
  }

  const sessionRequests = items.filter((i) => i.type === "session_request");
  if (sessionRequests.length > 0) {
    groups.push({
      key: "session-requests",
      label: "Session requests",
      count: sessionRequests.length,
      href: "/advisors/dashboard/sessions",
      urgent: false,
    });
  }

  const recaps = items.filter((i) => i.type === "recap_backlog");
  if (recaps.length > 0) {
    groups.push({
      key: "recaps",
      label: "Session recaps needed",
      count: recaps.length,
      href: "/advisors/dashboard/sessions",
      urgent: false,
    });
  }

  const docs = items.filter((i) => i.type === "document_request" || i.type === "document_expiry");
  if (docs.length > 0) {
    groups.push({
      key: "documents",
      label: "Document follow-ups",
      count: docs.length,
      href: "/advisors/dashboard/documents",
      urgent: false,
    });
  }

  const messages = items.filter((i) => i.type === "message");
  if (messages.length > 0) {
    const count = messages.reduce((sum, item) => {
      const match = item.title.match(/^(\d+)/);
      return sum + (match ? Number(match[1]) : 1);
    }, 0);
    groups.push({
      key: "messages",
      label: "Unread client messages",
      count,
      href: "/advisors/dashboard/messages",
      urgent: false,
    });
  }

  return groups;
}
