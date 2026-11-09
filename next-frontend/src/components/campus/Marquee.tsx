const words = [
  "Robotics",
  "Dance",
  "Debate",
  "Music",
  "Art",
  "Gaming",
  "Sports",
  "Outdoors",
];

export default function Marquee() {
  const row = (key: string) => (
    <div className="flex shrink-0 items-center gap-12 pr-12">
      {words.map((w) => (
        <span key={`${key}-${w}`} className="whitespace-nowrap font-display text-3xl font-bold uppercase tracking-wide text-cream lg:text-4xl">
          {w}
        </span>
      ))}
    </div>
  );

  return (
    <div className="overflow-hidden bg-warm-ink py-5 text-cream" aria-hidden>
      <div className="flex w-max animate-marquee">
        {row("a")}
        {row("b")}
      </div>
    </div>
  );
}
