// src/app/layout.tsx
import type { Metadata, Viewport } from "next";
import { Inter, Plus_Jakarta_Sans, Geist } from "next/font/google";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Providers } from "@/providers/query-provider";
import { Toaster } from "sonner";
import { createClient } from "@/lib/supabase/server";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
});

// Re-fetch metadata every 60 seconds
export const revalidate = 60;

// ─── Dynamic metadata from Supabase ──────────────────────────
export async function generateMetadata(): Promise<Metadata> {
  let title = "KinderERP - Kindergarten Management System";
  let description = "A comprehensive, free and open-source ERP system";
  let favicon: string | undefined;
  let keywords: string | undefined;

  try {
    const supabase = await createClient();

    const [landingRes, schoolRes] = await Promise.all([
      supabase
        .from("landing_settings")
        .select("meta_title, meta_description, meta_keywords, favicon_url")
        .eq("id", 1)
        .maybeSingle(),
      supabase
        .from("school_settings")
        .select("school_name, school_logo")
        .limit(1)
        .maybeSingle(),
    ]);

    if (landingRes.error) {
      console.warn("[metadata] landing_settings fetch failed:", landingRes.error.message);
    }
    if (schoolRes.error) {
      console.warn("[metadata] school_settings fetch failed:", schoolRes.error.message);
    }

    const landing = landingRes.data;
    const school = schoolRes.data;

    const schoolName = school?.school_name ? String(school.school_name).trim() : "";
    const metaTitle = landing?.meta_title ? String(landing.meta_title).trim() : "";
    const metaDesc = landing?.meta_description ? String(landing.meta_description).trim() : "";

    if (metaTitle) title = metaTitle;
    else if (schoolName) title = `${schoolName} - KinderERP`;

    if (metaDesc) description = metaDesc;

    keywords = landing?.meta_keywords || undefined;
    favicon = landing?.favicon_url || school?.school_logo || undefined;

    return {
      title,
      description,
      keywords,
      manifest: "/manifest.json",
      icons: {
        icon: favicon ? [{ url: favicon }] : undefined,
        apple: favicon || "/icons/icon-192x192.png",
      },
      openGraph: {
        title,
        description,
        images: favicon ? [favicon] : undefined,
      },
    };
  } catch (err) {
    console.warn("[metadata] unexpected error:", err);
  }

  return {
    title,
    description,
    manifest: "/manifest.json",
    icons: { apple: "/icons/icon-192x192.png" },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#4f46e5" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="KinderERP" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
      </head>

      <body
        className={`${inter.variable} ${jakarta.variable} ${geist.variable} font-sans antialiased bg-background text-foreground`}
        suppressHydrationWarning
      >
        <Providers>
          <TooltipProvider>
            {children}
            <Toaster position="top-right" richColors closeButton theme="system" />
          </TooltipProvider>
        </Providers>
      </body>
    </html>
  );
}