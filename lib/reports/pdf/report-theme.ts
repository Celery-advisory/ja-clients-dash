import { StyleSheet } from "@react-pdf/renderer";

export const REPORT_DOCUMENT_TITLE = "Investment Report";
export const REPORT_COVER_TITLE = "Your Investment Report";
export const REPORT_TAGLINE = "Prosper With Purpose";

/** Base pages: cover, disclaimer, overview, cumulative performance, allocation, transactions, back cover */
export const REPORT_BASE_PAGES = 7;

/**
 * Geometry follows the JA Wealth report template (a 1920 x 1080 slide deck), mapped onto
 * A4 landscape for print. Horizontal positions scale by page width; vertical positions
 * and type scale by page height, which keeps body copy at a readable 8.5 to 9.5pt on paper.
 */
export const PAGE_WIDTH = 841.89;
export const PAGE_HEIGHT = 595.28;

export const colors = {
  navy: "#202353",
  gold: "#b2936b",
  goldLight: "#c5a27e",
  ink: "#000000",
  body: "#4a4a4a",
  muted: "#666666",
  stripe: "#f9f6f2",
  grid: "#e2e2e2",
  totalFill: "#f0f0f0",
  rowRule: "#8e8d8b",
  footerRule: "#989898",
  coverSubtitle: "#eeeeee",
  /** Back cover monogram: a few shades under the cover navy, as in the brand pattern artwork. */
  patternGlyph: "#1c1f4b",
  white: "#ffffff",
};

/** Playfair Display for titles and figures, Carlito (metric twin of the template's Calibri) for running text. */
export const fonts = {
  heading: "Playfair Display",
  body: "Carlito",
};

/** Allocation chart colours from the template, keyed by portfolio bucket. */
export const REPORT_BUCKET_COLORS = {
  income: "#5e86b8",
  growth: "#c5a27e",
  venture: "#002c64",
  treasury: "#8b95a7",
  coa: "#5b9ad1",
} as const;

export const PAGE_EDGE_LEFT = 25;
export const CONTENT_LEFT = 205;
export const CONTENT_RIGHT = 806;
export const CONTENT_WIDTH = CONTENT_RIGHT - CONTENT_LEFT;
export const FOOTER_RULE_TOP = 539;
export const HALF_PAGE = PAGE_WIDTH / 2;
/** A hair under the page height: the renderer's A4 is 595.276pt, so a full 595.28 photo spills onto a new page. */
export const PHOTO_HEIGHT = 595.27;

export const TABLE_TEXT_SIZE = 8.7;
const TABLE_CELL_PAD_X = 6;

