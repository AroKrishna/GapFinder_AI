import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import { Toaster } from "sonner";
import { GlowTracker } from "@/components/glow";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const jakarta = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin"], weight: ["500", "600", "700"] });

export const metadata: Metadata = {
  title: { default: "GapFinder AI", template: "%s · GapFinder AI" },
  description: "Find your gaps. Focus your learning. Improve with evidence.",
};

const antiFlickerScript = `(function(){try{var t=localStorage.getItem("gapfinder-theme");var d=window.matchMedia("(prefers-color-scheme: dark)").matches;var isDark=t==="dark"||((!t||t==="system")&&d);if(isDark){document.documentElement.classList.add("dark");document.documentElement.setAttribute("data-theme","dark");}else{document.documentElement.classList.remove("dark");document.documentElement.setAttribute("data-theme","light");}}catch(e){}})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${jakarta.variable} h-full`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: antiFlickerScript }} />
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          {children}
          <GlowTracker />
          <Toaster richColors position="top-right" toastOptions={{ style: { borderRadius: "0.875rem" } }} />
        </ThemeProvider>
      </body>
    </html>
  );
}
