import type { Metadata } from "next";
import { IBM_Plex_Sans, Space_Grotesk } from "next/font/google";

import "@/app/globals.css";

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
  title: "AI Content Engine",
  description: "Automate short video scripting, voice generation, video rendering, and metadata."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${headingFont.variable} ${bodyFont.variable} bg-surface text-ink`}>
        {children}
      </body>
    </html>
  );
}
