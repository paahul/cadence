import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Newsreader } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  style: ["normal", "italic"],
  weight: ["400", "500", "600"],
});

const SITE_URL = "https://cadence.paahulhq.com";
const DESCRIPTION =
  "A speaking coach that listens to how you communicate and tells you, specifically, what to work on next. Six dimensions — clarity, conciseness, confidence, word precision, pace, pronunciation clarity — scored from your own voice, with a daily read each weekday morning.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Cadence — a speaking coach",
    template: "%s · Cadence",
  },
  description: DESCRIPTION,
  applicationName: "Cadence",
  appleWebApp: {
    capable: true,
    title: "Cadence",
    statusBarStyle: "black-translucent",
  },
  openGraph: {
    title: "Cadence — a speaking coach",
    description: DESCRIPTION,
    url: SITE_URL,
    siteName: "Cadence",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Cadence — a speaking coach",
    description: DESCRIPTION,
  },
};

export const viewport: Viewport = {
  themeColor: "#f7f4ee",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-line bg-paper-2/60">
      <div className="mx-auto flex w-full max-w-5xl flex-col items-start justify-between gap-2 px-6 py-4 text-xs text-muted sm:flex-row sm:items-center">
        <span className="font-[family-name:var(--font-newsreader)] italic">
          A side project by Paahul Sikand.
        </span>
        <div className="flex items-center gap-4">
          <a
            href="https://github.com/paahul/cadence"
            target="_blank"
            rel="noreferrer"
            className="transition-colors hover:text-accent"
          >
            GitHub
          </a>
          <a
            href="https://www.linkedin.com/in/paahul/"
            target="_blank"
            rel="noreferrer"
            className="transition-colors hover:text-accent"
          >
            LinkedIn
          </a>
        </div>
      </div>
    </footer>
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${newsreader.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-paper text-ink">
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
