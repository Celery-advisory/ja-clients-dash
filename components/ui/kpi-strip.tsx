// components/ui/kpi-strip.tsx
//
// Reusable KPI grid used on every dashboard tab.
// Visual style is driven by lib/dashboard-theme.ts.

import * as React from "react";
import { TrendingDown, TrendingUp } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { dashboardTheme, kpiSurfaceTones } from "@/lib/dashboard-theme";
import { cn } from "@/lib/utils";

export type KpiTone = "good" | "warning" | "danger" | "neutral";
export type KpiSurface = keyof typeof kpiSurfaceTones;

export type KpiItemData = {
  label: string;
  value: string;
  subline?: string;
  tone?: KpiTone;
  surface?: KpiSurface;
  icon?: React.ReactNode;
  onClick?: () => void;
};

const toneClass: Record<KpiTone, string> = {
  good: "text-emerald-800 dark:text-green-400",
  warning: "text-amber-700 dark:text-amber-400",
  danger: "text-destructive dark:text-red-400",
  neutral: "text-brand-primary",
};

const SURFACE_CYCLE: KpiSurface[] = ["navy", "gold", "sage", "warm"];

interface KpiStripProps extends React.ComponentProps<"div"> {
  cols?: 2 | 3 | 4 | 5 | 6;
  loading?: boolean;
  items?: KpiItemData[];
  /** Soft brand tints across tiles, matching Overview metric cards. */
  tinted?: boolean;
}

function KpiStrip({
  className,
  cols,
  loading,
  items,
  tinted = true,
  children,
  ...props
}: KpiStripProps) {
  const colsClass =
    cols === 2
      ? "grid-cols-1 sm:grid-cols-2"
      : cols === 3
        ? "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3"
        : cols === 5
          ? "grid-cols-2 sm:grid-cols-3 xl:grid-cols-5"
          : cols === 6
            ? "grid-cols-2 sm:grid-cols-3 xl:grid-cols-6"
            : "grid-cols-2 sm:grid-cols-2 lg:grid-cols-4";

  return (
    <div
      data-slot="kpi-strip"
      className={cn("grid gap-2.5", colsClass, className)}
      {...props}
    >
      {items
        ? items.map((item, index) => (
            <KpiItem
              key={item.label}
              label={item.label}
              value={item.value}
              subline={item.subline}
              tone={item.tone}
              surface={item.surface ?? (tinted ? SURFACE_CYCLE[index % SURFACE_CYCLE.length] : "plain")}
              icon={item.icon}
              loading={loading}
              onClick={item.onClick}
            />
          ))
        : React.Children.map(children, (child, index) => {
            if (!React.isValidElement<KpiItemProps>(child) || !tinted) return child;
            const existing = child.props.surface;
            if (existing) return child;
            return React.cloneElement(child, {
              surface: SURFACE_CYCLE[index % SURFACE_CYCLE.length],
            });
          })}
    </div>
  );
}

interface KpiItemProps extends React.ComponentProps<"div"> {
  label: string;
  value: string;
  subline?: string;
  change?: string;
  tone?: KpiTone;
  surface?: KpiSurface;
  trend?: "up" | "down" | "neutral";
  emphasis?: "primary";
  icon?: React.ReactNode;
  loading?: boolean;
}

function KpiItem({
  className,
  label,
  value,
  subline,
  change,
  tone,
  surface = "plain",
  trend,
  emphasis,
  icon,
  loading,
  onClick,
  ...props
}: KpiItemProps) {
  const resolvedTone: KpiTone =
    tone ?? (trend === "up" ? "good" : trend === "down" ? "danger" : "neutral");

  const descriptor = subline ?? change;
  const TrendIcon =
    trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : null;

  return (
    <div
      data-slot="kpi-item"
      onClick={loading ? undefined : onClick}
      className={cn(
        dashboardTheme.kpiTile,
        "flex flex-col gap-1 px-3.5 py-3",
        kpiSurfaceTones[surface],
        emphasis === "primary" && "border-brand-primary/25",
        onClick && !loading && "cursor-pointer transition-colors hover:border-brand-accent/60",
        className,
      )}
      {...props}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
          {label}
        </p>
        {icon ? (
          <div className="flex size-5 shrink-0 items-center justify-center text-brand-primary/70 [&_svg]:size-3.5">
            {icon}
          </div>
        ) : null}
      </div>

      {loading ? (
        <>
          <Skeleton className="mt-1 h-5 w-20" />
          <Skeleton className="mt-1 h-3 w-28" />
        </>
      ) : (
        <>
          <p
            className={cn(
              "font-display text-[1.45rem] font-medium leading-tight tabular-nums sm:text-[1.6rem]",
              toneClass[resolvedTone],
            )}
          >
            {value}
          </p>

          {descriptor ? (
            <div className="flex items-center gap-1">
              {TrendIcon ? (
                <TrendIcon
                  className={cn(
                    "size-3",
                    resolvedTone === "good" && "text-emerald-700",
                    resolvedTone === "danger" && "text-destructive",
                    resolvedTone === "neutral" && "text-muted-foreground",
                  )}
                />
              ) : null}
              <p className="text-[11px] text-muted-foreground">{descriptor}</p>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

export { KpiItem, KpiStrip };
