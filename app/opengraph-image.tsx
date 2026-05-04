import { ImageResponse } from "next/og";

// Default OpenGraph image for the site. Per-page pages can shadow this by
// adding their own opengraph-image.tsx in their route folder.

export const runtime = "edge";
export const alt = "Janet Cares — personalised longevity coaching";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background:
            "linear-gradient(160deg, #FFFFFF 0%, #F4F7F9 60%, #EEF3F6 100%)",
          padding: "72px 80px",
          fontFamily: "Georgia, 'Iowan Old Style', serif",
          color: "#2B2B2B",
          position: "relative",
        }}
      >
        {/* Eyebrow */}
        <div
          style={{
            display: "flex",
            fontSize: 18,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "#2F6F8F",
            fontFamily: "system-ui, sans-serif",
            fontWeight: 500,
          }}
        >
          Janet Cares · Personalised longevity
        </div>

        {/* Headline */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginTop: 60,
            lineHeight: 1.02,
            letterSpacing: "-0.025em",
          }}
        >
          <div
            style={{
              fontSize: 110,
              fontWeight: 400,
              color: "#2B2B2B",
            }}
          >
            Live longer,
          </div>
          <div
            style={{
              fontSize: 110,
              fontWeight: 400,
              fontStyle: "italic",
              color: "#2F6F8F",
            }}
          >
            on purpose.
          </div>
        </div>

        {/* Subhead */}
        <div
          style={{
            display: "flex",
            marginTop: 40,
            fontSize: 28,
            lineHeight: 1.45,
            color: "#4B4B4B",
            fontFamily: "system-ui, sans-serif",
            fontWeight: 400,
            maxWidth: 880,
          }}
        >
          A clinically grounded biological age, risk scores across five domains,
          and a supplement, exercise and meal plan made for you — not for everyone.
        </div>

        {/* Footer row */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: "auto",
            paddingTop: 40,
            borderTop: "1px solid #E3E8EC",
            fontFamily: "system-ui, sans-serif",
            fontSize: 18,
            letterSpacing: "0.06em",
            color: "#8A9AA5",
            textTransform: "uppercase",
          }}
        >
          <div style={{ display: "flex" }}>janet.care</div>
          <div style={{ display: "flex" }}>
            AHPRA-registered clinicians · Cancel anytime
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
