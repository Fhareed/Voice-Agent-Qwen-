import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import IconSprite from "@/components/IconSprite";

export const metadata: Metadata = {
  title: "Lumidesk",
  description: "AI phone receptionist — every call answered, every job booked",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Onest:wght@400;500;600;700;800&family=Space+Grotesk:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <IconSprite />
        {children}
      </body>
    </html>
  );
}