export const reportStyles = StyleSheet.create({
  page: {
    backgroundColor: colors.white,
    paddingTop: 37,
    paddingBottom: PAGE_HEIGHT - FOOTER_RULE_TOP + 16,
    paddingLeft: CONTENT_LEFT,
    paddingRight: PAGE_WIDTH - CONTENT_RIGHT,
    fontFamily: fonts.body,
    fontSize: 9.5,
    color: colors.ink,
  },

  // Client details in the left margin of every content page
  clientRail: {
    position: "absolute",
    top: 47,
    left: PAGE_EDGE_LEFT,
    width: CONTENT_LEFT - PAGE_EDGE_LEFT - 12,
  },
  railLine: {
    fontFamily: fonts.body,
    fontSize: 9.5,
    lineHeight: 1.63,
    color: colors.ink,
  },
  railLabel: {
    fontFamily: fonts.heading,
    fontWeight: 900,
  },

  pageTitle: {
    fontFamily: fonts.heading,
    fontSize: 21,
    lineHeight: 1.2,
    color: colors.gold,
  },
  titleRule: {
    borderBottomWidth: 0.7,
    borderBottomStyle: "dotted",
    borderBottomColor: colors.goldLight,
    marginTop: 22,
  },

  // Footer: rule, "2 | Investment Report", logo
  footerRule: {
    position: "absolute",
    top: FOOTER_RULE_TOP,
    left: 24,
    right: PAGE_WIDTH - 818,
    borderBottomWidth: 0.75,
    borderBottomColor: colors.footerRule,
  },
  footer: {
    position: "absolute",
    top: FOOTER_RULE_TOP + 15,
    left: 24,
    right: PAGE_WIDTH - 818,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  footerText: {
    fontFamily: fonts.body,
    fontSize: 8.3,
    color: colors.ink,
  },
  footerMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  footerDivider: {
    color: colors.gold,
  },
  footerLogo: {
    width: 76,
    height: 13.2,
  },

  // Cover
  coverPage: {
    backgroundColor: colors.navy,
    fontFamily: fonts.heading,
  },
  // The split pages place both halves absolutely so neither can push content onto a second sheet.
  coverPhoto: {
    position: "absolute",
    top: 0,
    left: 0,
    width: HALF_PAGE,
    height: PHOTO_HEIGHT,
    objectFit: "cover",
  },
  coverPanel: {
    position: "absolute",
    top: 0,
    left: HALF_PAGE,
    right: 0,
    bottom: 0,
    backgroundColor: colors.navy,
    paddingLeft: 474.6 - HALF_PAGE,
    paddingTop: 170,
  },
  coverClientName: {
    fontFamily: fonts.heading,
    fontSize: 36.5,
    lineHeight: 1.2,
    color: colors.goldLight,
  },
  coverTitle: {
    fontFamily: fonts.heading,
    fontSize: 17.4,
    color: colors.coverSubtitle,
    marginTop: 41,
  },
  coverDate: {
    fontFamily: fonts.heading,
    fontSize: 13.1,
    color: colors.coverSubtitle,
    marginTop: 40,
  },
  ordinalSuffix: {
    verticalAlign: "super",
  },
  brandMark: {
    alignItems: "flex-end",
  },
  brandTagline: {
    fontFamily: fonts.body,
    fontSize: 6,
    color: colors.goldLight,
    marginBottom: 2,
  },
  coverBrand: {
    position: "absolute",
    right: PAGE_WIDTH - 799,
    top: 512,
  },
  coverLogo: {
    width: 102,
    height: 17.7,
  },

  // Back cover: the J.\ monogram tiled edge to edge
  backCoverPage: {
    backgroundColor: colors.navy,
    justifyContent: "center",
    alignItems: "center",
  },
  backCoverPattern: {
    position: "absolute",
    top: 0,
    left: 0,
  },
  backCoverTagline: {
    fontFamily: fonts.body,
    fontSize: 11.5,
    color: colors.goldLight,
    marginBottom: 3,
    marginRight: 8,
  },
  backCoverLogo: {
    width: 242,
    height: 41.9,
  },

  // Tables share one grid: white header, Playfair figures, light vertical rules
  table: {
    marginTop: 16,
  },
  tableHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 59,
    borderBottomWidth: 0.6,
    borderBottomColor: colors.grid,
  },
  tableHeaderCell: {
    fontFamily: fonts.heading,
    fontWeight: 900,
    fontSize: TABLE_TEXT_SIZE,
    lineHeight: 1.45,
    color: colors.ink,
    paddingHorizontal: TABLE_CELL_PAD_X,
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "stretch",
    borderBottomWidth: 0.6,
    borderBottomColor: colors.grid,
  },
  tableRowLast: {
    borderBottomWidth: 0,
  },
  tableRowStriped: {
    backgroundColor: colors.stripe,
  },
  tableRowTotalFill: {
    backgroundColor: colors.totalFill,
  },
  tableCell: {
    justifyContent: "center",
    paddingHorizontal: TABLE_CELL_PAD_X,
    borderLeftWidth: 0.6,
    borderLeftColor: colors.grid,
  },
  tableCellFirst: {
    borderLeftWidth: 0,
  },
  tableCellText: {
    fontFamily: fonts.heading,
    fontSize: TABLE_TEXT_SIZE,
    color: colors.ink,
  },
  tableCellTextBold: {
    fontFamily: fonts.heading,
    fontWeight: 900,
    fontSize: TABLE_TEXT_SIZE,
    color: colors.ink,
  },
  footnote: {
    fontFamily: fonts.heading,
    fontSize: 9.5,
    color: colors.ink,
    marginTop: 12,
  },
  emptyRow: {
    fontFamily: fonts.body,
    fontSize: 9.5,
    color: colors.muted,
    paddingVertical: 8,
  },

  // Recent transactions use a ruled list rather than the grid
  ledgerHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingBottom: 9,
    borderBottomWidth: 1,
    borderBottomColor: colors.ink,
  },
  ledgerRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 43.8,
    backgroundColor: colors.stripe,
    borderBottomWidth: 0.75,
    borderBottomColor: colors.rowRule,
  },
  ledgerCell: {
    paddingHorizontal: TABLE_CELL_PAD_X,
  },
  ledgerCellText: {
    fontFamily: fonts.body,
    fontSize: TABLE_TEXT_SIZE,
    color: colors.ink,
  },

  // Disclaimer
  disclaimerIntro: {
    fontFamily: fonts.body,
    fontSize: 9,
    color: colors.body,
    marginTop: 22,
    marginBottom: 14,
  },
  disclaimerParagraph: {
    fontFamily: fonts.body,
    fontSize: 9,
    lineHeight: 1.85,
    color: colors.body,
    marginBottom: 12,
    width: 573,
  },

  // Allocation: photo on the left, chart panel on the right
  allocationPage: {
    backgroundColor: colors.white,
    fontFamily: fonts.body,
  },
  allocationPhoto: {
    position: "absolute",
    top: 0,
    left: 0,
    width: HALF_PAGE,
    height: PHOTO_HEIGHT,
    objectFit: "cover",
  },
  allocationPanel: {
    position: "absolute",
    top: 0,
    left: HALF_PAGE,
    right: 0,
    bottom: 0,
    paddingTop: 49,
  },
  allocationTitle: {
    fontFamily: fonts.heading,
    fontSize: 33,
    lineHeight: 1.2,
    color: colors.gold,
    textAlign: "center",
  },
  allocationRule: {
    borderBottomWidth: 0.7,
    borderBottomStyle: "dotted",
    borderBottomColor: colors.goldLight,
    marginTop: 15,
    marginRight: PAGE_WIDTH - 816,
  },
  allocationFooterRule: {
    position: "absolute",
    top: FOOTER_RULE_TOP,
    left: 0,
    right: PAGE_WIDTH - 818,
    borderBottomWidth: 0.75,
    borderBottomColor: colors.footerRule,
  },
  allocationFooterLogo: {
    position: "absolute",
    top: FOOTER_RULE_TOP + 15,
    right: PAGE_WIDTH - 818,
    width: 76,
    height: 13.2,
  },
  legendText: {
    fontFamily: fonts.body,
    fontSize: 9.5,
    color: colors.ink,
  },

});

export function computeReportTotalPages(holdingsPageCount: number): number {
  return REPORT_BASE_PAGES + holdingsPageCount;
}
