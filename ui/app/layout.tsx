import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ride Support Demo",
  description: "Interactive Uber-like ride support demo with AI voice agent",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="bg-black text-white">{children}</body>
    </html>
  );
}
