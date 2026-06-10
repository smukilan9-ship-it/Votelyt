import type { Metadata } from "next";
import { Plus_Jakarta_Sans, DM_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/ui/Toast";

const serif = Instrument_Serif({
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
  weight: "400",
  style: ["normal", "italic"],
});

const sans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
  weight: ["300", "400", "500", "600", "700", "800"],
});

const mono = DM_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
  weight: ["300", "400", "500"],
});

export const metadata: Metadata = {
  title: "Votelyt — Cast your vote.",
  description:
    "A modern voting platform for organisations. Private ballots, live turnout, and results that stay sealed until polls close.",
  applicationName: "Votelyt",
  icons: {
    icon: "/icon.svg",
  },
  openGraph: {
    title: "Votelyt — Cast your vote.",
    description:
      "A modern voting platform for organisations. Private ballots, live turnout, and results that stay sealed until polls close.",
    siteName: "Votelyt",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Votelyt — Cast your vote.",
    description:
      "A modern voting platform for organisations. Private ballots, live turnout, and results that stay sealed until polls close.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`h-full antialiased ${serif.variable} ${sans.variable} ${mono.variable}`}
    >
      <body className="min-h-full bg-[#000] font-sans text-white">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
