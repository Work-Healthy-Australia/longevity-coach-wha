/**
 * Generates sample PDF fixtures for testing the upload + Janet analysis pipeline.
 * Australian pathology format (Sullivan Nicolaides / Dorevitch style).
 * Output: tests/fixtures/uploads/*.pdf
 *
 * Run with: node scripts/generate-sample-uploads.mjs
 */

import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "../tests/fixtures/uploads");

mkdirSync(OUT_DIR, { recursive: true });

// ---------------------------------------------------------------------------
// PDF builder — uses Tm (absolute text matrix) so each line is correctly placed
// ---------------------------------------------------------------------------

function buildPdf(lines) {
  const pageWidth = 612;
  const pageHeight = 792;
  const marginLeft = 50;
  const startY = 750;
  const lineH = 14;

  let stream = "BT\n/F1 9 Tf\n";
  let y = startY;

  for (const line of lines) {
    if (y < 40) break;
    // Tm sets the text matrix to an absolute position — avoids cumulative drift
    const safe = line
      .replace(/\\/g, "\\\\")
      .replace(/\(/g, "\\(")
      .replace(/\)/g, "\\)");
    stream += `1 0 0 1 ${marginLeft} ${y} Tm\n(${safe}) Tj\n`;
    y -= lineH;
  }

  stream += "ET\n";

  const streamBuf = Buffer.from(stream, "latin1");
  const streamLen = streamBuf.length;

  const o1 = Buffer.from("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  const o2 = Buffer.from("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");
  const o3 = Buffer.from(
    `3 0 obj\n<< /Type /Page /Parent 2 0 R\n` +
    `   /MediaBox [0 0 ${pageWidth} ${pageHeight}]\n` +
    `   /Contents 4 0 R\n` +
    `   /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Courier >> >> >>\n` +
    `>>\nendobj\n`
  );
  const o4h = Buffer.from(`4 0 obj\n<< /Length ${streamLen} >>\nstream\n`);
  const o4f = Buffer.from("\nendstream\nendobj\n");

  const header = Buffer.from("%PDF-1.4\n");
  const off1 = header.length;
  const off2 = off1 + o1.length;
  const off3 = off2 + o2.length;
  const off4 = off3 + o3.length;
  const xrefOff = off4 + o4h.length + streamLen + o4f.length;

  const pad = (n) => String(n).padStart(10, "0");
  const xref = Buffer.from(
    `xref\n0 5\n` +
    `0000000000 65535 f \n` +
    `${pad(off1)} 00000 n \n` +
    `${pad(off2)} 00000 n \n` +
    `${pad(off3)} 00000 n \n` +
    `${pad(off4)} 00000 n \n` +
    `trailer\n<< /Size 5 /Root 1 0 R >>\n` +
    `startxref\n${xrefOff}\n%%EOF\n`
  );

  return Buffer.concat([header, o1, o2, o3, o4h, streamBuf, o4f, xref]);
}

// ---------------------------------------------------------------------------
// Sample documents — Australian pathology style
// ---------------------------------------------------------------------------

const samples = [
  // ------------------------------------------------------------------
  // 1. Comprehensive Blood Count + Lipid Panel (blood_work)
  // ------------------------------------------------------------------
  {
    filename: "blood-work-lipid-fbc.pdf",
    lines: [
      "SULLIVAN NICOLAIDES PATHOLOGY",
      "ABN 62 010 973 254   |   Medicare Provider: 4567891B",
      "12 Metroplex Ave, Murarrie QLD 4172   |   (07) 3120 0600",
      "───────────────────────────────────────────────────────────────────",
      "PATIENT:  Murray, James Robert          DOB: 14/03/1978  M",
      "UR:       SNP-2026-0031847              Medicare: 2345 67890 1",
      "REFERRED: Dr Sarah Chen  (Provider 234567A)  Brisbane Medical Centre",
      "COLLECTED: 10/03/2026  07:42  REPORTED: 11/03/2026  08:15",
      "───────────────────────────────────────────────────────────────────",
      "FULL BLOOD COUNT                                    MBS Item 65070",
      "",
      "Test                        Result    Units       Reference Range",
      "Haemoglobin                  148      g/L          130 - 175",
      "Red Cell Count               4.92     x10^12/L     4.50 - 5.90",
      "Haematocrit                  0.44     L/L          0.40 - 0.52",
      "MCV                           89      fL           80 - 100",
      "MCH                           30      pg           27 - 34",
      "MCHC                         335      g/L          310 - 360",
      "RDW                           13.2    %            11.5 - 15.0",
      "White Cell Count               6.2    x10^9/L      4.0 - 11.0",
      "  Neutrophils                  3.8    x10^9/L      2.0 - 7.5",
      "  Lymphocytes                  1.7    x10^9/L      1.0 - 4.0",
      "  Monocytes                    0.5    x10^9/L      0.2 - 1.0",
      "  Eosinophils                  0.2    x10^9/L      0.0 - 0.5",
      "  Basophils                    0.0    x10^9/L      0.0 - 0.1",
      "Platelets                     224     x10^9/L      150 - 400",
      "MPV                             9.1   fL           7.5 - 12.5",
      "",
      "LIPID STUDIES (FASTING)                             MBS Item 66500",
      "",
      "Total Cholesterol              5.8 H  mmol/L       < 5.5",
      "HDL Cholesterol                1.2    mmol/L       > 1.0",
      "LDL Cholesterol (calc)         3.9 H  mmol/L       < 3.5",
      "Triglycerides                  1.5    mmol/L       < 2.0",
      "Non-HDL Cholesterol            4.6 H  mmol/L       < 4.3",
      "Total Chol / HDL Ratio         4.8    ratio        < 5.0",
      "",
      "  H = above upper reference limit",
      "  Elevated LDL and total cholesterol noted.",
      "  Fasting confirmed by patient. Review dietary fat intake.",
      "",
      "METABOLIC SCREEN                                    MBS Item 66500",
      "",
      "Fasting Glucose                5.4    mmol/L       3.9 - 6.0",
      "HbA1c                           38    mmol/mol     < 42",
      "Sodium                         140    mmol/L       135 - 145",
      "Potassium                        4.2  mmol/L       3.5 - 5.0",
      "Chloride                       103    mmol/L       95 - 110",
      "Bicarbonate                     26    mmol/L       22 - 32",
      "Urea                             5.8  mmol/L       3.0 - 8.0",
      "Creatinine                      82    umol/L       60 - 110",
      "eGFR (CKD-EPI)               > 90    mL/min/1.73m2",
      "Urate (Uric Acid)              0.34   mmol/L       0.21 - 0.42",
      "Total Bilirubin                 12    umol/L       < 20",
      "ALT                             32    U/L          < 45",
      "AST                             28    U/L          < 40",
      "GGT                             24    U/L          < 60",
      "ALP                             72    U/L          35 - 110",
      "Total Protein                   73    g/L          65 - 85",
      "Albumin                         44    g/L          35 - 50",
      "",
      "MICRONUTRIENTS                                      MBS Item 66833",
      "",
      "25-OH Vitamin D                 58    nmol/L       50 - 150",
      "Vitamin B12                    312    pmol/L       145 - 637",
      "Folate (serum)                  18    nmol/L       > 7",
      "Ferritin                        42    ug/L         30 - 300",
      "Iron                            19    umol/L       10 - 30",
      "Transferrin Saturation          28    %            15 - 45",
      "hsCRP                            1.8  mg/L         < 3.0",
      "TSH                              2.1  mIU/L        0.4 - 4.0",
      "",
      "───────────────────────────────────────────────────────────────────",
      "Authorised by: Dr A. Thompson FRCPA   Pathologist",
      "Sullivan Nicolaides Pathology  |  Report Date: 11/03/2026",
      "This report is confidential and intended solely for the requesting practitioner.",
    ],
  },

  // ------------------------------------------------------------------
  // 2. Hormone & Longevity Panel (blood_work)
  // ------------------------------------------------------------------
  {
    filename: "blood-work-hormones.pdf",
    lines: [
      "DOREVITCH PATHOLOGY",
      "ABN 41 007 186 628   |   Medicare Provider: 7654321C",
      "310 Burwood Hwy, Burwood VIC 3125   |   (03) 9895 0000",
      "───────────────────────────────────────────────────────────────────",
      "PATIENT:  Murray, James Robert          DOB: 14/03/1978  M",
      "UR:       DVP-2026-0019234              Medicare: 2345 67890 1",
      "REFERRED: Dr Sarah Chen  (Provider 234567A)",
      "COLLECTED: 22/01/2026  07:15  REPORTED: 23/01/2026  09:40",
      "───────────────────────────────────────────────────────────────────",
      "HORMONE & LONGEVITY PANEL                           MBS Item 66716",
      "",
      "Test                        Result    Units       Reference Range",
      "Total Testosterone          18.4      nmol/L       9.9 - 27.8",
      "Free Testosterone (calc)   320        pmol/L       196 - 636",
      "SHBG                        42        nmol/L       18 - 54",
      "DHEA-Sulphate                6.8      umol/L       4.3 - 12.2",
      "Oestradiol (E2)             95        pmol/L       < 185",
      "LH                           4.2      IU/L         2.0 - 9.0",
      "FSH                          5.1      IU/L         2.0 - 12.0",
      "Prolactin                   230        mIU/L       86 - 324",
      "IGF-1                       188        ug/L        115 - 307",
      "Cortisol (AM 0800h)         410        nmol/L      171 - 536",
      "ACTH                         18 H      pmol/L      < 10",
      "",
      "  H = above upper reference limit",
      "  ACTH mildly elevated. Repeat in 4 weeks if clinically indicated.",
      "  Testosterone and SHBG within normal range for age.",
      "",
      "THYROID FUNCTION                                    MBS Item 66716",
      "",
      "TSH                          1.8       mIU/L       0.40 - 4.00",
      "Free T4 (fT4)               15.2       pmol/L      9.0 - 19.0",
      "Free T3 (fT3)                5.1       pmol/L      2.6 - 6.0",
      "Anti-TPO Antibodies          < 6       IU/mL       < 34",
      "Anti-Thyroglobulin Ab        < 10      IU/mL       < 115",
      "",
      "  Thyroid function tests normal.",
      "",
      "INFLAMMATORY & CARDIOVASCULAR MARKERS              MBS Item 66847",
      "",
      "hsCRP                        0.9       mg/L        < 1.0",
      "IL-6                         1.4       pg/mL       < 7.0",
      "Homocysteine                12.1       umol/L      < 15.0",
      "Fibrinogen                   3.1       g/L         2.0 - 4.5",
      "Lipoprotein(a) [Lp(a)]      62 H       nmol/L      < 75  (moderate risk)",
      "ApoB                         1.0 H     g/L         < 0.9",
      "ApoA1                        1.4       g/L         > 1.2",
      "",
      "  Lp(a) in moderate risk zone. Discuss cardiovascular risk management.",
      "  Elevated ApoB consistent with elevated LDL from previous lipid panel.",
      "",
      "───────────────────────────────────────────────────────────────────",
      "Authorised by: Dr M. Patel FRACP FRCPA   Consultant Pathologist",
      "Dorevitch Pathology  |  Report Date: 23/01/2026",
    ],
  },

  // ------------------------------------------------------------------
  // 3. DEXA Body Composition (metabolic / imaging)
  // ------------------------------------------------------------------
  {
    filename: "dexa-body-composition.pdf",
    lines: [
      "ADVANCED IMAGING SYDNEY",
      "ABN 88 120 345 678   |   Accreditation: RANZCR / ASAR",
      "Level 2, 175 Liverpool St, Sydney NSW 2000   |   (02) 9283 5000",
      "───────────────────────────────────────────────────────────────────",
      "PATIENT:  Murray, James Robert          DOB: 14/03/1978  M",
      "Referrer: Dr Sarah Chen  (Provider 234567A)",
      "Accession: AIS-2026-00871",
      "Study Date: 05/02/2026   Reported: 06/02/2026",
      "Scanner: Hologic Horizon W DXA   Software: APEX 6.0",
      "───────────────────────────────────────────────────────────────────",
      "WHOLE-BODY COMPOSITION",
      "",
      "                            Result      % Total",
      "Total Body Mass:            82.4 kg",
      "Fat Mass:                   18.9 kg      22.9 %",
      "Lean Soft Tissue Mass:      60.8 kg      73.8 %",
      "Bone Mineral Content:        2.7 kg       3.3 %",
      "",
      "REGIONAL BODY FAT",
      "",
      "Region                  Fat Mass    Fat %    Percentile (M 45-49)",
      "Left Arm                  0.6 kg     24.1 %      35th",
      "Right Arm                 0.6 kg     23.8 %      34th",
      "Left Leg                  3.1 kg     21.4 %      40th",
      "Right Leg                 3.2 kg     21.9 %      41st",
      "Trunk                    11.2 kg     24.3 %      62nd",
      "",
      "Android (Trunk) Fat %:     27.1 %    (Reference for Males: < 25 %)",
      "Gynoid Fat %:              18.4 %",
      "Android / Gynoid Ratio:     1.47     (Elevated — cardiovascular risk marker)",
      "",
      "VISCERAL ADIPOSE TISSUE (VAT)",
      "  VAT Area:     312 cm2   (Moderate-High. Target: < 100 cm2)",
      "  VAT Mass:     302 g",
      "  VAT Volume:   302 cm3",
      "",
      "BONE MINERAL DENSITY (BMD)",
      "",
      "Site               BMD g/cm2   T-score   Z-score   Classification",
      "Lumbar Spine L1-L4   1.182      +0.8      +0.5      Normal",
      "Left Femoral Neck    0.978      -0.2      +0.2      Normal",
      "Left Total Hip       1.043       0.0      +0.3      Normal",
      "Right Femoral Neck   0.991      -0.1      +0.3      Normal",
      "Right Total Hip      1.051      +0.1      +0.4      Normal",
      "",
      "WHO Classification:  Normal (T-score > -1.0)",
      "10-year fracture risk (FRAX): Hip 0.5%  Major osteoporotic 2.4%",
      "",
      "LEAN MASS & MUSCLE",
      "  Appendicular Lean Mass Index (ALMI): 8.4 kg/m2",
      "  Muscle quality adequate. No evidence of sarcopenia (ALMI > 7.0 kg/m2).",
      "",
      "SUMMARY",
      "  Body fat percentage mildly elevated (22.9%). Visceral adipose tissue",
      "  borderline elevated — weight loss of 5 kg would meaningfully reduce",
      "  cardiovascular risk. Bone mineral density normal throughout.",
      "  No evidence of osteopenia or osteoporosis.",
      "",
      "───────────────────────────────────────────────────────────────────",
      "Reported by: Dr R. Wong FRANZCR   Radiologist",
      "Advanced Imaging Sydney  |  Report Date: 06/02/2026",
    ],
  },

  // ------------------------------------------------------------------
  // 4. Gut Microbiome (microbiome)
  // ------------------------------------------------------------------
  {
    filename: "gut-microbiome.pdf",
    lines: [
      "MICROBA INSIGHT  |  Gut Microbiome Report",
      "ABN 27 606 050 044   |   NATA Accredited Laboratory 21521",
      "Level 5, UQ Health Sciences Building, Herston QLD 4006",
      "───────────────────────────────────────────────────────────────────",
      "PATIENT:  Murray, James Robert          DOB: 14/03/1978  M",
      "Kit ID:   MB-AUS-2026-00-44172",
      "Collection Date: 18/02/2026   Report Date: 01/03/2026",
      "Referring Practitioner: Dr Sarah Chen",
      "───────────────────────────────────────────────────────────────────",
      "SAMPLE QUALITY",
      "  DNA yield: 48 ng/uL (Pass)   Reads: 1,241,000 (Pass)",
      "  Relative completeness: 94%",
      "",
      "MICROBIOME HEALTH SCORES  (0-100, population median = 50)",
      "",
      "Overall Microbiome Health Score:        62 / 100   Average",
      "Digestive Efficiency Score:             74 / 100   Good",
      "Gut Inflammation Index:                 44 / 100   Below Average",
      "Short-Chain Fatty Acid (SCFA) Score:    58 / 100   Average",
      "  Butyrate potential:                   55 / 100",
      "  Propionate potential:                 61 / 100",
      "  Acetate potential:                    62 / 100",
      "Protein Fermentation Index:             31 / 100   Poor",
      "Microbiome Diversity (Shannon H):        3.8        Average (Ref: > 3.5)",
      "",
      "KEY MICROORGANISM FINDINGS",
      "",
      "Organism                           Relative    Status     Note",
      "                                   Abundance",
      "Faecalibacterium prausnitzii         0.4 %      LOW        Anti-inflammatory",
      "Akkermansia muciniphila              0.1 %      LOW        Gut lining integrity",
      "Bifidobacterium longum               1.2 %      Moderate",
      "Lactobacillus acidophilus            0.3 %      Adequate",
      "Roseburia intestinalis               0.8 %      Adequate   Butyrate producer",
      "Ruminococcus gnavus                  3.1 %      HIGH       Pro-inflammatory",
      "Prevotella copri                     4.8 %      HIGH       Joint inflammation link",
      "Blautia obeum                        2.2 %      Adequate",
      "Bacteroides fragilis                 5.4 %      Adequate",
      "",
      "DIETARY RECOMMENDATIONS",
      "",
      "  Prioritise: Resistant starch (green banana, cooked & cooled potato),",
      "    legumes (3-4 serves/week), fermented vegetables (sauerkraut, kimchi),",
      "    diverse vegetables (30+ plant species/week).",
      "",
      "  Reduce: Processed red meat, refined sugars, ultra-processed foods.",
      "",
      "  Supplement considerations for practitioner review:",
      "    - Targeted probiotic strain: Akkermansia muciniphila (Pendulum Akkermansia)",
      "    - Tributyrin / Butyrate precursor supplementation",
      "    - Partially hydrolysed guar gum (PHGG) 5 g/day",
      "",
      "PATHOGEN SCREEN",
      "  Clostridioides difficile:  Not detected",
      "  Salmonella spp.:           Not detected",
      "  Campylobacter spp.:        Not detected",
      "  Escherichia coli (STEC):   Not detected",
      "",
      "───────────────────────────────────────────────────────────────────",
      "Reviewed by: Dr J. Staudacher PhD (Microbiome Science)",
      "This report is for informational purposes only. Discuss results with",
      "your healthcare practitioner before making dietary or supplement changes.",
      "Microba Insight  |  Report Date: 01/03/2026",
    ],
  },

  // ------------------------------------------------------------------
  // 5. VO2 Max / CPET (metabolic)
  // ------------------------------------------------------------------
  {
    filename: "vo2max-metabolic-test.pdf",
    lines: [
      "PERFORMANCE HEALTH LABORATORY — CPET REPORT",
      "ABN 53 098 234 761   |   Exercise & Sport Science Australia (ESSA) Registered",
      "Suite 4, 88 Walker St, North Sydney NSW 2060   |   (02) 9957 4400",
      "───────────────────────────────────────────────────────────────────",
      "PATIENT:  Murray, James Robert          DOB: 14/03/1978  M  Age: 47",
      "Height: 178 cm   Weight: 82.4 kg   BMI: 26.0 kg/m2",
      "Referring Practitioner: Dr Sarah Chen",
      "Test Date: 12/11/2025   Report Date: 14/11/2025",
      "Protocol: Modified Bruce Treadmill   Test Duration: 14:22",
      "Reason for test: Longevity / performance baseline",
      "───────────────────────────────────────────────────────────────────",
      "CARDIOPULMONARY EXERCISE TEST (CPET) RESULTS",
      "",
      "MAXIMAL AEROBIC CAPACITY",
      "  VO2 Max:                    44.8  mL/kg/min",
      "  VO2 Max (absolute):          3.69  L/min",
      "  Age-predicted Max HR (220-age): 173 bpm",
      "  Peak HR achieved:            181  bpm   (104.6% of predicted — acceptable)",
      "  Peak RER:                    1.18        (> 1.10 confirms maximal effort)",
      "  Peak Power output:           310  W",
      "  Peak Ventilation (VE):       138  L/min",
      "",
      "VENTILATORY THRESHOLDS",
      "  VT1 — Aerobic Threshold:    28.2  mL/kg/min @ 128 bpm (63% VO2 Max)",
      "  VT2 — Anaerobic Threshold:  36.4  mL/kg/min @ 158 bpm (81% VO2 Max)",
      "",
      "  A high VT2/VO2 max ratio (81%) is a positive finding.",
      "  VT1 relatively low — suggests limited Zone 2 aerobic base.",
      "",
      "RESTING METABOLIC RATE (RMR)",
      "  Measured RMR:               1,924  kcal/day",
      "  Predicted RMR (Mifflin-St Jeor): 1,842 kcal/day",
      "  Measured / Predicted:         104 %  (within normal range)",
      "  Resting RQ:                   0.82   (predominantly fat oxidation at rest)",
      "",
      "RECOVERY",
      "  HR at 1-min post-exercise:   142 bpm",
      "  HR at 2-min post-exercise:   118 bpm",
      "  Heart Rate Recovery (HRR1):   39 bpm  (Normal: > 12 bpm)",
      "",
      "NORMATIVE DATA — Males 45-49 years (Australian population)",
      "",
      "  VO2 Max (mL/kg/min)    Percentile    Classification",
      "  >= 51.0                90th+         Superior",
      "  46.1 - 51.0            75th-90th     Excellent",
      "  44.8 [PATIENT]         68th          Good",
      "  41.0 - 44.7            50th-67th     Average",
      "  < 35.0                 < 25th        Poor",
      "",
      "INTERPRETATION",
      "  VO2 Max of 44.8 mL/kg/min places this patient in the 'Good' category",
      "  for his age group (68th percentile). Aerobic capacity is above average",
      "  with good maximal effort confirmed (RER 1.18).",
      "",
      "  Primary recommendation: Increase Zone 2 training (128-148 bpm) to 3x/week",
      "  x 45 min to raise VT1 and improve metabolic flexibility.",
      "",
      "  No ECG abnormalities detected during testing.",
      "",
      "───────────────────────────────────────────────────────────────────",
      "Reported by: Dr C. Armstrong PhD, ESSA AEP",
      "Performance Health Laboratory  |  Report Date: 14/11/2025",
    ],
  },

  // ------------------------------------------------------------------
  // 6. Genetic / Genomic Report (genetic)
  // ------------------------------------------------------------------
  {
    filename: "genetic-23andme.pdf",
    lines: [
      "GENOMIC HEALTH REPORT — SELECTED VARIANTS",
      "Provided by: 23andMe Health + Ancestry Service",
      "CLIA Lab: Labcorp  CLIA# 05D2081492",
      "───────────────────────────────────────────────────────────────────",
      "PATIENT:  Murray, James Robert          DOB: 14/03/1978  M",
      "Sample ID: 23A-AUS-2025-88214",
      "Genotyping Array: GSA-24 v3   Report Date: 20/08/2025",
      "───────────────────────────────────────────────────────────────────",
      "IMPORTANT: This report is for informational purposes only.",
      "Discuss results with a genetic counsellor or medical practitioner.",
      "Genetics is one factor — lifestyle and environment have equal influence.",
      "───────────────────────────────────────────────────────────────────",
      "",
      "CARDIOVASCULAR RISK VARIANTS",
      "",
      "Gene / SNP           Genotype  Interpretation",
      "APOE (rs429358/      e3/e4     1 x APOE e4 allele. Moderate increased",
      " rs7412)                       risk of Alzheimer disease and CVD.",
      "                               Discuss with practitioner.",
      "PCSK9 (rs11591147)   C/T       Partial gain-of-function; modestly",
      "                               elevated LDL expected.",
      "Factor V Leiden      G/G       Not detected. Normal clotting risk.",
      "(rs6025)",
      "MTHFR C677T          C/T       Heterozygous. ~40% reduction in enzyme",
      "(rs1801133)                    activity. Consider methylfolate supplement.",
      "MTHFR A1298C         A/C       Heterozygous compound. Monitor serum",
      "(rs1801131)                    homocysteine. Target < 10 umol/L.",
      "",
      "METABOLIC & NUTRITION VARIANTS",
      "",
      "LCT (rs4988235)      T/T       Lactase persistence. Tolerates dairy.",
      "FADS1 (rs174546)     T/C       Reduced delta-5 desaturase activity.",
      "                               Lower conversion of ALA to EPA/DHA.",
      "                               Supplement preformed EPA/DHA (fish oil).",
      "VDR (rs2228570)      A/G       Reduced Vitamin D receptor activity.",
      "                               Supplement Vitamin D3 (target 75-150",
      "                               nmol/L). Retest in 3 months.",
      "SLC23A1 (rs33972313) G/G       Normal Vitamin C transport. No action.",
      "FTO (rs9939609)      A/T       One copy of obesity-risk allele.",
      "                               Moderate increased appetite — dietary",
      "                               awareness recommended.",
      "",
      "LONGEVITY & STRESS RESPONSE",
      "",
      "FOXO3 (rs2802292)    G/T       One longevity-associated allele.",
      "COMT Val158Met       Val/Met   Moderate dopamine/adrenaline clearance.",
      "(rs4680)                       Moderate caffeine intake recommended",
      "                               (< 200 mg/day). Good stress resilience.",
      "SIRT1 (rs12778366)   C/T       Moderate circadian regulation variant.",
      "                               Consistent sleep schedule beneficial.",
      "NRF2 (rs35652124)    C/T       Moderate antioxidant response pathway.",
      "                               Sulforaphane (broccoli sprouts) supported.",
      "",
      "PHARMACOGENOMICS",
      "",
      "CYP2C19              *1/*2     Intermediate metaboliser.",
      "                               Clopidogrel (Plavix) may have reduced",
      "                               efficacy. Consult cardiologist if prescribed.",
      "CYP2D6               *1/*1     Normal metaboliser.",
      "CYP3A4/5             *1/*3     Intermediate. Monitor standard dosing for",
      "                               statins metabolised by CYP3A4.",
      "",
      "───────────────────────────────────────────────────────────────────",
      "Reviewed by: Board-Certified Genetic Counsellor",
      "23andMe Health  |  Report Date: 20/08/2025",
    ],
  },
];

// ---------------------------------------------------------------------------
// Write files
// ---------------------------------------------------------------------------

for (const { filename, lines } of samples) {
  const pdf = buildPdf(lines);
  const outPath = join(OUT_DIR, filename);
  writeFileSync(outPath, pdf);
  console.log(`Created: tests/fixtures/uploads/${filename}  (${pdf.length} bytes)`);
}

console.log(`\nDone — ${samples.length} sample PDFs written to tests/fixtures/uploads/`);
