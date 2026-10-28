import React from "react";
import { Image, Page, Path, Svg, Text, View } from "@react-pdf/renderer";
import type { Style } from "@react-pdf/types";

import type { InvestmentReportData } from "@/lib/reports/types";
import {
  COVER_SKYLINE,
  JA_REPORT_LOGO,
  JA_REPORT_LOGO_DARK,
} from "@/lib/reports/pdf/report-assets";
import {
  colors,
  PAGE_WIDTH,
  PHOTO_HEIGHT,
  REPORT_COVER_TITLE,
  REPORT_DOCUMENT_TITLE,
  REPORT_TAGLINE,
  reportStyles,
} from "@/lib/reports/pdf/report-theme";

const PAGE_SIZE = "A4";
const ORIENTATION = "landscape";

/** "25th June 2026" with the ordinal suffix raised, as on the template. `size` is the surrounding font size. */
export function OrdinalDate({
  label,
  size,
  style,
}: {
  label: string;
  size: number;
  style?: Style | Style[];
}) {
  const match = /^(\d+)(st|nd|rd|th)(\b.*)$/.exec(label);
  if (!match) return <Text style={style}>{label}</Text>;
  return (
    <Text style={style}>
      {match[1]}
      <Text style={[reportStyles.ordinalSuffix, { fontSize: size * 0.66 }]}>{match[2]}</Text>
      {match[3]}
    </Text>
  );
}

function BrandMark({
  logoSrc,
  logoStyle,
  taglineStyle,
}: {
  logoSrc: string;
  logoStyle: Style;
  taglineStyle?: Style;
}) {
  return (
    <View style={reportStyles.brandMark}>
      <Text style={taglineStyle ?? reportStyles.brandTagline}>{REPORT_TAGLINE}</Text>
      <Image src={logoSrc} style={logoStyle} />
    </View>
  );
}

export function ReportFooter() {
  return (
    <>
      <View style={reportStyles.footerRule} fixed />
      <View style={reportStyles.footer} fixed>
        <View style={reportStyles.footerMeta}>
          <Text style={reportStyles.footerText} render={({ pageNumber }) => `${pageNumber}`} />
          <Text style={[reportStyles.footerText, reportStyles.footerDivider]}>|</Text>
          <Text style={reportStyles.footerText}>{REPORT_DOCUMENT_TITLE}</Text>
        </View>
        <Image src={JA_REPORT_LOGO_DARK} style={reportStyles.footerLogo} />
      </View>
    </>
  );
}

export function ReportPageShell({
  clientName,
  clientNumber,
  reference,
  pageTitle,
  children,
}: {
  clientName: string;
  clientNumber: string;
  reference: string;
  pageTitle: string;
  children: React.ReactNode;
}) {
  return (
    <Page size={PAGE_SIZE} orientation={ORIENTATION} style={reportStyles.page}>
      <View style={reportStyles.clientRail} fixed>
        <Text style={reportStyles.railLine}>
          <Text style={reportStyles.railLabel}>Client: </Text>
          {clientName}
        </Text>
        <Text style={reportStyles.railLine}>Our Ref: {reference}</Text>
        <Text style={reportStyles.railLine}>Client Number: {clientNumber}</Text>
      </View>
      <Text style={reportStyles.pageTitle}>{pageTitle}</Text>
      <View style={reportStyles.titleRule} />
      <View>{children}</View>
      <ReportFooter />
    </Page>
  );
}

export function CoverPage({ data }: { data: InvestmentReportData }) {
  return (
    <Page size={PAGE_SIZE} orientation={ORIENTATION} style={reportStyles.coverPage}>
      <Image src={data.coverImageSrc ?? COVER_SKYLINE} style={reportStyles.coverPhoto} />
      <View style={reportStyles.coverPanel}>
        <Text style={reportStyles.coverClientName}>{data.clientName}</Text>
        <Text style={reportStyles.coverTitle}>{REPORT_COVER_TITLE}</Text>
        <OrdinalDate
          label={data.currentStatementLabel}
          size={reportStyles.coverDate.fontSize as number}
          style={reportStyles.coverDate}
        />
        <View style={reportStyles.coverBrand}>
          <BrandMark logoSrc={JA_REPORT_LOGO} logoStyle={reportStyles.coverLogo} />
        </View>
      </View>
    </Page>
  );
}

/**
 * The back cover pattern from the brand artwork (Pattern_Ja.af): the J.\ monogram on a
 * square repeat, about 40pt, 21 across the page. Units are the artwork's glyph units;
 * the glyph spans 82 to 917 across and 249 to 750 down inside each 966-unit tile.
 */
