"use client";

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { formatChartCompactUsd, formatChartUsd } from "@/lib/chart-format";
import { cn } from "@/lib/utils";

type Point = { month: string; value: number };

const chartConfig = {
  value: {
    label: "Book AUM",
    color: "#202356",
  },
} satisfies ChartConfig;

export function BookAumChart({
  data,
  className,
  height = 220,
}: {
  data: Point[];
  className?: string;
  height?: number;
}) {
  if (data.length < 2) {
    return (
      <p className="py-10 text-sm text-muted-foreground">
        Add statement history across clients to show book AUM over time.
      </p>
    );
  }

  return (
    <ChartContainer
      config={chartConfig}
      className={cn("aspect-auto w-full min-h-0 min-w-0", className)}
      style={{ height }}
    >
      <AreaChart
        accessibilityLayer
        data={data}
        margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
      >
        <defs>
          <linearGradient id="book-aum-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#b2936b" stopOpacity={0.28} />
            <stop offset="100%" stopColor="#b2936b" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="#ece8e1" />
        <XAxis
          dataKey="month"
          tickLine={false}
          axisLine={false}
          tickMargin={10}
          minTickGap={40}
          tick={{ fill: "#8a8781", fontSize: 11 }}
        />
        {/* Fit the axis to the data: from zero, a growing book reads as a flat line. */}
        <YAxis
          tickLine={false}
          axisLine={false}
          tickMargin={6}
          width={56}
          domain={[
            (min: number) => Math.max(0, min - (min * 0.06)),
            (max: number) => max * 1.03,
          ]}
          tickCount={4}
          tickFormatter={(value) => formatChartCompactUsd(Number(value))}
          tick={{ fill: "#8a8781", fontSize: 11 }}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value) => formatChartUsd(Number(value))}
            />
          }
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke="var(--color-value)"
          strokeWidth={2}
          fill="url(#book-aum-fill)"
          dot={false}
          activeDot={{ r: 3.5, strokeWidth: 0, fill: "#202356" }}
        />
      </AreaChart>
    </ChartContainer>
  );
}
