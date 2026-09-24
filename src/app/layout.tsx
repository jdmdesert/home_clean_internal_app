import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Steadfast & Co. Cleaning | Team App",
  applicationName: "Steadfast & Co.",
  description: "Work scheduling for the Steadfast & Co. Cleaning team.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Steadfast & Co." },
};

export const viewport: Viewport = {
  themeColor: "#17352d",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}<script src="/register-sw.js" defer /></body>
    </html>
  );
}
