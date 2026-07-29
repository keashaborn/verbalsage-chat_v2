import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import type { Viewport } from "next";
import { BodyScrollManager } from "@/components/BodyScrollManager";
import { DEFAULT_THEME } from "@/lib/theme";

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
      className={DEFAULT_THEME}
      data-theme={DEFAULT_THEME}
      style={{ colorScheme: "light", backgroundColor: "#f1f4f7" }}
      suppressHydrationWarning
    >
      <script
        dangerouslySetInnerHTML={{
          __html: `
(function() {
  try {
    var raw = localStorage.getItem("vs_theme");
    var value = raw ? (raw[0] === '"' ? JSON.parse(raw) : raw) : ${JSON.stringify(DEFAULT_THEME)};
    var normalized = String(value || "").trim().toLowerCase();
    var t = (normalized === "paper" || normalized === "light") ? "paper"
      : normalized === "mist" ? "mist"
      : normalized === "slate" ? "slate"
      : ["graphite", "dark", "carbon", "dark-hc"].includes(normalized) ? "graphite"
      : ${JSON.stringify(DEFAULT_THEME)};
    var root = document.documentElement;

    localStorage.setItem("vs_theme", JSON.stringify(t));
    root.classList.remove("dark", "dark-hc", "paper", "graphite", "carbon", "slate", "mist");
    root.dataset.theme = t;

    if (t === "paper") {
      root.classList.add("paper");
      root.style.colorScheme = "light";
      root.style.backgroundColor = "#f7f5f0";
    } else if (t === "mist") {
      root.classList.add("mist");
      root.style.colorScheme = "light";
      root.style.backgroundColor = "#f1f4f7";
    } else if (t === "slate") {
      root.classList.add("dark", "slate");
      root.style.colorScheme = "dark";
      root.style.backgroundColor = "#171c24";
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
