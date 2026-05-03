import type { Metadata } from "next";
import { IBM_Plex_Sans, Space_Grotesk } from "next/font/google";

import "@/app/globals.css";
import { FirebaseBootstrap } from "@/components/firebase-bootstrap";

const headingFont = Space_Grotesk({
  variable: "--font-heading",
  subsets: ["latin"]
});

const bodyFont = IBM_Plex_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"]
});

export const metadata: Metadata = {
  metadataBase: new URL("https://vyntrix.vercel.app"),
  title: "VYNTRIX AI Content Engine",
  description: "Automate short video scripting, voice generation, video rendering, and metadata.",
  icons: {
    icon: "/vyntrix-logo.webp",
    shortcut: "/vyntrix-logo.webp",
    apple: "/vyntrix-logo.webp"
  },
  openGraph: {
    title: "VYNTRIX AI Content Engine",
    description: "Automate short video scripting, voice generation, video rendering, and metadata.",
    images: [
      {
        url: "/vyntrix-logo.webp",
        width: 1200,
        height: 1200,
        alt: "VYNTRIX AI Content Engine logo"
      }
    ]
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning className={`${headingFont.variable} ${bodyFont.variable} bg-surface text-ink`}>
        <FirebaseBootstrap />
        {children}
      </body>
    </html>
  );
}
