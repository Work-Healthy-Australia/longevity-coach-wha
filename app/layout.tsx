import type { Metadata } from "next";
import { Newsreader, Instrument_Sans, JetBrains_Mono } from "next/font/google";
import { SITE } from "@/lib/seo/site";
import { Toaster } from "./_components/toaster";
import "./globals.css";

const newsreader = Newsreader({
  variable: "--font-lc-serif",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  style: ["normal", "italic"],
  display: "swap",
});

const instrumentSans = Instrument_Sans({
  variable: "--font-lc-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-lc-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: SITE.defaultTitle,
    template: `%s · ${SITE.name}`,
  },
  description: SITE.defaultDescription,
  applicationName: SITE.name,
  authors: [{ name: SITE.name, url: SITE.url }],
  creator: SITE.name,
  publisher: SITE.name,
  formatDetection: { telephone: false, email: false, address: false },
  keywords: [
    "biological age test",
    "longevity coach",
    "personalised supplement protocol",
    "preventive health",
    "health risk scores",
    "Janet Cares",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_AU",
    url: SITE.url,
    siteName: SITE.name,
    title: SITE.defaultTitle,
    description: SITE.defaultDescription,
    // Next.js automatically picks up app/opengraph-image.tsx;
    // this entry guarantees URL absoluteness in social cards.
    images: [
      {
        url: "/opengraph-image",
        width: SITE.ogImageWidth,
        height: SITE.ogImageHeight,
        alt: `${SITE.name} — personalised longevity coaching`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE.defaultTitle,
    description: SITE.defaultDescription,
    images: ["/opengraph-image"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en-AU"
      className={`${newsreader.variable} ${instrumentSans.variable} ${jetbrainsMono.variable}`}
    >
      <body>
        {children}
        <Toaster />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@graph": [
                {
                  "@type": "Organization",
                  "@id": `${SITE.url}#organization`,
                  name: SITE.name,
                  url: SITE.url,
                  logo: {
                    "@type": "ImageObject",
                    url: `${SITE.url}/janet-cares-logo.png`,
                  },
                  sameAs: [],
                },
                {
                  "@type": "WebSite",
                  "@id": `${SITE.url}#website`,
                  url: SITE.url,
                  name: SITE.name,
                  description: SITE.defaultDescription,
                  publisher: { "@id": `${SITE.url}#organization` },
                  inLanguage: "en-AU",
                },
              ],
            }),
          }}
        />
      </body>
    </html>
  );
}
