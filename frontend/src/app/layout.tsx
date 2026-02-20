import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fintech AI Platform",
  description:
    "Professional financial analytics platform powered by AI. Real-time market data, budget analysis, and portfolio insights.",
  keywords: ["fintech", "ai", "finance", "budget", "portfolio", "analytics"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
