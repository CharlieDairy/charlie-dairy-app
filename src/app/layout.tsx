import type { Metadata, Viewport } from "next";
import InstallApp from "@/components/InstallApp";
import { Open_Sans } from "next/font/google";
import "./globals.css";

const openSans = Open_Sans({
  variable: "--font-open-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Charlie Dairy Farm",
  description: "Data collection, master data, and financial reporting for Charlie Dairy Farm",
  appleWebApp: { capable: true, title: "Charlie Dairy", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = { themeColor: "#1b4a05", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${openSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}<InstallApp /></body>
    </html>
  );
}
