import type { Metadata } from "next";
import { Cinzel, Quicksand } from "next/font/google";
import "./globals.css";

const quicksand = Quicksand({ subsets: ["latin"], variable: "--font-quicksand" });
const cinzel = Cinzel({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-cinzel" });

const TITLE = "Wisdom of the Wind: Top Strategies on Neverland";
const DESCRIPTION = "Find your best Neverland strategy. Live rates, dollar estimates, clear risks.";

export const metadata: Metadata = {
  metadataBase: new URL("https://wisdom-of-the-wind.vercel.app"),
  title: TITLE,
  description: DESCRIPTION,
  // Used for link previews in X, Telegram, Discord, iMessage, Slack…
  openGraph: {
    type: "website",
    url: "/",
    siteName: "Wisdom of the Wind",
    title: TITLE,
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${quicksand.variable} ${cinzel.variable}`}>
      {/* Browser extensions (e.g. ColorZilla) add attributes to <body> before React loads. */}
      <body className="font-sans antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
