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

export default function DemoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`${anton.variable} ${sora.variable} ${inter.variable} demo-scope min-h-screen bg-cream text-warm-ink`}>
      {children}
    </div>
  );
}

