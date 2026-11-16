import { useEffect, useState } from "react";
import "./hero-stage.css";

/* ---------- small helpers ---------- */
const pad = (n) => String(n).padStart(2, "0");
const useFill = (to) => {
  const [v, setV] = useState(0);
  useEffect(() => { const id = requestAnimationFrame(() => requestAnimationFrame(() => setV(to))); return () => cancelAnimationFrame(id); }, [to]);
  return v;
};

function Qr() {
  const cells = [];
  const finder = (ox, oy) => (
    <g key={"f" + ox + oy}>
      <rect x={ox} y={oy} width="3" height="3" />
      <rect x={ox + 0.5} y={oy + 0.5} width="2" height="2" fill="#fff" />
      <rect x={ox + 1} y={oy + 1} width="1" height="1" />
    </g>
  );
  for (let y = 0; y < 11; y++) for (let x = 0; x < 11; x++) {
    const inFinder = (x < 4 && y < 4) || (x > 6 && y < 4) || (x < 4 && y > 6);
    if (!inFinder && (x * 7 + y * 13 + x * y) % 3 === 0) cells.push(<rect key={x + "-" + y} x={x} y={y} width="1" height="1" />);
  }
  return (
    <svg className="yv-qr" viewBox="0 0 11 11" shapeRendering="crispEdges" role="img" aria-label="Sample QR ticket" fill="#16142a">
      {cells}{finder(0, 0)}{finder(8, 0)}{finder(0, 8)}
    </svg>
  );
}

/* ---------- anchor ---------- */
export function Ticket() {
  return (
    <div className="yv-ticket">
      <div className="yv-ticket-top">
        <span className="yv-label">Admit one</span>
        <h3>MIDNIGHT MELODY</h3>
        <p><b>Acoustic Society presents</b><br />Sat, Nov 21 · 7:30 PM · Gate B</p>
        <div className="yv-reg">Registered ✓</div>
      </div>
      <div className="yv-tear" />
      <Qr />
    </div>
  );
}

/* ---------- satellites ---------- */
export function Chip({ label, value, unit, pct, note }) {
  const w = useFill(pct);
  return (
    <div className="yv-card yv-chip">
      <div className="yv-row"><span className="yv-label">{label}</span><span className="yv-tag">Sample</span></div>
      <b>{value}<span>{unit}</span></b>
      <div className="yv-meter"><i style={{ width: w + "%" }} /></div>
      <small>{note}</small>
    </div>
  );
}

export function Countdown({ target = "2026-11-21T19:30:00+05:30" }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);
  const s = Math.max(0, Math.floor((new Date(target).getTime() - now) / 1000));
  const parts = [["days", Math.floor(s / 86400)], ["hours", Math.floor((s % 86400) / 3600)], ["mins", Math.floor((s % 3600) / 60)], ["secs", s % 60]];
  return (
    <div className="yv-card yv-count">
      <div className="yv-row"><span className="yv-label">Next up · Sample</span></div>
      <h3>ROBORUSH ’26</h3>
      <p>Innovation Lab 2 · Lineup live</p>
      <div className="yv-clock" role="timer" aria-label="Time until event starts">
        {parts.map(([u, n]) => <div key={u}><strong>{pad(n)}</strong><span>{u}</span></div>)}
      </div>
      <button className="yv-btn" tabIndex={-1}>Register for free</button>
    </div>
  );
}

