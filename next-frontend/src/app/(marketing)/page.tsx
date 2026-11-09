import Nav from "@/components/landing/Nav";
import Hero from "@/components/landing/Hero";
import Colleges from "@/components/landing/Colleges";
import AudienceSwitcher from "@/components/landing/AudienceSwitcher";
import LiveFeed from "@/components/landing/LiveFeed";
import BeforeAfter from "@/components/landing/BeforeAfter";
import AdminTrust from "@/components/landing/AdminTrust";
import Steps from "@/components/landing/Steps";
import CTABand from "@/components/landing/CTABand";
import Footer from "@/components/landing/Footer";

export const metadata = {
  title: "4 the people — The Operating System for Campus Clubs",
  description:
    "The operations platform for student clubs — plan, launch and measure campus life at scale. Events, registrations and QR check-ins in one place.",
  openGraph: {
    title: "4 the people — The Operating System for Campus Clubs",
    description:
      "Events, registrations and QR check-ins for student clubs, all in one platform.",
    type: "website",
    // TODO: replace with real domain/email
    url: "https://campusloop.io",
    images: [{ url: "/landing/favicon.svg", width: 1200, height: 630, alt: "4 the people preview" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "4 the people — The Operating System for Campus Clubs",
    description: "Events, registrations and QR check-ins for student clubs, all in one platform.",
  },
};

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col overflow-x-clip bg-white text-ink-950">
      <Nav />
      <main className="flex-1">
        <Hero />
        <Colleges />
        <AudienceSwitcher />
        <LiveFeed />
        <BeforeAfter />
        <AdminTrust />
        <Steps />
        <CTABand />
      </main>
      <Footer />
    </div>
  );
}

