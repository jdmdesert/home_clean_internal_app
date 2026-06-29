import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Desert Home Cleaning | Work Board",
  description: "Private work scheduling for the Desert Home Cleaning team.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "DHC Work" },
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
