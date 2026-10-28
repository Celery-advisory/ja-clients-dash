"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight, ChevronsUpDown } from "lucide-react"

import { cn } from "@/lib/utils"

function Table({
  className,
  bleed = false,
  ...props
}: React.ComponentProps<"table"> & { bleed?: boolean }) {
  return (
    <div
      data-slot="table-container"
      className={cn(
        "relative w-full overflow-x-auto",
        bleed && "-mx-3.5 w-[calc(100%+1.75rem)] sm:-mx-4 sm:w-[calc(100%+2rem)]",
      )}
    >
      <table
        data-slot="table"
        className={cn("w-full caption-bottom text-[13px]", className)}
        {...props}
      />
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn(
        "bg-muted/50 [&_tr]:border-b [&_tr]:border-border [&_tr]:hover:bg-transparent",
        className,
      )}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "border-t border-border bg-white font-medium [&>tr]:hover:bg-transparent",
        className,
      )}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "border-b border-border/70 transition-colors hover:bg-muted/40 data-[state=selected]:bg-muted/60",
        className,
      )}
      {...props}
    />
  )
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "h-10 px-4 text-left align-middle text-[12px] font-medium whitespace-nowrap text-muted-foreground [&:has([role=checkbox])]:pr-0",
        className,
      )}
      {...props}
    />
  )
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "px-4 py-3.5 align-middle whitespace-nowrap text-[13px] text-foreground [&:has([role=checkbox])]:pr-0",
        className,
      )}
      {...props}
    />
  )
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-[13px] text-muted-foreground", className)}
      {...props}
    />
  )
}

function ColumnLabel({
  children,
  align = "left",
}: {
  children: React.ReactNode
  align?: "left" | "right"
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5",
        align === "right" && "w-full justify-end",
      )}
    >
      {children}
      <ChevronsUpDown className="size-3 shrink-0 text-muted-foreground/60" aria-hidden />
    </span>
  )
}

/** Muted tones drawn from the brand palette, so tags inform without competing with the figures. */
const PILL_TONES = {
  rose: "bg-[#f7e9e8] text-[#a34844]",
  violet: "bg-[#ebebf3] text-[#202356]",
  indigo: "bg-[#ebebf3] text-[#202356]",
  sky: "bg-[#e9eef4] text-[#3d5a7a]",
  mint: "bg-[#e8efe5] text-[#4d6b3c]",
  lime: "bg-[#e8efe5] text-[#4d6b3c]",
  amber: "bg-[#f4ece1] text-[#7d6340]",
  orange: "bg-[#f5ebe3] text-[#8f5833]",
  slate: "bg-[#efede8] text-[#5f5d58]",
} as const

type PillTone = keyof typeof PILL_TONES

