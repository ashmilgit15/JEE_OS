import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import "katex/dist/katex.min.css";
import { TooltipProvider } from "@/components/ui/tooltip";
import Sidebar from "@/components/layout/Sidebar";
import FloatingAICopilot from "@/components/layout/FloatingAICopilot";
import QuickLoggerDrawer from "@/components/layout/QuickLoggerDrawer";
import { StoreProvider } from "@/store";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://jee-os.vercel.app'),
  title: {
    default: "JEE OS — AI-Powered Preparation System",
    template: "%s | JEE OS",
  },
  description: "Your personal AI-powered JEE Main & Advanced preparation operating system. Track syllabus, get AI coaching, take adaptive tests, and ace your exams.",
  keywords: ["JEE", "JEE Main", "JEE Advanced", "IIT", "preparation", "study", "AI tutor", "JEE coaching", "adaptive testing"],
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: "https://jee-os.vercel.app",
    siteName: "JEE OS",
    title: "JEE OS — AI-Powered Preparation System",
    description: "The ultimate AI-powered operating system for JEE Main & Advanced aspirants.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "JEE OS Dashboard",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "JEE OS — AI-Powered Preparation System",
    description: "Track syllabus, get AI coaching, take adaptive tests, and ace your exams.",
    images: ["/og-image.png"],
  },
};

export const viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased dark`} data-scroll-behavior="smooth">
      <body className="h-screen w-screen flex flex-col md:flex-row bg-background text-foreground font-sans overflow-hidden">
        <StoreProvider>
          <TooltipProvider>
            <Sidebar />
            <main className="flex-1 overflow-y-auto min-w-0 relative">
              {children}
            </main>
            <FloatingAICopilot />
            <QuickLoggerDrawer />
          </TooltipProvider>
        </StoreProvider>
      </body>
    </html>
  );
}
