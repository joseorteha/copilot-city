import type { Metadata, Viewport } from "next";

import "./globals.css";

const DESCRIPTION = "Una ciudad cuyo urbanismo es generado por la arquitectura del código.";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Copilot City",
  description: DESCRIPTION,
  applicationName: "Copilot City",
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    siteName: "Copilot City",
    title: "Copilot City",
    description: DESCRIPTION,
    locale: "es_ES",
  },
  twitter: {
    card: "summary_large_image",
    title: "Copilot City",
    description: DESCRIPTION,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#101919",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
