// src/app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Smart Tracker Listrik IoT",
  description:
    "Pantau pemakaian listrik perangkat rumah tangga secara real-time dengan modul IoT sebelum biaya membengkak.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className="scroll-smooth">
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
        />
      </head>
      <body
        className={`${inter.className} bg-surface font-body-md text-body-md text-on-surface antialiased overscroll-none`}
      >
        {children}
      </body>
    </html>
  );
}
