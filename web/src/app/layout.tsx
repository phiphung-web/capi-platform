import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CAPI Dev Console",
  description: "Test events & deliveries for CAPI platform"
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