const PATTERN_VIEW_WIDTH = 20480;
const PATTERN_TILE = 966;
const PATTERN_ORIGIN = { x: 74, y: -49 };

function patternTile(x: number, y: number) {
  const p = (dx: number, dy: number) => `${x + dx} ${y + dy}`;
  const j = `M ${p(246, 249)} L ${p(335, 249)} L ${p(335, 590)} C ${p(335, 680)} ${p(275, 750)} ${p(170, 750)} C ${p(130, 750)} ${p(100, 740)} ${p(82, 725)} L ${p(82, 638)} C ${p(105, 660)} ${p(130, 670)} ${p(160, 670)} C ${p(215, 670)} ${p(246, 640)} ${p(246, 575)} Z`;
  const dot = `M ${p(444, 693)} A 57 57 0 1 0 ${p(558, 693)} A 57 57 0 1 0 ${p(444, 693)} Z`;
  const slash = `M ${p(670, 249)} L ${p(917, 750)} L ${p(823, 750)} L ${p(624, 343)} Z`;
  return `${j} ${dot} ${slash}`;
}

function buildPatternPath(viewHeight: number) {
  const parts: string[] = [];
  for (let y = PATTERN_ORIGIN.y; y < viewHeight; y += PATTERN_TILE) {
    for (let x = PATTERN_ORIGIN.x - PATTERN_TILE; x < PATTERN_VIEW_WIDTH; x += PATTERN_TILE) {
      parts.push(patternTile(x, y));
    }
  }
  return parts.join(" ");
}

const PATTERN_VIEW_HEIGHT = (PATTERN_VIEW_WIDTH * PHOTO_HEIGHT) / PAGE_WIDTH;
const PATTERN_PATH = buildPatternPath(PATTERN_VIEW_HEIGHT);

export function BackCoverPage() {
  return (
    <Page size={PAGE_SIZE} orientation={ORIENTATION} style={reportStyles.backCoverPage}>
      <Svg
        width={PAGE_WIDTH}
        height={PHOTO_HEIGHT}
        viewBox={`0 0 ${PATTERN_VIEW_WIDTH} ${PATTERN_VIEW_HEIGHT.toFixed(2)}`}
        style={reportStyles.backCoverPattern}
      >
        <Path d={PATTERN_PATH} fill={colors.patternGlyph} />
      </Svg>
      <BrandMark
        logoSrc={JA_REPORT_LOGO}
        logoStyle={reportStyles.backCoverLogo}
        taglineStyle={reportStyles.backCoverTagline}
      />
    </Page>
  );
}

export type TableColumn = {
  /** Width in points; columns are laid out left to right from the content edge. */
  width: number;
  header: React.ReactNode;
};

export type TableRowSpec = {
  key: string;
  cells: React.ReactNode[];
  height: number;
  striped?: boolean;
  total?: boolean;
  totalFill?: boolean;
};

/** The template grid: bold header on white, Playfair figures, light vertical rules between body cells. */
export function GridTable({
  columns,
  rows,
  headerHeight = 59,
}: {
  columns: TableColumn[];
  rows: TableRowSpec[];
  headerHeight?: number;
}) {
  const width = columns.reduce((sum, c) => sum + c.width, 0);
  return (
    <View style={[reportStyles.table, { width }]}>
      <View style={[reportStyles.tableHeaderRow, { minHeight: headerHeight }]} wrap={false}>
        {columns.map((column, i) => (
          <Text key={i} style={[reportStyles.tableHeaderCell, { width: column.width }]}>
            {column.header}
          </Text>
        ))}
      </View>
      {rows.map((row, rowIndex) => (
        <View
          key={row.key}
          wrap={false}
          style={[
            reportStyles.tableRow,
            { minHeight: row.height },
            row.striped ? reportStyles.tableRowStriped : {},
            row.totalFill ? reportStyles.tableRowTotalFill : {},
            rowIndex === rows.length - 1 ? reportStyles.tableRowLast : {},
          ]}
        >
          {row.cells.map((cell, i) => (
            <View
              key={i}
              style={[
                reportStyles.tableCell,
                { width: columns[i].width },
                i === 0 ? reportStyles.tableCellFirst : {},
              ]}
            >
              <Text style={row.total ? reportStyles.tableCellTextBold : reportStyles.tableCellText}>
                {cell}
              </Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}
