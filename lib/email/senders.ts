/**
 * Who each kind of email comes from. Every address sits on one domain verified in
 * Resend (RESEND_FROM_DOMAIN, for example no-reply.jagroup.co), so any mailbox name
 * on it can send without extra DNS records:
 *
 *   auth     JA Wealth <auth@no-reply.jagroup.co>         sign-in codes
 *   reports  JA Wealth Reports <reports@no-reply.jagroup.co>  report-ready emails
 *   updates  JA Wealth <updates@no-reply.jagroup.co>      portfolio and account updates
 *   invites  JA Wealth <welcome@no-reply.jagroup.co>      client and wealth manager invites
 *
 * Any one can be overridden with RESEND_FROM_AUTH, RESEND_FROM_REPORTS,
 * RESEND_FROM_UPDATES or RESEND_FROM_INVITES. Without a domain, RESEND_FROM_EMAIL
 * (the old single sender) is used for everything.
 */
export type EmailKind = "auth" | "reports" | "updates" | "invites";

const DEFAULT_NAME = "JA Wealth";
const LEGACY_FALLBACK = "JA Wealth <noreply@no-reply.celerey.co>";

const DEFAULTS: Record<EmailKind, { mailbox: string; name: string; override: string }> = {
  auth: { mailbox: "auth", name: DEFAULT_NAME, override: "RESEND_FROM_AUTH" },
  reports: { mailbox: "reports", name: `${DEFAULT_NAME} Reports`, override: "RESEND_FROM_REPORTS" },
  updates: { mailbox: "updates", name: DEFAULT_NAME, override: "RESEND_FROM_UPDATES" },
  invites: { mailbox: "welcome", name: DEFAULT_NAME, override: "RESEND_FROM_INVITES" },
};

/** "a@b.co" becomes "Name <a@b.co>"; a value that already has a name is kept as it is. */
function withName(address: string, name: string) {
  return address.includes("<") ? address : `${name} <${address}>`;
}

function envAddress(key: string) {
  const value = process.env[key]?.trim();
  return value && value.includes("@") ? value : null;
}

export function senderFor(kind: EmailKind): string {
  const spec = DEFAULTS[kind];
  const override = envAddress(spec.override);
  if (override) return withName(override, spec.name);

  const domain = process.env.RESEND_FROM_DOMAIN?.trim().replace(/^@/, "");
  if (domain) return `${spec.name} <${spec.mailbox}@${domain}>`;

  const legacy = envAddress("RESEND_FROM_EMAIL");
  return legacy ? withName(legacy, DEFAULT_NAME) : LEGACY_FALLBACK;
}
