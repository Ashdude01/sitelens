import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BlankLinks } from "@/components/blank-links";
import { config } from "@/server/config";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(config.publicUrl),
  title: {
    default: `${config.siteName}: website traffic & tech stack checker`,
    template: `%s | ${config.siteName}`,
  },
  description: "Enter any website to see its technology stack (with evidence) and an honest estimate of its monthly traffic.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <TooltipProvider>
            <BlankLinks />
            {children}
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
