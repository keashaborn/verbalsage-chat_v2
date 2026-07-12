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
  icons: {
    icon: [{ url: "/brand/lifeswitch/favicon-favorite-v4.ico", sizes: "any" }],
    apple: [{ url: "/brand/lifeswitch/app-icon-favorite-180-v4.png", sizes: "180x180", type: "image/png" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="dark graphite"
      data-theme="graphite"
      style={{ colorScheme: "dark", backgroundColor: "#111113" }}
      suppressHydrationWarning
    >
      <script
        dangerouslySetInnerHTML={{
          __html: `
(function() {
  try {
    var raw = localStorage.getItem("vs_theme");
    var value = raw ? (raw[0] === '"' ? JSON.parse(raw) : raw) : "graphite";
    var t = (value === "paper" || value === "light") ? "paper" : "graphite";
    var root = document.documentElement;

    localStorage.setItem("vs_theme", JSON.stringify(t));
    root.classList.remove("dark", "dark-hc", "paper", "graphite", "carbon");
    root.dataset.theme = t;

    if (t === "paper") {
      root.classList.add("paper");
      root.style.colorScheme = "light";
      root.style.backgroundColor = "#f7f5f0";
    } else {
      root.classList.add("dark", "graphite");
      root.style.colorScheme = "dark";
      root.style.backgroundColor = "#111113";
    }

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
