import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import { Toaster } from "sonner";
import { BrandingProvider } from "@/components/branding-provider";
import { GlowTracker } from "@/components/glow";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const jakarta = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin"], weight: ["500", "600", "700"] });

export const metadata: Metadata = {
  title: { default: "GapFinder AI", template: "%s · GapFinder AI" },
  description: "Find your gaps. Focus your learning. Improve with evidence.",
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
    apple: "/icon.svg",
  },
};

/**
 * Early anti-flicker script:
 * - Defaults unconditionally to Light Mode for new users and sessions without a saved preference.
 * - Ignores the operating system's prefers-color-scheme when no preference is saved.
 * - Only enables dark mode if user explicitly selected "dark", or explicitly selected "system" while OS is dark.
 */
const antiFlickerScript = `(function(){try{var t=localStorage.getItem("gapfinder-theme");var d=window.matchMedia("(prefers-color-scheme: dark)").matches;var isDark=t==="dark"||(t==="system"&&d);if(isDark){document.documentElement.classList.add("dark");document.documentElement.setAttribute("data-theme","dark");}else{document.documentElement.classList.remove("dark");document.documentElement.setAttribute("data-theme","light");}}catch(e){}})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${jakarta.variable} h-full`}>
      <head>
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <script dangerouslySetInnerHTML={{ __html: antiFlickerScript }} />
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeProvider defaultTheme="light">
          <BrandingProvider>
            {children}
            <GlowTracker />
            <Toaster richColors position="top-right" toastOptions={{ style: { borderRadius: "0.875rem" } }} />
          </BrandingProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