const PEOPLE = [["Ananya R.", "RoboRush ’26", "#4a3bd4"], ["Kiran M.", "Midnight Melody", "#0f9d6b"], ["Sneha P.", "Hack Night", "#d9528a"], ["Rahul V.", "Midnight Melody", "#e0861a"], ["Divya S.", "RoboRush ’26", "#2a7ad4"], ["Arjun T.", "Quiz League", "#7a4ad4"]];
export function Feed() {
  const [rows, setRows] = useState([4, 3, 2, 1].map((i) => i));
  const [n, setN] = useState(5);
  useEffect(() => { const id = setInterval(() => { setRows((r) => [n, ...r].slice(0, 4)); setN((x) => x + 1); }, 1800); return () => clearInterval(id); }, [n]);
  return (
    <div className="yv-card yv-feed">
      <div className="yv-row"><span className="yv-pill ok"><span className="yv-dot" />Live registrations</span><span className="yv-tag">Sample</span></div>
      <ul>
        {rows.map((i, k) => {
          const p = PEOPLE[i % PEOPLE.length];
          return (
            <li key={i}>
              <span className="yv-av" style={{ background: p[2] }}>{p[0].split(" ").map((w) => w[0]).join("")}</span>
              <div><b>{p[0]}</b><small>{p[1]}</small></div>
              <time>{k === 0 ? "now" : k + " min"}</time>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function Club() {
  const [on, setOn] = useState(false);
  return (
    <div className="yv-card yv-club">
      <div className="yv-cover" />
      <div className="yv-club-body">
        <div className="yv-mono">AS</div>
        <h3>Acoustic Society</h3>
        <div className="meta">Music · {186 + (on ? 1 : 0)} members</div>
        <div className="yv-next"><b>Midnight Melody</b><span>Sat, Nov 21 · 7:30 PM</span></div>
        <button className="yv-follow" aria-pressed={on} onClick={() => setOn(!on)}>{on ? "Following" : "Follow club"}</button>
      </div>
    </div>
  );
}

export function Scanner() {
  const w = useFill(65);
  return (
    <div className="yv-card yv-scan">
      <div className="yv-row"><span className="yv-label" style={{ color: "#a9a4d8" }}>Door scanner</span><span className="yv-tag" style={{ background: "rgba(143,132,255,.2)", color: "#cfc9ff" }}>Gate B</span></div>
      <div className="yv-frame" aria-hidden="true"><div className="yv-beam" /></div>
      <div className="yv-last"><span className="tick">✓</span><div><b>Priya K. checked in</b><small>Ticket #0482 · just now</small></div></div>
      <div className="yv-row" style={{ marginTop: 14, fontSize: 13 }}><span>Checked in</span><b>312 / 480</b></div>
      <div className="yv-meter"><i style={{ width: w + "%" }} /></div>
    </div>
  );
}

const BARS = [38, 52, 45, 70, 88, 62, 73];
export function Dashboard() {
  const f = useFill(1);
  return (
    <div className="yv-card yv-dash">
      <div className="yv-row"><span className="yv-label">Registrations this week</span><span className="yv-tag">Sample</span></div>
      <div className="big">428</div>
      <span className="yv-pill ok">▲ 18% vs last week</span>
      <div className="yv-chart" aria-hidden="true">{BARS.map((v, i) => <div key={i} className={i === 4 ? "hi" : ""} style={{ height: f * v + "%" }} />)}</div>
      <div className="yv-days">{"MTWTFSS".split("").map((d, i) => <span key={i}>{d}</span>)}</div>
    </div>
  );
}

/* ---------- stage ---------- */
const STEPS = [
  { id: "Browse", A: <Club />, B: <Countdown /> },
  { id: "Register", A: <Feed />, B: <Chip label="Capacity" value="149" unit="/ 200 seats" pct={74} note="74% filled · Live updates" />, chip: true },
  { id: "Scan", A: <Scanner />, B: <Chip label="Entry" value="312" unit="inside" pct={65} note="QR check-in · Gate B" />, chip: true },
  { id: "Manage", A: <Dashboard />, B: <Chip label="Your clubs" value="12" unit="live" pct={80} note="Events across campus" />, chip: true },
];

export default function HeroStage({ interval = 4800 }) {
  const [step, setStep] = useState(0);
  const [hold, setHold] = useState(false);   // hover / focus
  const [locked, setLocked] = useState(false); // user clicked a step
  const reduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    if (hold || locked || reduced) return;
    const id = setInterval(() => setStep((s) => (s + 1) % STEPS.length), interval);
    return () => clearInterval(id);
  }, [hold, locked, reduced, interval]);

  const cur = STEPS[step];
  return (
    <div className="yv-root" onMouseEnter={() => setHold(true)} onMouseLeave={() => setHold(false)} onFocus={() => setHold(true)} onBlur={() => setHold(false)}>
      <div className="yv-stage" aria-live="off">
        <Ticket />
        <div className="yv-slot yv-slotA" key={"A" + step}>{cur.A}</div>
        <div className={"yv-slot yv-slotB" + (cur.chip ? " yv-slot--chip" : "")} key={"B" + step}>{cur.B}</div>
      </div>
      <div className="yv-steps" role="tablist" aria-label="How it works">
        {STEPS.map((s, i) => (
          <button key={s.id} role="tab" className="yv-step" aria-selected={i === step} onClick={() => { setStep(i); setLocked(true); }}>{s.id}</button>
        ))}
      </div>
    </div>
  );
}
