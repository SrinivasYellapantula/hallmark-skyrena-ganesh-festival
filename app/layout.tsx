import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";
import { AuthGate } from "./components/AuthGate";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const image = `${protocol}://${host}/og.png`;
  const title = "Hallmark Skyrena — Ganesh Chaturthi 2026";
  const description = "Hallmark Skyrena community contributions, Mahaprasadam planning and transparent festival accounts.";
  return {
    title,
    description,
    manifest: "/manifest.webmanifest",
    icons: {
      icon: [
        { url: "/favicon.ico?v=2", sizes: "32x32", type: "image/x-icon" },
        { url: "/skyrena-favicon-32.png?v=2", sizes: "32x32", type: "image/png" },
      ],
      shortcut: [{ url: "/favicon.ico?v=2", type: "image/x-icon" }],
      apple: [{ url: "/apple-touch-icon.png?v=2", sizes: "180x180", type: "image/png" }],
    },
    appleWebApp: { capable: true, statusBarStyle: "default", title: "Skyrena Ganesh 2026" },
    formatDetection: { telephone: false },
    openGraph: { title, description, images: [{ url: image, width: 1732, height: 908 }] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AuthGate>{children}</AuthGate>
      </body>
    </html>
  );
}
