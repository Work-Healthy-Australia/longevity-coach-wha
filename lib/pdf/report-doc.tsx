import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";

Font.register({
  family: "Helvetica",
  fonts: [],
});

const palette = {
  navy: "#1A3A4A",
  teal: "#2F6F8F",
  lightBlue: "#E8F3F8",
  green: "#22863A",
  amber: "#B45309",
  red: "#C0392B",
  muted: "#6B7C85",
  border: "#D4E0E8",
  white: "#FFFFFF",
  bg: "#F4F7F9",
};

const styles = StyleSheet.create({
  page: {
    backgroundColor: palette.bg,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: palette.navy,
    padding: 40,
  },
  header: {
    marginBottom: 24,
    borderBottom: `2 solid ${palette.teal}`,
    paddingBottom: 16,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  brandName: {
    fontSize: 18,
    color: palette.teal,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 0.5,
  },
  brandTagline: {
    fontSize: 8,
    color: palette.muted,
    marginTop: 2,
  },
  reportDate: {
    fontSize: 8,
    color: palette.muted,
  },
  hero: {
    backgroundColor: palette.teal,
    borderRadius: 10,
    padding: 20,
    marginBottom: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 20,
  },
  bioAgeBox: {
    alignItems: "center",
    minWidth: 80,
  },
  bioAgeNumber: {
    fontSize: 48,
    color: palette.white,
    fontFamily: "Helvetica-Bold",
    lineHeight: 1,
  },
  bioAgeLabel: {
    fontSize: 8,
    color: "rgba(255,255,255,0.8)",
    marginTop: 4,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  heroDivider: {
    width: 1,
    backgroundColor: "rgba(255,255,255,0.25)",
    alignSelf: "stretch",
    marginHorizontal: 8,
  },
  heroText: {
    flex: 1,
  },
  heroTitle: {
    fontSize: 11,
    color: palette.white,
    fontFamily: "Helvetica-Bold",
    marginBottom: 6,
  },
  heroNarrative: {
    fontSize: 9,
    color: "rgba(255,255,255,0.9)",
    lineHeight: 1.5,
  },
  confidenceBadge: {
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 8,
    alignSelf: "flex-start",
  },
  confidenceText: {
    fontSize: 7,
    color: "rgba(255,255,255,0.8)",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  sectionCard: {
    backgroundColor: palette.white,
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    border: `1 solid ${palette.border}`,
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: palette.navy,
    marginBottom: 12,
    borderBottom: `1 solid ${palette.border}`,
    paddingBottom: 6,
  },
  domainsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  domainCard: {
    width: "18%",
    backgroundColor: palette.bg,
    borderRadius: 6,
    padding: 10,
    alignItems: "center",
  },
  domainLabel: {
    fontSize: 7,
    color: palette.muted,
    textAlign: "center",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  domainValue: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    lineHeight: 1,
  },
  domainBar: {
    height: 4,
    backgroundColor: palette.border,
    borderRadius: 2,
    width: "100%",
    marginTop: 6,
    overflow: "hidden",
  },
  domainBarFill: {
    height: 4,
    borderRadius: 2,
  },
  twoCol: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  halfCard: {
    flex: 1,
    backgroundColor: palette.white,
    borderRadius: 8,
    padding: 16,
    border: `1 solid ${palette.border}`,
  },
  listItem: {
    flexDirection: "row",
    marginBottom: 5,
    alignItems: "flex-start",
  },
  bullet: {
    width: 14,
    color: palette.teal,
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
  },
  listText: {
    flex: 1,
    fontSize: 9,
    lineHeight: 1.4,
    color: palette.navy,
  },
  supplementTier: {
    marginBottom: 12,
  },
  tierLabel: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
    alignSelf: "flex-start",
  },
  supplementItem: {
    backgroundColor: palette.bg,
    borderRadius: 6,
    padding: 10,
    marginBottom: 6,
  },
  supplementHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 3,
  },
  supplementName: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: palette.navy,
  },
  supplementDosage: {
    fontSize: 9,
    color: palette.muted,
  },
  supplementTiming: {
    fontSize: 8,
    color: palette.teal,
    marginBottom: 3,
  },
  supplementRationale: {
    fontSize: 8,
    color: palette.muted,
    lineHeight: 1.4,
  },
  supplementNote: {
    fontSize: 8,
    color: palette.amber,
    marginTop: 3,
    lineHeight: 1.3,
  },
  footer: {
    marginTop: 20,
    paddingTop: 12,
    borderTop: `1 solid ${palette.border}`,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  footerText: {
    fontSize: 7,
    color: palette.muted,
  },
  disclaimer: {
    fontSize: 7,
    color: palette.muted,
    lineHeight: 1.4,
    maxWidth: 360,
  },
});

type SupplementItem = {
  name: string;
  form: string;
  dosage: string;
  timing: string;
  priority: "critical" | "high" | "recommended" | "performance";
  domains: string[];
  rationale: string;
  note?: string;
};

type ReportData = {
  biologicalAge: number | null;
  confidenceLevel: string | null;
  narrative: string | null;
  cvRisk: number | null;
  metabolicRisk: number | null;
  neuroRisk: number | null;
  oncoRisk: number | null;
  mskRisk: number | null;
  topRiskDrivers: string[];
  topProtectiveLevers: string[];
  recommendedScreenings: string[];
  supplements: SupplementItem[];
  assessmentDate: string | null;
};

function riskColor(value: number): string {
  if (value <= 25) return palette.green;
  if (value <= 45) return "#16A34A";
  if (value <= 65) return palette.amber;
  if (value <= 80) return "#D97706";
  return palette.red;
}

function tierColor(tier: string): string {
  const map: Record<string, string> = {
    critical: "#FEE2E2",
    high: "#FEF3C7",
    recommended: "#DBEAFE",
    performance: "#D1FAE5",
  };
  return map[tier] ?? palette.bg;
}

function tierTextColor(tier: string): string {
  const map: Record<string, string> = {
    critical: palette.red,
    high: palette.amber,
    recommended: palette.teal,
    performance: palette.green,
  };
  return map[tier] ?? palette.muted;
}

function tierLabel(tier: string): string {
  const map: Record<string, string> = {
    critical: "Critical",
    high: "High priority",
    recommended: "Recommended",
    performance: "Performance",
  };
  return map[tier] ?? tier;
}

const domains: { label: string; key: keyof ReportData }[] = [
  { label: "Cardiovascular", key: "cvRisk" },
  { label: "Metabolic", key: "metabolicRisk" },
  { label: "Neurological", key: "neuroRisk" },
  { label: "Oncological", key: "oncoRisk" },
  { label: "Musculoskeletal", key: "mskRisk" },
];

export function ReportDocument({ data }: { data: ReportData }) {
  const assessmentDateStr = data.assessmentDate
    ? new Date(data.assessmentDate).toLocaleDateString("en-AU", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : new Date().toLocaleDateString("en-AU", { year: "numeric", month: "long", day: "numeric" });

  const tiers: Array<"critical" | "high" | "recommended" | "performance"> = [
    "critical",
    "high",
    "recommended",
    "performance",
  ];

  return (
    <Document
      title="Longevity Coach — Health Report"
      author="Longevity Coach"
      subject="Biological Age & Supplement Protocol"
    >
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.brandName}>Longevity Coach</Text>
              <Text style={styles.brandTagline}>Powered by Work Healthy Australia</Text>
            </View>
            <Text style={styles.reportDate}>Report generated: {assessmentDateStr}</Text>
          </View>
        </View>

        {/* Bio-age hero */}
        {data.biologicalAge != null && (
          <View style={styles.hero}>
            <View style={styles.bioAgeBox}>
              <Text style={styles.bioAgeNumber}>{Math.round(data.biologicalAge)}</Text>
              <Text style={styles.bioAgeLabel}>Biological Age</Text>
              {data.confidenceLevel && (
                <View style={styles.confidenceBadge}>
                  <Text style={styles.confidenceText}>{data.confidenceLevel} confidence</Text>
                </View>
              )}
            </View>
            <View style={styles.heroDivider} />
            <View style={styles.heroText}>
              <Text style={styles.heroTitle}>Your Health Story</Text>
              {data.narrative && (
                <Text style={styles.heroNarrative}>{data.narrative}</Text>
              )}
            </View>
          </View>
        )}

        {/* Risk domains */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Risk Domain Scores</Text>
          <Text style={{ fontSize: 8, color: palette.muted, marginBottom: 10 }}>
            0 = optimal · 100 = highest risk
          </Text>
          <View style={styles.domainsGrid}>
            {domains.map(({ label, key }) => {
              const value = data[key] as number | null;
              if (value == null) return null;
              return (
                <View key={label} style={styles.domainCard}>
                  <Text style={styles.domainLabel}>{label}</Text>
                  <Text style={[styles.domainValue, { color: riskColor(value) }]}>
                    {Math.round(value)}
                  </Text>
                  <View style={styles.domainBar}>
                    <View
                      style={[
                        styles.domainBarFill,
                        { width: `${value}%`, backgroundColor: riskColor(value) },
                      ]}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* Risk drivers & screenings */}
        {(data.topRiskDrivers.length > 0 || data.recommendedScreenings.length > 0) && (
          <View style={styles.twoCol}>
            {data.topRiskDrivers.length > 0 && (
              <View style={styles.halfCard}>
                <Text style={styles.sectionTitle}>Top Risk Factors</Text>
                {data.topRiskDrivers.map((d, i) => (
                  <View key={i} style={styles.listItem}>
                    <Text style={styles.bullet}>{i + 1}.</Text>
                    <Text style={styles.listText}>{d}</Text>
                  </View>
                ))}
              </View>
            )}
            {data.recommendedScreenings.length > 0 && (
              <View style={styles.halfCard}>
                <Text style={styles.sectionTitle}>Recommended Screenings</Text>
                {data.recommendedScreenings.map((s, i) => (
                  <View key={i} style={styles.listItem}>
                    <Text style={styles.bullet}>•</Text>
                    <Text style={styles.listText}>{s}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Supplement protocol */}
        {data.supplements.length > 0 && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Personalised Supplement Protocol</Text>
            {tiers.map((tier) => {
              const items = data.supplements.filter((s) => s.priority === tier);
              if (!items.length) return null;
              return (
                <View key={tier} style={styles.supplementTier}>
                  <Text
                    style={[
                      styles.tierLabel,
                      {
                        backgroundColor: tierColor(tier),
                        color: tierTextColor(tier),
                      },
                    ]}
                  >
                    {tierLabel(tier)}
                  </Text>
                  {items.map((s, i) => (
                    <View key={i} style={styles.supplementItem}>
                      <View style={styles.supplementHeader}>
                        <Text style={styles.supplementName}>{s.name}</Text>
                        <Text style={styles.supplementDosage}>
                          {s.dosage} · {s.form}
                        </Text>
                      </View>
                      <Text style={styles.supplementTiming}>{s.timing}</Text>
                      <Text style={styles.supplementRationale}>{s.rationale}</Text>
                      {s.note && (
                        <Text style={styles.supplementNote}>⚠ {s.note}</Text>
                      )}
                    </View>
                  ))}
                </View>
              );
            })}
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>longevity-coach.io</Text>
          <Text style={styles.disclaimer}>
            This report is for informational purposes only and does not constitute medical advice.
            Always consult a qualified healthcare practitioner before making changes to your
            supplement regimen or health management plan.
          </Text>
        </View>
      </Page>
    </Document>
  );
}
