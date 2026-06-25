import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "photoswipe/style.css";
import "./globals.css";

const geist = Geist({
  subsets: ["latin", "cyrillic"],
  variable: "--font-geist"
});

export const metadata: Metadata = {
  title: {
    default: "Fitness Timeline",
    template: "%s · Fitness Timeline"
  },
  description: "Your body transformation, organized by time.",
  applicationName: "Fitness Timeline",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" }
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }]
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Timeline"
  },
  other: {
    "apple-mobile-web-app-capable": "yes"
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f6f2ec"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru" className={geist.variable} data-scroll-behavior="smooth">
      <body>
        <TooltipProvider>
          {children}
          <Toaster position="top-center" richColors />
        </TooltipProvider>
      </body>
    </html>
  );
}
