import {
  Document,
  Page,
  Text,
  View,
  Image,
} from "@react-pdf/renderer";
import path from "node:path";
import { palette, riskLevelColor, riskLevelLabel, styles } from "./styles";

export type DomainKey =
  | "cardiovascular"
  | "metabolic"
  | "neurodegenerative"
  | "oncological"
  | "musculoskeletal";

export type EngineOutput = {
  longevity_score: number;
  longevity_label: string;
  composite_risk: number;
  biological_age: number;
  chronological_age: number | null;
  age_delta: number | null;
  risk_level: "very_low" | "low" | "moderate" | "high" | "very_high";
  domains: Record<
    DomainKey,
    {
      score: number;
      risk_level: string;
      top_modifiable_risks: Array<{
        name: string;
        score: number;
        optimal_range?: string;
      }>;
    }
  >;
  top_risks: Array<{
    name: string;
    domain: string;
    score: number;
    optimal_range?: string;
  }>;
  data_completeness: number;
  score_confidence: { level: string; note: string };
  trajectory_6month: {
    current_longevity_score: number;
    projected_longevity_score: number;
    improvements: Array<{
      factor: string;
      current_score: number;
      projected_score: number;
    }>;
  };
};

export type SupplementRow = {
  name: string;
  dose: string;
  timing?: string;
  tier?: "critical" | "high" | "recommended" | "performance";
  note?: string;
};

export type ReportData = {
  memberName: string | null;
  dateOfBirth: string | null;
  generatedAt: string; // ISO
  engineOutput: EngineOutput | null;
  supplementItems: SupplementRow[];
};

// Logo lives in /public so it ships with the build.
const LOGO_PATH = path.join(
  process.cwd(),
  "public/longevity-coach-horizontal-logo.png",
);

const DISCLAIMER =
  "Informational only. Not a substitute for medical advice. Consult a qualified healthcare practitioner before changing supplement, medication, or lifestyle decisions.";

const DOMAIN_LABEL: Record<DomainKey, string> = {
  cardiovascular: "Cardiovascular",
  metabolic: "Metabolic",
  neurodegenerative: "Neurodegenerative",
  oncological: "Oncological",
  musculoskeletal: "Musculoskeletal",
};

const DOMAIN_ORDER: DomainKey[] = [
  "cardiovascular",
  "metabolic",
  "neurodegenerative",
  "oncological",
  "musculoskeletal",
];

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-AU", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

function tierColor(tier?: string): string {
  switch (tier) {
    case "critical":
      return palette.riskHigh;
    case "high":
      return palette.riskModerate;
    case "recommended":
      return palette.primary;
    case "performance":
      return palette.sage;
    default:
      return palette.grey;
  }
}

function bioAgeText(bio: number, chron: number | null, delta: number | null): string {
  if (chron == null || delta == null) return `Bio age ${bio}`;
  if (Math.abs(delta) < 0.5) return `Bio age ${bio} · matches chronological`;
  if (delta > 0) return `Bio age ${bio} · ${delta.toFixed(1)} years younger`;
  return `Bio age ${bio} · ${Math.abs(delta).toFixed(1)} years older`;
}

function Pill({ level }: { level: string }) {
  return (
    <Text style={[styles.pill, { backgroundColor: riskLevelColor(level) }]}>
      {riskLevelLabel(level)}
    </Text>
  );
}

function PageHeader({ title }: { title: string }) {
  return (
    <View style={styles.pageHeader} fixed>
      <Image src={LOGO_PATH} style={styles.headerLogo} />
      <Text style={styles.headerEyebrow}>{title}</Text>
    </View>
  );
}

function PageFooter({ generatedAt }: { generatedAt: string }) {
  return (
    <View style={styles.footer} fixed>
      <View style={styles.footerLeft}>
        <Text style={styles.footerText}>{DISCLAIMER}</Text>
        <Text style={styles.footerText}>
          Generated {formatDate(generatedAt)} · longevity-coach.io
        </Text>
      </View>
      <Text
        style={[styles.footerText, styles.footerRight]}
        render={({ pageNumber, totalPages }) =>
          `${pageNumber} / ${totalPages}`
        }
      />
    </View>
  );
}

