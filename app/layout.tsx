import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import type { Viewport } from "next";
import { BodyScrollManager } from "@/components/BodyScrollManager";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "LifeSwitch",
  description: "LifeSwitch health, training, nutrition, and measurement tracking.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <script
        dangerouslySetInnerHTML={{
          __html: `
(function() {
  try {
    var raw = localStorage.getItem("vs_theme");
    // tolerate either raw string or JSON-encoded string
    var t = raw ? (raw[0] === '"' ? JSON.parse(raw) : raw) : "dark";

    var isDark = (t === "dark" || t === "dark-hc" || t === "graphite" || t === "carbon");

    // prevent white flash before CSS loads
    document.documentElement.style.backgroundColor = t === "paper" ? "#f7f5f0" : (t === "graphite" ? "#111113" : (t === "carbon" ? "#080808" : (isDark ? "#000" : "#fff")));

    if (isDark) document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");

    if (t === "dark-hc") document.documentElement.classList.add("dark-hc");
    else document.documentElement.classList.remove("dark-hc");

  } catch (e) {}
})();
`,
        }}
      />
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <BodyScrollManager />
        {children}
      </body>
    </html>
  );
}
