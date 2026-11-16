const cards = [
  {
    type: "event",
    eyebrow: "UP NEXT · ACOUSTIC SOCIETY",
    title: "Midnight Melody",
    detail: "Fall concert",
    date: "NOV 21",
    time: "7:30 PM",
    venue: "Open-Air Amphitheatre",
    attendees: "342 going",
    theme: "melody",
  },
  {
    type: "club",
    eyebrow: "CLUB SPOTLIGHT",
    title: "RoboRangers",
    detail: "Battle bots & midnight builds",
    date: "128",
    time: "MEMBERS",
    venue: "Robotics · Makers",
    attendees: "Building together",
    theme: "robo",
  },
  {
    type: "event",
    eyebrow: "SAVE YOUR SPOT · HACKNORTH",
    title: "36-Hour Makers Marathon",
    detail: "Build, break, ship.",
    date: "DEC 12",
    time: "4:00 PM",
    venue: "Innovation Lab",
    attendees: "154 going",
    theme: "hack",
  },
] as const;

export default function HeroStage() {
  return (
    <div
      role="img"
      aria-label="Rotating preview of campus clubs and upcoming events"
      className="hero-stage relative mx-auto min-h-[430px] w-full max-w-[440px] overflow-hidden"
    >
      <style jsx>{`
        @keyframes heroCardCycle {
          0% {
            opacity: 0;
            transform: translate(-43%, -48%) rotate(8deg) scale(0.92);
          }
          5% {
            opacity: 1;
            transform: translate(-50%, -50%) rotate(-4deg) scale(1.02);
          }
          9%,
          28% {
            opacity: 1;
            transform: translate(-50%, -50%) rotate(-2deg) scale(1);
          }
          33%,
          100% {
            opacity: 0;
            transform: translate(-57%, -48%) rotate(8deg) scale(0.92);
          }
        }

        @keyframes heroChipFloat {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-8px);
          }
        }

        .hero-stage-card {
          animation: heroCardCycle 18s ease-in-out infinite;
        }
        .hero-stage-card:nth-child(2) {
          animation-delay: -6s;
        }
        .hero-stage-card:nth-child(3) {
          animation-delay: -12s;
        }
        .hero-stage-chip {
          animation: heroChipFloat 4s ease-in-out infinite;
        }
        .hero-stage-chip:last-child {
          animation-delay: -2s;
        }
        .hero-stage:hover .hero-stage-card,
        .hero-stage:hover .hero-stage-chip {
          animation-play-state: paused;
        }

        @media (prefers-reduced-motion: reduce) {
          .hero-stage-card,
          .hero-stage-chip {
            animation: none;
          }
          .hero-stage-card {
            display: none;
          }
          .hero-stage-card:first-child {
            display: block;
            opacity: 1;
            transform: translate(-50%, -50%);
          }
        }
      `}</style>

      <div aria-hidden className="absolute inset-8 rounded-full bg-brand-500/10 blur-3xl" />
      <div aria-hidden className="absolute inset-[12%] rounded-full border border-dashed border-brand-600/20" />
      <div aria-hidden className="absolute inset-[20%] rounded-full border border-coral/20" />

      {cards.map((card, index) => (
        <article
          key={card.title}
          aria-hidden="true"
          className={`hero-stage-card absolute left-1/2 top-1/2 w-[min(82%,340px)] overflow-hidden rounded-[28px] border border-white/60 p-6 shadow-2xl ${
            card.theme === "robo"
              ? "bg-[#f3f0e9] text-[#191a1c]"
              : card.theme === "hack"
                ? "bg-gradient-to-br from-[#16233c] via-[#29365c] to-[#5351a7] text-white"
                : "bg-gradient-to-br from-[#241a4a] via-[#44307c] to-[#9b4577] text-white"
          }`}
          style={{ animationDelay: `${index * -6}s` }}
        >
          <div className="flex items-center justify-between gap-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] opacity-75">
              {card.eyebrow}
            </p>
            <span className="rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider">
              {card.type === "club" ? "CLUB" : "EVENT"}
            </span>
          </div>

          <div
            aria-hidden
            className={`my-7 flex h-36 items-end overflow-hidden rounded-2xl p-4 ${
              card.theme === "robo"
                ? "bg-[radial-gradient(circle_at_75%_25%,#ffd166_0,transparent_32%),linear-gradient(135deg,#d9e7e8,#a7c7c4)]"
                : card.theme === "hack"
                  ? "bg-[radial-gradient(circle_at_72%_28%,#b1f279_0,transparent_25%),linear-gradient(135deg,#243957,#4e5796)]"
                  : "bg-[radial-gradient(circle_at_72%_24%,#ffb85c_0,transparent_26%),linear-gradient(135deg,#593a82,#cd6685)]"
            }`}
          >
            <span className="rounded-full bg-black/20 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white backdrop-blur">
              {card.type === "club" ? "MEET THE MAKERS" : "CAMPUS LIVE"}
            </span>
          </div>

          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold opacity-70">{card.detail}</p>
              <h2 className="mt-1 font-display text-2xl font-bold leading-tight tracking-tight">
                {card.title}
              </h2>
            </div>
            <div className="shrink-0 rounded-2xl bg-white/15 px-3 py-2 text-center">
              <p className="text-sm font-bold">{card.date}</p>
              <p className="mt-0.5 text-[9px] font-bold uppercase tracking-wider opacity-70">
                {card.time}
              </p>
            </div>
          </div>

          <div className="mt-5 flex items-center justify-between border-t border-current/15 pt-4 text-xs font-medium">
            <span className="truncate pr-3 opacity-75">{card.venue}</span>
            <span className="shrink-0 font-bold">{card.attendees}</span>
          </div>
        </article>
      ))}

      <div className="hero-stage-chip absolute left-0 top-[17%] rounded-2xl border border-white/80 bg-white/95 px-4 py-3 shadow-xl">
        <p className="text-[10px] font-bold uppercase tracking-wider text-ink-900/45">
          Campus life
        </p>
        <p className="mt-1 text-sm font-bold text-ink-950">Happening together</p>
      </div>
      <div className="hero-stage-chip absolute bottom-[14%] right-0 rounded-2xl border border-emerald-100 bg-white/95 px-4 py-3 shadow-xl">
        <p className="flex items-center gap-2 text-xs font-bold text-ink-950">
          <span aria-hidden className="h-2 w-2 rounded-full bg-emerald-500" />
          Registrations are open
        </p>
      </div>
    </div>
  );
}
