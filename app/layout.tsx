import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import { Toaster } from "sonner";
import { GlowTracker } from "@/components/glow";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const jakarta = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin"], weight: ["500", "600", "700"] });

export const metadata: Metadata = {
  title: { default: "GapFinder AI", template: "%s · GapFinder AI" },
  description: "Find your gaps. Focus your learning. Improve with evidence.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${jakarta.variable} h-full`}>
      <body className="min-h-full flex flex-col">
        {children}
        <GlowTracker />
        <Toaster richColors position="top-right" toastOptions={{ style: { borderRadius: "0.875rem" } }} />
      </body>
    </html>
  );
}
