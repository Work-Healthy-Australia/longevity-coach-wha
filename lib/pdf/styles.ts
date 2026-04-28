import { StyleSheet } from "@react-pdf/renderer";

export const palette = {
  primary: "#2F6F8F",
  primary700: "#245672",
  primary50: "#EEF3F6",
  sage: "#6B8E83",
  sage50: "#F0F4F2",
  ink: "#2B2B2B",
  inkSoft: "#4B4B4B",
  grey: "#8A9AA5",
  line: "#E3E8EC",
  lineSoft: "#EDF1F4",
  canvas: "#FAFAF7",
  riskVeryLow: "#2A7A5C",
  riskLow: "#5B9F86",
  riskModerate: "#B5722F",
  riskHigh: "#B5452F",
  riskVeryHigh: "#8E2C1A",
} as const;

// 14mm margin (tighter than the original 18mm).
const MARGIN = 40;

export const styles = StyleSheet.create({
  page: {
    backgroundColor: palette.canvas,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: palette.ink,
    paddingTop: MARGIN,
    paddingBottom: MARGIN + 22,
    paddingLeft: MARGIN,
    paddingRight: MARGIN,
  },

  // ----- Per-page header strip (logo + page title) -----
  pageHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: palette.line,
  },
  headerLogo: {
    width: 110,
    height: 22,
    objectFit: "contain",
  },
  headerEyebrow: {
    fontSize: 8,
    color: palette.grey,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    fontFamily: "Helvetica-Bold",
  },

  // ----- Cover -----
  coverLogo: {
    width: 160,
    height: 32,
    objectFit: "contain",
    marginBottom: 30,
  },
  coverEyebrow: {
    fontSize: 9,
    color: palette.grey,
    textTransform: "uppercase",
    letterSpacing: 1.6,
    fontFamily: "Helvetica-Bold",
    marginBottom: 6,
  },
  coverMemberName: {
    fontSize: 26,
    fontFamily: "Helvetica-Bold",
    color: palette.primary700,
    marginBottom: 2,
  },
  coverDate: {
    fontSize: 10,
    color: palette.grey,
    marginBottom: 22,
  },
  // Hero card matches the dashboard hero (teal gradient → solid teal here).
  hero: {
    backgroundColor: palette.primary,
    borderRadius: 14,
    padding: 22,
    marginBottom: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  heroLeft: { flex: 3 },
  heroRight: {
    flex: 1.2,
    backgroundColor: "rgba(255,255,255,0.16)",
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
  },
  heroEyebrow: {
    fontSize: 8.5,
    color: "rgba(255,255,255,0.78)",
    textTransform: "uppercase",
    letterSpacing: 1.3,
    fontFamily: "Helvetica-Bold",
    marginBottom: 4,
  },
  heroBig: {
    fontSize: 36,
    fontFamily: "Helvetica-Bold",
    color: "#FFFFFF",
    lineHeight: 1.05,
    marginBottom: 4,
  },
  heroSub: {
    fontSize: 9.5,
    color: "rgba(255,255,255,0.82)",
    lineHeight: 1.45,
  },
  heroMiniValue: {
    fontSize: 26,
    fontFamily: "Helvetica-Bold",
    color: "#FFFFFF",
    lineHeight: 1,
  },
  heroMiniLabel: {
    fontSize: 8,
    color: "rgba(255,255,255,0.78)",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: 4,
    textAlign: "center",
  },

  // ----- Three big-number row (cover, dashboard-style) -----
  numbersRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },
  numberTile: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 12,
    padding: 14,
  },
  numberLabel: {
    fontSize: 8,
    color: palette.grey,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    fontFamily: "Helvetica-Bold",
    marginBottom: 6,
  },
  numberValue: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    color: palette.ink,
    lineHeight: 1,
  },
  numberSub: {
    marginTop: 4,
    fontSize: 8.5,
    color: palette.inkSoft,
  },

  // ----- Section heads -----
  pageTitle: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: palette.primary700,
    marginBottom: 4,
  },
  pageSubtitle: {
    fontSize: 9,
    color: palette.grey,
    marginBottom: 12,
  },

  // ----- Risk profile tile grid -----
  domainGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  domainTile: {
    width: "48.5%",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 10,
    padding: 12,
  },
  domainTileWide: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 10,
    padding: 12,
  },
  domainHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  domainName: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: palette.ink,
  },
  domainScoreLine: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 2,
  },
  domainScoreBig: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    color: palette.ink,
    marginRight: 8,
    lineHeight: 1,
  },
  domainFactors: {
    fontSize: 8.5,
    color: palette.grey,
    marginTop: 4,
    lineHeight: 1.35,
  },

  // ----- Pill -----
  pill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: "#FFFFFF",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },

  // ----- Numbered list -----
  numItem: {
    flexDirection: "row",
    marginBottom: 9,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 8,
    padding: 10,
  },
  numCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: palette.primary,
    color: "#FFFFFF",
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    paddingTop: 4.5,
    marginRight: 10,
  },
  numBody: { flex: 1 },
  numTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: palette.ink,
    marginBottom: 1,
  },
  numMeta: {
    fontSize: 8.5,
    color: palette.grey,
    marginBottom: 2,
  },
  numAction: {
    fontSize: 9,
    color: palette.inkSoft,
    lineHeight: 1.35,
  },

  // ----- Supplement table -----
  table: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 8,
    overflow: "hidden",
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: palette.sage50,
    paddingVertical: 7,
    paddingHorizontal: 6,
  },
  tableRow: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: palette.line,
    paddingVertical: 7,
    paddingHorizontal: 6,
  },
  th: {
    fontSize: 8.5,
    fontFamily: "Helvetica-Bold",
    color: palette.primary700,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  td: {
    fontSize: 9.5,
    color: palette.ink,
  },
  colName: { flex: 3 },
  colDose: { flex: 2 },
  colTiming: { flex: 2 },
  colTier: { flex: 1.5 },

  // ----- Projection -----
  projRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },
  projBox: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  projBoxProjected: {
    flex: 1,
    backgroundColor: palette.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  projLabel: {
    fontSize: 8.5,
    color: palette.grey,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    fontFamily: "Helvetica-Bold",
    marginBottom: 4,
  },
  projLabelProjected: {
    fontSize: 8.5,
    color: "rgba(255,255,255,0.8)",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    fontFamily: "Helvetica-Bold",
    marginBottom: 4,
  },
  projNumber: {
    fontSize: 36,
    fontFamily: "Helvetica-Bold",
    color: palette.primary,
    lineHeight: 1,
  },
  projNumberProjected: {
    fontSize: 36,
    fontFamily: "Helvetica-Bold",
    color: "#FFFFFF",
    lineHeight: 1,
  },
  bullet: {
    flexDirection: "row",
    marginBottom: 4,
  },
  bulletDot: { width: 10, color: palette.primary, fontSize: 10 },
  bulletText: {
    flex: 1,
    fontSize: 9.5,
    color: palette.inkSoft,
    lineHeight: 1.35,
  },

  // ----- Footer -----
  footer: {
    position: "absolute",
    bottom: 14,
    left: MARGIN,
    right: MARGIN,
    borderTopWidth: 1,
    borderTopColor: palette.line,
    paddingTop: 5,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  footerLeft: { flex: 4 },
  footerRight: { flex: 1, textAlign: "right" },
  footerText: { fontSize: 7, color: palette.grey, lineHeight: 1.35 },
});

export function riskLevelColor(level: string): string {
  switch (level) {
    case "very_low":
      return palette.riskVeryLow;
    case "low":
      return palette.riskLow;
    case "moderate":
      return palette.riskModerate;
    case "high":
      return palette.riskHigh;
    case "very_high":
      return palette.riskVeryHigh;
    default:
      return palette.grey;
  }
}

export function riskLevelLabel(level: string): string {
  return level.replace(/_/g, " ");
}
