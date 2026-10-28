import { Path, Svg, Text as SvgText, Text, View } from "@react-pdf/renderer";

import type { InvestmentReportData } from "@/lib/reports/types";
import type { PortfolioBucket } from "@/lib/wealth/types";
import {
  colors,
  fonts,
  REPORT_BUCKET_COLORS,
  reportStyles,
} from "@/lib/reports/pdf/report-theme";

function allocationLegendLabel(bucket: PortfolioBucket, label: string) {
  if (bucket === "coa") return "COA";
  return label;
}

function finiteCoord(value: number) {
  return Number.isFinite(value) ? value : 0;
}

type PieSegment = {
  bucket: PortfolioBucket;
  label: string;
  pct: number;
  color: string;
  d: string;
  labelX: number;
  labelY: number;
};

/** Pie with percentage labels inside each slice and a single-row legend beneath, as on the template. */
export function AllocationChart({
  slices,
  radius = 98,
}: {
  slices: InvestmentReportData["allocationSlices"];
  radius?: number;
}) {
  const activeSlices = slices.filter(
    (slice) => Number.isFinite(slice.allocationPct) && slice.allocationPct > 0.05,
  );

  if (activeSlices.length === 0) {
    return <Text style={reportStyles.emptyRow}>No allocation data for this statement.</Text>;
  }

  const pctTotal = activeSlices.reduce((sum, slice) => sum + slice.allocationPct, 0);
  const size = radius * 2 + 4;
  const cx = size / 2;
  const cy = size / 2;

  // Slices run clockwise from twelve o'clock.
  const segments = activeSlices.reduce<{ startPct: number; items: PieSegment[] }>(
    (acc, slice) => {
      const pct = pctTotal > 0 ? (slice.allocationPct / pctTotal) * 100 : 0;
      const start = (acc.startPct / 100) * 2 * Math.PI - Math.PI / 2;
      const end = ((acc.startPct + pct) / 100) * 2 * Math.PI - Math.PI / 2;
      const color = REPORT_BUCKET_COLORS[slice.bucket] ?? slice.color;
      const mid = (start + end) / 2;
      // A full circle cannot be drawn as one arc, so it becomes two half arcs.
      const d =
        pct >= 99.95
          ? `M ${cx} ${cy - radius} A ${radius} ${radius} 0 1 1 ${cx} ${cy + radius} A ${radius} ${radius} 0 1 1 ${cx} ${cy - radius} Z`
          : `M ${cx} ${cy} L ${finiteCoord(cx + radius * Math.cos(start))} ${finiteCoord(cy + radius * Math.sin(start))} A ${radius} ${radius} 0 ${pct > 50 ? 1 : 0} 1 ${finiteCoord(cx + radius * Math.cos(end))} ${finiteCoord(cy + radius * Math.sin(end))} Z`;
      const labelR = pct >= 99.95 ? 0 : radius * 0.6;
      acc.items.push({
        bucket: slice.bucket,
        label: slice.label,
        pct,
        color,
        d,
        labelX: finiteCoord(cx + labelR * Math.cos(mid)),
        labelY: finiteCoord(cy + labelR * Math.sin(mid) + 3.5),
      });
      acc.startPct += pct;
      return acc;
    },
    { startPct: 0, items: [] },
  ).items;

  return (
    <View style={{ alignItems: "center" }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {segments.map((segment) => (
          <Path
            key={segment.bucket}
            d={segment.d}
            fill={segment.color}
            stroke={colors.white}
            strokeWidth={segments.length > 1 ? 0.8 : 0}
          />
        ))}
        {segments.map((segment) =>
          segment.pct >= 4 ? (
            <SvgText
              key={`${segment.bucket}-label`}
              x={segment.labelX}
              y={segment.labelY}
              fill={colors.white}
              textAnchor="middle"
              style={{ fontFamily: fonts.body, fontSize: 11, fontWeight: 700 }}
            >
              {`${Math.round(segment.pct)}%`}
            </SvgText>
          ) : null,
        )}
      </Svg>
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          justifyContent: "center",
          columnGap: 34,
          rowGap: 8,
          marginTop: 30,
          maxWidth: 380,
        }}
      >
        {segments.map((segment) => (
          <View
            key={segment.bucket}
            style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
          >
            <View style={{ width: 5.5, height: 5.5, backgroundColor: segment.color }} />
            <Text style={reportStyles.legendText}>
              {allocationLegendLabel(segment.bucket, segment.label)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
