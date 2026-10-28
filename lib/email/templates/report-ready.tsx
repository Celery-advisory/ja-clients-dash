import { Button, Column, Link, Row, Section, Text } from "react-email";

import {
  EmailBodyText,
  EmailFooterNote,
  EmailHeading,
  EmailShell,
  emailButtonStyle,
  emailColors,
} from "@/lib/email/shell";

export type ReportReadyEmailProps = {
  firstName: string;
  periodLabel: string;
  kindTitle: string;
  asOfLabel: string;
  reportUrl: string;
  portalUrl: string;
  advisorEmail: string | null;
  advisorName: string | null;
  clientNumber: string;
  totalValueUsd?: number;
  periodGainUsd?: number;
  periodReturnPct?: number | null;
  sinceStartGainUsd?: number | null;
  sinceStartPct?: number | null;
};

function usd(value: number) {
  return `$${Math.round(Math.abs(value)).toLocaleString("en-US")}`;
}

function signedUsd(value: number) {
  return `${value < 0 ? "-" : "+"}${usd(value)}`;
}

function signedPct(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return null;
  return `${value < 0 ? "-" : "+"}${Math.abs(value).toFixed(1)}%`;
}

function HighlightCard({
  label,
  value,
  background,
  labelColor,
}: {
  label: string;
  value: string;
  background: string;
  labelColor: string;
}) {
  return (
    <Section
      style={{
        backgroundColor: background,
        padding: "12px",
      }}
    >
      <Text
        style={{
          fontSize: "11px",
          color: labelColor,
          margin: "0 0 3px",
          letterSpacing: "0.04em",
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          fontSize: "17px",
          fontWeight: 500,
          margin: 0,
          color: emailColors.ink,
        }}
      >
        {value}
      </Text>
    </Section>
  );
}

export function ReportReadyEmail({
  firstName,
  periodLabel,
  kindTitle,
  asOfLabel,
  reportUrl,
  portalUrl,
  advisorEmail,
  advisorName,
  clientNumber,
  totalValueUsd,
  periodGainUsd,
  periodReturnPct,
  sinceStartGainUsd,
  sinceStartPct,
}: ReportReadyEmailProps) {
  const hasNumbers = typeof totalValueUsd === "number" && typeof periodGainUsd === "number";
  const periodChange = hasNumbers
    ? [signedUsd(periodGainUsd), signedPct(periodReturnPct)].filter(Boolean).join(" · ")
    : null;
  const sinceStart =
    sinceStartGainUsd != null
      ? [signedUsd(sinceStartGainUsd), signedPct(sinceStartPct)].filter(Boolean).join(" · ")
      : null;
  const contactName = advisorName ?? "your wealth manager";
  const contactLine = advisorEmail ? (
    <>
      Questions about this report? Reach {contactName} directly at{" "}
      <Link href={`mailto:${advisorEmail}`} style={{ color: emailColors.navy }}>
        {advisorEmail}
      </Link>
      .
    </>
  ) : (
    <>
      Questions about this report? Message {contactName} from your JA Wealth
      portal.
    </>
  );

  return (
    <EmailShell
      preview={`Your ${periodLabel} report is ready in the JA Wealth portal. Open it to review the full statement.`}
      footer={
        <EmailFooterNote contactLine={contactLine} clientNumber={clientNumber} />
      }
    >
      <EmailHeading>Your {periodLabel} report is ready</EmailHeading>
      <EmailBodyText>
        Hello {firstName}, here&apos;s your {kindTitle.toLowerCase()} as of {asOfLabel}.
      </EmailBodyText>

      {hasNumbers ? (
        <Row style={{ marginBottom: "16px" }}>
          <Column style={{ width: "34%", paddingRight: "5px", verticalAlign: "top" }}>
            <HighlightCard
              label="PORTFOLIO VALUE"
              value={usd(totalValueUsd)}
              background={emailColors.cream}
              labelColor={emailColors.creamLabel}
            />
          </Column>
          <Column style={{ width: "33%", padding: "0 5px", verticalAlign: "top" }}>
            <HighlightCard
              label="THIS PERIOD"
              value={periodChange ?? ""}
              background={emailColors.sage}
              labelColor={emailColors.sageLabel}
            />
          </Column>
          <Column style={{ width: "33%", paddingLeft: "5px", verticalAlign: "top" }}>
            <HighlightCard
              label="SINCE YOU STARTED"
              value={sinceStart ?? "Not yet available"}
              background={emailColors.cream}
              labelColor={emailColors.creamLabel}
            />
          </Column>
        </Row>
      ) : (
        <Row style={{ marginBottom: "16px" }}>
          <Column style={{ width: "50%", paddingRight: "5px", verticalAlign: "top" }}>
            <HighlightCard
              label="PERIOD"
              value={periodLabel}
              background={emailColors.cream}
              labelColor={emailColors.creamLabel}
            />
          </Column>
          <Column style={{ width: "50%", paddingLeft: "5px", verticalAlign: "top" }}>
            <HighlightCard
              label="STATUS"
              value="Ready to view"
              background={emailColors.sage}
              labelColor={emailColors.sageLabel}
            />
          </Column>
        </Row>
      )}

      <EmailBodyText
        style={{ color: "#333333", margin: "0 0 18px" }}
      >
        Your full report has the breakdown by portfolio, performance since you
        started, and recent transactions.
      </EmailBodyText>

      <Button href={reportUrl} style={emailButtonStyle}>
        View your report
      </Button>
      <Text style={{ fontSize: "12px", margin: "8px 0 0" }}>
        <Link href={portalUrl} style={{ color: emailColors.muted }}>
          Or view it in your JA Wealth portal
        </Link>
      </Text>
    </EmailShell>
  );
}

ReportReadyEmail.PreviewProps = {
  firstName: "John",
  periodLabel: "Q2 2026",
  kindTitle: "Quarterly statement",
  asOfLabel: "30 June",
  reportUrl: "https://example.com/clients/dashboard/reports",
  portalUrl: "https://example.com/clients/dashboard",
  advisorEmail: "hello@jagroup.co",
  advisorName: "your wealth manager",
  clientNumber: "CN000",
  totalValueUsd: 186413,
  periodGainUsd: 35413,
  periodReturnPct: 14.5,
  sinceStartGainUsd: 35413,
  sinceStartPct: 24.4,
} satisfies ReportReadyEmailProps;

export default ReportReadyEmail;
