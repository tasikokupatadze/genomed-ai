import type { Metadata, Viewport } from "next";
import "@fontsource-variable/noto-sans";
import "@fontsource-variable/noto-sans-georgian";
import "./globals.css";

export const metadata: Metadata = {
  title: "GenoMed AI",
  description: "Hackathon prototype: doctor-reviewed follow-up on uncertain genetic results and missing lab context, in Georgian and English.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
