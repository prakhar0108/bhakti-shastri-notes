import type { Metadata } from "next";
import { RootProvider } from "fumadocs-ui/provider/next";
import {
  Cormorant_Garamond,
  Source_Serif_4,
  Noto_Serif_Devanagari,
} from "next/font/google";
import "./globals.css";
import { appName } from "@/lib/shared";

const heading = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-heading",
});
const body = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-body",
});
const devanagari = Noto_Serif_Devanagari({
  subsets: ["devanagari"],
  weight: ["500", "600"],
  variable: "--font-devanagari",
});

export const metadata: Metadata = {
  title: appName,
  description:
    "Bhagavad-gita Bhakti Shastri lecture notes, with sidebar navigation, search and Mermaid diagrams.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${heading.variable} ${body.variable} ${devanagari.variable}`}
    >
      <body className="flex flex-col min-h-screen">
        <RootProvider theme={{ defaultTheme: "light" }}>
          {children}
        </RootProvider>
      </body>
    </html>
  );
}
