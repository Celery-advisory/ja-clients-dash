import { type ReactElement } from "react";
import { render, toPlainText } from "react-email";
import { Resend } from "resend";

import { firstNameFrom } from "@/lib/email/helpers";
import { AdvisorInviteEmail } from "@/lib/email/templates/advisor-invite";
import { ClientUpdateEmail } from "@/lib/email/templates/client-update";
import { OtpEmail } from "@/lib/email/templates/otp";
import { PortalInviteEmail } from "@/lib/email/templates/portal-invite";
import { ReportReadyEmail } from "@/lib/email/templates/report-ready";

const apiKey = process.env.RESEND_API_KEY;

function resolveFromEmail() {
  const raw = process.env.RESEND_FROM_EMAIL?.trim();
  if (!raw || !raw.includes("@")) {
    return "JA Wealth <noreply@no-reply.celerey.co>";
  }
  if (raw.includes("<")) return raw;
  return `JA Wealth <${raw}>`;
}

export const resendFromEmail = resolveFromEmail();

export function getResendClient() {
  if (!apiKey) {
    throw new Error("Missing RESEND_API_KEY");
  }
  return new Resend(apiKey);
}

function sanitizeEmailHtml(html: string) {
  return html
    .replace(/\u0000/g, "")
    .replace(/<!--(?:\$|\/\$|html|head|body)-->/g, "");
}

async function sendRenderedEmail(params: {
  to: string;
  subject: string;
  react: ReactElement;
}) {
  const resend = getResendClient();
  const html = sanitizeEmailHtml(await render(params.react));
  const { error } = await resend.emails.send({
    from: resendFromEmail,
    to: params.to,
    subject: params.subject,
    html,
    text: toPlainText(html),
    headers: {
      "X-Entity-Ref-ID": crypto.randomUUID(),
    },
  });
  if (error) throw new Error(error.message);
}

export async function sendOtpEmail({ to, token }: { to: string; token: string }) {
  await sendRenderedEmail({
    to,
    subject: "Your JA Wealth sign-in code",
    react: OtpEmail({ token }),
  });
}

export async function sendPortalInviteEmail(params: {
  to: string;
  clientName: string;
  clientNumber: string;
  loginUrl: string;
}) {
  await sendRenderedEmail({
    to: params.to,
    subject: "Your JA Wealth client portal is ready",
    react: PortalInviteEmail({
      firstName: firstNameFrom(params.clientName),
      clientNumber: params.clientNumber,
      loginUrl: params.loginUrl,
    }),
  });
}

export async function sendAdvisorPortalInviteEmail(params: {
  to: string;
  advisorName: string;
  loginUrl: string;
  isAdmin?: boolean;
}) {
  await sendRenderedEmail({
    to: params.to,
    subject: "Your JA Wealth wealth manager portal is ready",
    react: AdvisorInviteEmail({
      firstName: firstNameFrom(params.advisorName),
      loginUrl: params.loginUrl,
      isAdmin: params.isAdmin,
    }),
  });
}

export async function sendClientUpdateEmail(params: {
  to: string;
  clientName: string;
  title: string;
  body: string;
  loginUrl: string;
}) {
  await sendRenderedEmail({
    to: params.to,
    subject: params.title,
    react: ClientUpdateEmail({
      firstName: firstNameFrom(params.clientName),
      title: params.title,
      body: params.body,
      loginUrl: params.loginUrl,
    }),
  });
}

export async function sendReportReadyEmail(params: {
  to: string;
  clientName: string;
  clientNumber: string;
  periodLabel: string;
  kindTitle: string;
  asOfLabel: string;
  reportUrl: string;
  portalUrl: string;
  advisorEmail: string | null;
  advisorName: string | null;
  totalValueUsd?: number;
  periodGainUsd?: number;
  periodReturnPct?: number | null;
  sinceStartGainUsd?: number | null;
  sinceStartPct?: number | null;
}) {
  await sendRenderedEmail({
    to: params.to,
    subject: `Your ${params.periodLabel} report is ready`,
    react: ReportReadyEmail({
      firstName: firstNameFrom(params.clientName),
      periodLabel: params.periodLabel,
      kindTitle: params.kindTitle,
      asOfLabel: params.asOfLabel,
      reportUrl: params.reportUrl,
      portalUrl: params.portalUrl,
      advisorEmail: params.advisorEmail,
      advisorName: params.advisorName,
      clientNumber: params.clientNumber,
      totalValueUsd: params.totalValueUsd,
      periodGainUsd: params.periodGainUsd,
      periodReturnPct: params.periodReturnPct,
      sinceStartGainUsd: params.sinceStartGainUsd,
      sinceStartPct: params.sinceStartPct,
    }),
  });
}
