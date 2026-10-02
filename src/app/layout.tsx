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
};

export const viewport: Viewport = { themeColor: "#143a22" };

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
