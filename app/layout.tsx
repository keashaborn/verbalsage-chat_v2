import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import type { Viewport } from "next";
import { BodyScrollManager } from "@/components/BodyScrollManager";
import { SiteBrandProvider } from "@/components/site/SiteBrandProvider";
import { brandForSite } from "@/lib/siteBrand";
import { requestSiteId } from "@/lib/siteBrandServer";
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
  viewportFit: "cover",
};

export async function generateMetadata(): Promise<Metadata> {
  const brand = brandForSite(await requestSiteId());
  return {
    title: brand.name,
    description: brand.description,
    manifest: "/manifest.webmanifest",
    icons: {
      icon: [
        {
          url: brand.favicon,
          sizes: "any",
          type: brand.favicon.endsWith(".svg")
            ? "image/svg+xml"
            : "image/x-icon",
        },
      ],
      ...(brand.appleTouchIcon
        ? {
            apple: [
              {
                url: brand.appleTouchIcon,
                sizes: "180x180",
                type: "image/png",
              },
            ],
          }
        : {}),
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const siteId = await requestSiteId();
  const brand = brandForSite(siteId);
  return (
    <html
      lang="en"
      className={DEFAULT_THEME}
      data-theme={DEFAULT_THEME}
      data-product={siteId}
      data-product-accent={brand.accentColor}
      style={{ colorScheme: "dark", backgroundColor: "#465464" }}
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
    var t = normalized === "balanced" ? "balanced"
      : ["paper", "light", "mist"].includes(normalized) ? "mist"
      : ["slate", "graphite", "dark", "carbon", "dark-hc"].includes(normalized) ? "slate"
      : ${JSON.stringify(DEFAULT_THEME)};
    var root = document.documentElement;

    localStorage.setItem("vs_theme", JSON.stringify(t));
    root.classList.remove("dark", "dark-hc", "paper", "graphite", "carbon", "balanced", "slate", "mist");
    root.dataset.theme = t;

    if (t === "mist") {
      root.classList.add("mist");
      root.style.colorScheme = "light";
      root.style.backgroundColor = "#f1f4f7";
    } else if (t === "slate") {
      root.classList.add("dark", "slate");
      root.style.colorScheme = "dark";
      root.style.backgroundColor = "#171c24";
    } else {
      root.classList.add("dark", "balanced");
      root.style.colorScheme = "dark";
      root.style.backgroundColor = "#465464";
    }

  } catch (e) {}
})();
`,
        }}
      />
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <BodyScrollManager />
        <SiteBrandProvider siteId={siteId}>{children}</SiteBrandProvider>
      </body>
    </html>
  );
}
