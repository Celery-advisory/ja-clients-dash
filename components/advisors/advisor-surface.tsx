import type { ReactNode } from "react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { H1, H3, Muted } from "@/components/ui/typography";
import { cn } from "@/lib/utils";

/** Shared advisor portal surfaces. Keep Overview and other pages on one system. */

export const advisorSurface = {
  card: "rounded-xl border border-border bg-card shadow-[0_1px_2px_rgba(28,25,25,0.03)]",
  cardPadding: "p-3.5 sm:p-4",
  pageGap: "flex flex-col gap-4 md:gap-5 py-5 md:py-6",
  sectionTitle: "font-heading text-[1.2rem] font-medium text-brand-primary",
  pageTitle: "text-[1.75rem] text-brand-primary sm:text-[2rem]",
  pageSubtitle: "mt-0.5 max-w-2xl text-[13px]",
} as const;

export type MetricTone = "navy" | "gold" | "sage" | "warm";

/** Summary cards share one white surface; tone only tints the small icon, so no card shouts. */
export const METRIC_TONES: Record<
  MetricTone,
  { card: string; icon: string }
> = {
  navy: { card: "bg-card border-border", icon: "text-brand-primary/70" },
  gold: { card: "bg-card border-border", icon: "text-brand-accent" },
  sage: { card: "bg-card border-border", icon: "text-[#5f7340]" },
  warm: { card: "bg-card border-border", icon: "text-[#a34844]" },
};

export function SurfaceCard({
  children,
  className,
  tint,
  padding = true,
}: {
  children: ReactNode;
  className?: string;
  tint?: string;
  padding?: boolean;
}) {
  return (
    <div
      className={cn(
        advisorSurface.card,
        padding && advisorSurface.cardPadding,
        tint,
        className,
      )}
    >
      {children}
    </div>
  );
}

export function AdvisorPageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <H1 className={advisorSurface.pageTitle}>{title}</H1>
        {description ? (
          <Muted className={advisorSurface.pageSubtitle}>{description}</Muted>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-1.5">{actions}</div> : null}
    </header>
  );
}

export function AdvisorSectionHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mb-3 flex flex-col gap-0.5 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div>
        <H3 className={advisorSurface.sectionTitle}>{title}</H3>
        {subtitle ? <Muted className="mt-0.5 text-[12px]">{subtitle}</Muted> : null}
      </div>
      {action}
    </div>
  );
}

export function MetricCard({
  label,
  value,
  detail,
  tone = "navy",
  icon,
  valueClassName,
  href,
}: {
  label: string;
  value: string;
  detail?: string;
  tone?: MetricTone;
  icon?: ReactNode;
  valueClassName?: string;
  href?: string;
}) {
  const tones = METRIC_TONES[tone];
  const content = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
          {label}
        </p>
        {icon ? (
          <span className={cn("flex size-5 shrink-0 items-center justify-center", tones.icon)}>
            {icon}
          </span>
        ) : null}
      </div>
      <p
        className={cn(
          "mt-1 font-display text-[1.6rem] font-medium leading-tight tabular-nums text-brand-primary sm:text-[1.75rem]",
          valueClassName,
        )}
      >
        {value}
      </p>
      {detail ? <p className="text-xs text-muted-foreground">{detail}</p> : null}
    </>
  );

  const className = cn(
    "relative flex flex-col gap-1 rounded-xl border px-4 py-4 shadow-[0_1px_2px_rgba(28,25,25,0.03)]",
    tones.card,
    href && "transition-colors hover:border-brand-accent/60",
  );

  if (href) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    );
  }

  return <div className={className}>{content}</div>;
}

export function advisorPrimaryAction(className?: string) {
  return cn(buttonVariants({ size: "xs" }), className);
}

export function advisorSecondaryAction(className?: string) {
  return cn(buttonVariants({ variant: "outline", size: "xs" }), className);
}