function CategoryPill({
  tone,
  children,
  className,
}: {
  tone: PillTone
  children: React.ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11.5px] font-medium",
        PILL_TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

const BUCKET_PILL_TONE: Record<string, PillTone> = {
  income: "amber",
  growth: "indigo",
  venture: "mint",
  treasury: "slate",
  coa: "orange",
}

const BUCKET_PILL_LABEL: Record<string, string> = {
  income: "Income",
  growth: "Growth",
  venture: "Venture",
  treasury: "Treasury",
  coa: "Cash",
}

function bucketPillTone(bucket: string): PillTone {
  return BUCKET_PILL_TONE[bucket] ?? "sky"
}

function bucketPillLabel(bucket: string): string {
  return BUCKET_PILL_LABEL[bucket] ?? bucket
}

const TX_PILL_TONE: Record<string, PillTone> = {
  deposit: "mint",
  drawdown: "rose",
  transfer: "sky",
  fee: "amber",
  other: "slate",
}

function transactionPillTone(type: string): PillTone {
  return TX_PILL_TONE[type] ?? "slate"
}

type StatusTone = "open" | "closed" | "attention" | "neutral"

const STATUS_DOT: Record<StatusTone, string> = {
  open: "bg-emerald-500",
  closed: "bg-red-500",
  attention: "bg-amber-500",
  neutral: "bg-slate-400",
}

function StatusMark({
  tone,
  children,
}: {
  tone: StatusTone
  children: React.ReactNode
}) {
  return (
    <span className="inline-flex items-center gap-2 text-[13px] text-foreground first-letter:uppercase">
      <span className={cn("size-1.5 shrink-0 rounded-full", STATUS_DOT[tone])} aria-hidden />
      {children}
    </span>
  )
}

function pageItems(page: number, pageCount: number): Array<number | "gap"> {
  if (pageCount <= 5) {
    return Array.from({ length: pageCount }, (_, index) => index + 1)
  }
  const items: Array<number | "gap"> = [1]
  const start = Math.max(2, page - 1)
  const end = Math.min(pageCount - 1, page + 1)
  if (start > 2) items.push("gap")
  for (let n = start; n <= end; n += 1) items.push(n)
  if (end < pageCount - 1) items.push("gap")
  items.push(pageCount)
  return items
}

function TableFooterBar({
  total,
  page,
  pageCount,
  pageSize,
  onPageChange,
  onPageSizeChange,
  className,
}: {
  total: number
  page?: number
  pageCount?: number
  pageSize?: number
  onPageChange?: (page: number) => void
  onPageSizeChange?: (size: number) => void
  className?: string
}) {
  const showPager = page != null && pageCount != null && pageSize != null
  const sizes = [10, 15, 25]
  const sizeOptions = showPager && sizes.includes(pageSize) ? sizes : showPager ? [...sizes, pageSize].sort((a, b) => a - b) : sizes

  return (
    <div
      className={cn(
        "flex flex-col gap-3 border-t border-[#e6ebf2] px-4 py-3 text-[13px] sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <span className="text-foreground">
        Total <span className="font-semibold tabular-nums">{total}</span>
      </span>
      {showPager ? (
        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          <label className="flex items-center gap-2 text-[#64748b]">
            Lines per page
            <select
              value={pageSize}
              disabled={!onPageSizeChange}
              onChange={(event) => onPageSizeChange?.(Number(event.target.value))}
              className="h-8 rounded-md border border-[#e6ebf2] bg-white px-2 text-[13px] text-foreground disabled:opacity-70"
            >
              {sizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Previous page"
              disabled={!onPageChange || page <= 1}
              onClick={() => onPageChange?.(page - 1)}
              className="inline-flex size-7 items-center justify-center rounded-md text-[#64748b] hover:bg-[#f4f7fb] disabled:opacity-40"
            >
              <ChevronLeft className="size-4" />
            </button>
            {pageItems(page, pageCount).map((item, index) =>
              item === "gap" ? (
                <span key={`gap-${index}`} className="px-1 text-[#94a3b8]">
                  ...
                </span>
              ) : (
                <button
                  key={item}
                  type="button"
                  aria-label={`Page ${item}`}
                  aria-current={item === page ? "page" : undefined}
                  disabled={!onPageChange}
                  onClick={() => onPageChange?.(item)}
                  className={cn(
                    "inline-flex size-7 items-center justify-center rounded-full text-[13px] tabular-nums",
                    item === page
                      ? "bg-foreground font-medium text-background"
                      : "text-foreground hover:bg-[#f4f7fb]",
                  )}
                >
                  {item}
                </button>
              ),
            )}
            <button
              type="button"
              aria-label="Next page"
              disabled={!onPageChange || page >= pageCount}
              onClick={() => onPageChange?.(page + 1)}
              className="inline-flex size-7 items-center justify-center rounded-md text-[#64748b] hover:bg-[#f4f7fb] disabled:opacity-40"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function usePagedRows<T>(
  rows: T[],
  options?: { initialSize?: number; resetKey?: string },
) {
  const initialSize = options?.initialSize ?? 15
  const resetKey = options?.resetKey ?? ""
  const [page, setPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(initialSize)
  const [seenKey, setSeenKey] = React.useState(resetKey)

  if (seenKey !== resetKey) {
    setSeenKey(resetKey)
    setPage(1)
  }

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize))
  const current = Math.min(page, pageCount)
  const start = (current - 1) * pageSize

  return {
    page: current,
    pageSize,
    pageCount,
    rows: rows.slice(start, start + pageSize),
    total: rows.length,
    setPage,
    setPageSize: (size: number) => {
      setPageSize(size)
      setPage(1)
    },
  }
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
  ColumnLabel,
  CategoryPill,
  StatusMark,
  TableFooterBar,
  usePagedRows,
  bucketPillTone,
  bucketPillLabel,
  transactionPillTone,
}
export type { PillTone, StatusTone }
