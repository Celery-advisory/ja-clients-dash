// Central design tokens for the dashboard UI.
// Edit these values to restyle components globally across the app.

export const dashboardTheme = {
  // Applied to every KPI tile. Matches advisor MetricCard density.
  kpiTile:
    "rounded-xl border border-border/70 bg-card shadow-[0_1px_2px_rgba(32,35,86,0.03)]",
} as const;

/** Every summary tile sits on the same white surface; colour is kept for the figures themselves. */
export const kpiSurfaceTones = {
  navy: "border-border bg-card",
  gold: "border-border bg-card",
  sage: "border-border bg-card",
  warm: "border-border bg-card",
  plain: "border-border bg-card",
} as const;