export function ReportDocument({ data }: { data: ReportData }) {
  const { memberName, generatedAt, engineOutput, supplementItems } = data;
  const displayName = memberName?.trim() || "Member";

  if (!engineOutput) {
    return (
      <Document
        title="Longevity Coach — Health Report"
        author="Longevity Coach"
      >
        <Page size="A4" style={styles.page}>
          <Image src={LOGO_PATH} style={styles.coverLogo} />
          <Text style={styles.coverEyebrow}>Personal Health Report</Text>
          <Text style={styles.coverMemberName}>{displayName}</Text>
          <Text style={styles.coverDate}>{formatDate(generatedAt)}</Text>
          <View style={styles.hero}>
            <View style={styles.heroLeft}>
              <Text style={styles.heroEyebrow}>Status</Text>
              <Text style={styles.heroBig}>Not yet ready</Text>
              <Text style={styles.heroSub}>
                Your risk scores are still being computed. Check back shortly,
                or refresh your dashboard.
              </Text>
            </View>
          </View>
          <PageFooter generatedAt={generatedAt} />
        </Page>
      </Document>
    );
  }

  const bioAge = Math.round(engineOutput.biological_age);
  const chronAge = engineOutput.chronological_age;
  const delta = engineOutput.age_delta;
  const confidence = engineOutput.score_confidence;
  const dataPoints = Math.round(engineOutput.data_completeness * 100);
  const longevity = Math.round(engineOutput.longevity_score);
  const composite = Math.round(engineOutput.composite_risk);

  const topRisks = engineOutput.top_risks.slice(0, 5);
  const supplementsToShow = supplementItems.slice(0, 12);
  const supplementOverflow = Math.max(0, supplementItems.length - 12);

  const traj = engineOutput.trajectory_6month;
  const improvements = traj.improvements.slice(0, 5);

  const topRiskDomain =
    topRisks[0]?.domain
      ? topRisks[0].domain.charAt(0).toUpperCase() + topRisks[0].domain.slice(1)
      : "—";

  return (
    <Document
      title="Longevity Coach — Health Report"
      author="Longevity Coach"
      subject="Personalised Health Risk Report"
    >
      {/* ---------- Page 1 — Cover (dashboard-style) ---------- */}
      <Page size="A4" style={styles.page}>
        <Image src={LOGO_PATH} style={styles.coverLogo} />
        <Text style={styles.coverEyebrow}>Personal Health Report</Text>
        <Text style={styles.coverMemberName}>{displayName}</Text>
        <Text style={styles.coverDate}>{formatDate(generatedAt)}</Text>

        {/* Hero — mirrors the dashboard hero */}
        <View style={styles.hero}>
          <View style={styles.heroLeft}>
            <Text style={styles.heroEyebrow}>Biological age</Text>
            <Text style={styles.heroBig}>
              {bioAge}
              {chronAge != null ? ` / ${chronAge}` : ""}
            </Text>
            <Text style={styles.heroSub}>
              {bioAgeText(bioAge, chronAge, delta)} · longevity score{" "}
              {longevity}/100 ({engineOutput.longevity_label}) · confidence{" "}
              {confidence.level} ({dataPoints}% of data captured)
            </Text>
          </View>
          <View style={styles.heroRight}>
            <Text style={styles.heroMiniValue}>{composite}</Text>
            <Text style={styles.heroMiniLabel}>Composite{"\n"}risk</Text>
          </View>
        </View>

        {/* Three big numbers — like the dashboard's three-tile row */}
        <View style={styles.numbersRow}>
          <View style={styles.numberTile}>
            <Text style={styles.numberLabel}>Top risk domain</Text>
            <Text style={styles.numberValue}>{topRiskDomain}</Text>
            <Text style={styles.numberSub}>
              Score {topRisks[0]?.score ?? "—"}
              {topRisks[0]?.optimal_range
                ? ` · target ${topRisks[0].optimal_range}`
                : ""}
            </Text>
          </View>
          <View style={styles.numberTile}>
            <Text style={styles.numberLabel}>6-month projection</Text>
            <Text style={styles.numberValue}>
              {Math.round(traj.projected_longevity_score)}
            </Text>
            <Text style={styles.numberSub}>
              From {Math.round(traj.current_longevity_score)} today with full
              adherence
            </Text>
          </View>
          <View style={styles.numberTile}>
            <Text style={styles.numberLabel}>Protocol size</Text>
            <Text style={styles.numberValue}>{supplementItems.length}</Text>
            <Text style={styles.numberSub}>
              {supplementItems.length === 0 ? "Awaiting protocol" : "Targeted supplements"}
            </Text>
          </View>
        </View>

        <PageFooter generatedAt={generatedAt} />
      </Page>

      {/* ---------- Page 2 — Risk profile (tile grid) ---------- */}
      <Page size="A4" style={styles.page}>
        <PageHeader title="Risk profile" />
        <Text style={styles.pageTitle}>Your five-domain risk profile</Text>
        <Text style={styles.pageSubtitle}>
          0 = optimal · 100 = highest risk · top drivers shown per domain
        </Text>

        <View style={styles.domainGrid}>
          {DOMAIN_ORDER.map((key, i) => {
            const d = engineOutput.domains[key];
            if (!d) return null;
            const factors = d.top_modifiable_risks.slice(0, 2);
            // Last odd-numbered tile spans full width on a 5-tile grid.
            const wide = i === 4;
            return (
              <View
                key={key}
                style={wide ? styles.domainTileWide : styles.domainTile}
              >
                <View style={styles.domainHead}>
                  <Text style={styles.domainName}>{DOMAIN_LABEL[key]}</Text>
                  <Pill level={d.risk_level} />
                </View>
                <View style={styles.domainScoreLine}>
                  <Text style={styles.domainScoreBig}>{Math.round(d.score)}</Text>
                </View>
                {factors.length > 0 && (
                  <Text style={styles.domainFactors}>
                    {factors
                      .map((f) =>
                        f.optimal_range ? `${f.name} (${f.optimal_range})` : f.name,
                      )
                      .join(" · ")}
                  </Text>
                )}
              </View>
            );
          })}
        </View>
        <PageFooter generatedAt={generatedAt} />
      </Page>

      {/* ---------- Page 3 — Top modifiable risks ---------- */}
      <Page size="A4" style={styles.page}>
        <PageHeader title="Top modifiable risks" />
        <Text style={styles.pageTitle}>Where to focus first</Text>
        <Text style={styles.pageSubtitle}>
          Five highest-impact factors you can change
        </Text>

        {topRisks.map((r, i) => (
          <View key={`${r.name}-${i}`} style={styles.numItem}>
            <Text style={styles.numCircle}>{i + 1}</Text>
            <View style={styles.numBody}>
              <Text style={styles.numTitle}>{r.name}</Text>
              <Text style={styles.numMeta}>
                {r.domain} · score {Math.round(r.score)}
                {r.optimal_range ? ` · optimal ${r.optimal_range}` : ""}
              </Text>
              <Text style={styles.numAction}>
                Discuss with your coach to build a targeted plan.
              </Text>
            </View>
          </View>
        ))}
        <PageFooter generatedAt={generatedAt} />
      </Page>

      {/* ---------- Page 4 — Supplement protocol ---------- */}
      <Page size="A4" style={styles.page}>
        <PageHeader title="Supplement protocol" />
        <Text style={styles.pageTitle}>Your personalised stack</Text>
        <Text style={styles.pageSubtitle}>Prioritised by tier</Text>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.th, styles.colName]}>Name</Text>
            <Text style={[styles.th, styles.colDose]}>Dose</Text>
            <Text style={[styles.th, styles.colTiming]}>Timing</Text>
            <Text style={[styles.th, styles.colTier]}>Tier</Text>
          </View>

          {supplementsToShow.map((s, i) => (
            <View key={`${s.name}-${i}`} style={styles.tableRow}>
              <Text style={[styles.td, styles.colName]}>{s.name}</Text>
              <Text style={[styles.td, styles.colDose]}>{s.dose}</Text>
              <Text style={[styles.td, styles.colTiming]}>{s.timing ?? "—"}</Text>
              <Text
                style={[
                  styles.td,
                  styles.colTier,
                  { color: tierColor(s.tier), fontFamily: "Helvetica-Bold" },
                ]}
              >
                {s.tier ?? "—"}
              </Text>
            </View>
          ))}
        </View>

        {supplementOverflow > 0 && (
          <Text style={[styles.footerText, { marginTop: 8 }]}>
            +{supplementOverflow} more in your dashboard
          </Text>
        )}
        <PageFooter generatedAt={generatedAt} />
      </Page>

      {/* ---------- Page 5 — 6-month projection ---------- */}
      <Page size="A4" style={styles.page}>
        <PageHeader title="6-month projection" />
        <Text style={styles.pageTitle}>Where you could be in six months</Text>
        <Text style={styles.pageSubtitle}>
          With full protocol adherence (assumed 70%)
        </Text>

        <View style={styles.projRow}>
          <View style={styles.projBox}>
            <Text style={styles.projLabel}>Today</Text>
            <Text style={styles.projNumber}>
              {Math.round(traj.current_longevity_score)}
            </Text>
          </View>
          <View style={styles.projBoxProjected}>
            <Text style={styles.projLabelProjected}>Projected</Text>
            <Text style={styles.projNumberProjected}>
              {Math.round(traj.projected_longevity_score)}
            </Text>
          </View>
        </View>

        <Text
          style={{
            fontSize: 10.5,
            fontFamily: "Helvetica-Bold",
            color: palette.primary700,
            marginBottom: 6,
          }}
        >
          Top improvements driving your projection
        </Text>

        {improvements.map((imp, i) => (
          <View key={`${imp.factor}-${i}`} style={styles.bullet}>
            <Text style={styles.bulletDot}>•</Text>
            <Text style={styles.bulletText}>
              {imp.factor}: {Math.round(imp.current_score)} →{" "}
              {Math.round(imp.projected_score)}
            </Text>
          </View>
        ))}
        <PageFooter generatedAt={generatedAt} />
      </Page>
    </Document>
  );
}
