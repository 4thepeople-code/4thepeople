import type { Metadata } from "next";
import { Anton, Inter, Sora } from "next/font/google";

const anton = Anton({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-anton",
});

const sora = Sora({
  subsets: ["latin"],
  weight: "700",
  variable: "--font-sora",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  // TODO: replace with real domain/email
  metadataBase: new URL("https://campusloop.io"),
  applicationName: "4 the people",
  title: {
    default: "4 the people — The Operating System for Campus Clubs",
    template: "%s · 4 the people",
  },
  description:
    "4 the people gives student clubs one home to plan events, manage members and fill seats — so campus life finally runs itself.",
};

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className={`${anton.variable} ${sora.variable} ${inter.variable} landing-scope min-h-screen`}
    >
      {children}
    </div>
  );
}

