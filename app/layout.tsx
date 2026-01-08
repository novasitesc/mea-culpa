import type React from "react";
import type { Metadata } from "next";
import { Cinzel, Cinzel_Decorative, MedievalSharp } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const _cinzel = Cinzel({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});
const _cinzelDecorative = Cinzel_Decorative({
  subsets: ["latin"],
  weight: ["400", "700"],
});
const _medievalSharp = MedievalSharp({ subsets: ["latin"], weight: ["400"] });

export const metadata: Metadata = {
  title: "Chronicles of the Realm - D&D Campaign Tracker",
  description:
    "Track your Dungeons & Dragons campaigns with this medieval-themed tracker",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="font-sans antialiased min-h-screen">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
