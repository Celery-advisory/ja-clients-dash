"use client";

import { ClientContactActions } from "@/components/clients/client-contact-actions";
import { useCurrency } from "@/lib/currency-context";
import { cn } from "@/lib/utils";

type ClientOverviewHeroProps = {
  totalUSD: number;
  ytdPct: number;
  periodGainUsd: number;
  loading?: boolean;
};

export function ClientOverviewHero({
  totalUSD,
  ytdPct,
  periodGainUsd,
  loading,
}: ClientOverviewHeroProps) {
  const { format } = useCurrency();

  if (loading) {
    return (
      <div className="animate-pulse rounded-2xl bg-brand-primary/20 px-6 py-8">
        <div className="mb-2 h-3 w-32 rounded bg-white/20" />
        <div className="h-9 w-48 rounded bg-white/20" />
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-brand-primary px-5 py-5 text-white sm:px-6 sm:py-6">
      <p className="text-xs font-medium tracking-wide text-brand-accent">
        TOTAL PORTFOLIO VALUE
      </p>
      <div className="mt-1 flex flex-wrap items-baseline gap-2 sm:gap-3">
        <p className="font-numeric text-3xl font-medium">{format(totalUSD)}</p>
        <span
          className={cn(
            "font-numeric text-sm",
            ytdPct >= 0 ? "text-emerald-300" : "text-red-300",
          )}
        >
          {ytdPct >= 0 ? "+" : ""}
          {ytdPct.toFixed(1)}% YTD
        </span>
      </div>
      <p className="mt-2 text-xs text-white/70">
        {periodGainUsd >= 0 ? "Up" : "Down"} {format(Math.abs(periodGainUsd))} this period
      </p>
    </div>
  );
}

export function ClientOverviewEmptyHero() {
  return (
    <div className="rounded-2xl bg-brand-primary px-5 py-5 text-white sm:px-6 sm:py-6">
      <p className="text-xs font-medium tracking-wide text-brand-accent">
        TOTAL PORTFOLIO VALUE
      </p>
      <p className="mt-3 text-lg font-medium">Your portfolio is not set up yet</p>
      <p className="mt-1 max-w-lg text-sm leading-relaxed text-white/70">
        Get in touch with us or your wealth manager and we will add your holdings, values, and
        performance here.
      </p>
      <ClientContactActions
        className="mt-4"
        onDark
        primaryClassName="bg-brand-accent text-brand-primary hover:bg-brand-accent/90"
      />
    </div>
  );
}
