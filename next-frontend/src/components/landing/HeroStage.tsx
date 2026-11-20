'use client';

import React, { useState, useEffect } from 'react';

function useProgress(target: number) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    const handle = requestAnimationFrame(() =>
      requestAnimationFrame(() => setVal(target))
    );
    return () => cancelAnimationFrame(handle);
  }, [target]);
  return val;
}

function SampleQrSvg() {
  const rects: React.ReactNode[] = [];
  const finder = (x: number, y: number) => (
    <g key={`f-${x}-${y}`}>
      <rect x={x} y={y} width="3" height="3" />
      <rect x={x + 0.5} y={y + 0.5} width="2" height="2" fill="#fff" />
      <rect x={x + 1} y={y + 1} width="1" height="1" />
    </g>
  );

  for (let s = 0; s < 11; s++) {
    for (let i = 0; i < 11; i++) {
      if ((i < 4 && s < 4) || (i > 6 && s < 4) || (i < 4 && s > 6) || (7 * i + 13 * s + i * s) % 3 !== 0) {
        continue;
      }
      rects.push(<rect key={`${i}-${s}`} x={i} y={s} width="1" height="1" />);
    }
  }

  return (
    <svg
      className="yv-qr"
      viewBox="0 0 11 11"
      shapeRendering="crispEdges"
      role="img"
      aria-label="Sample QR ticket"
      fill="#16142a"
    >
      {rects}
      {finder(0, 0)}
      {finder(8, 0)}
      {finder(0, 8)}
    </svg>
  );
}

function TicketCard() {
  return (
    <div className="yv-ticket">
      <div className="yv-ticket-top">
        <span className="yv-label">Admit one</span>
        <h3>MIDNIGHT MELODY</h3>
        <p>
          <b>Acoustic Society presents</b>
          <br />
          Sat, Nov 21 · 7:30 PM · Gate B
        </p>
        <div className="yv-reg">Registered ✓</div>
      </div>
      <div className="yv-tear" />
      <SampleQrSvg />
    </div>
  );
}

function StatChip({
  label,
  value,
  unit,
  pct,
  note,
}: {
  label: string;
  value: string;
  unit: string;
  pct: number;
  note: string;
}) {
  const p = useProgress(pct);
  return (
    <div className="yv-card yv-chip">
      <div className="yv-row">
        <span className="yv-label">{label}</span>
        <span className="yv-tag">Sample</span>
      </div>
      <b>
        {value}
        <span>{unit}</span>
      </b>
      <div className="yv-meter">
        <i style={{ width: `${p}%` }} />
      </div>
      <small>{note}</small>
    </div>
  );
}

const REG_USERS = [
  ['Ananya R.', 'RoboRush ’26', '#4a3bd4'],
  ['Kiran M.', 'Midnight Melody', '#0f9d6b'],
  ['Sneha P.', 'Hack Night', '#d9528a'],
  ['Rahul V.', 'Midnight Melody', '#e0861a'],
  ['Divya S.', 'RoboRush ’26', '#2a7ad4'],
  ['Arjun T.', 'Quiz League', '#7a4ad4'],
];

const WEEK_CHART = [38, 52, 45, 70, 88, 62, 73];

function ClubCard() {
  const [following, setFollowing] = useState(false);
  return (
    <div className="yv-card yv-club">
      <div className="yv-cover" />
      <div className="yv-club-body">
        <div className="yv-mono">AS</div>
        <h3>Acoustic Society</h3>
        <div className="meta">Music · {186 + (following ? 1 : 0)} members</div>
        <div className="yv-next">
          <b>Midnight Melody</b>
          <span>Sat, Nov 21 · 7:30 PM</span>
        </div>
        <button
          className="yv-follow"
          aria-pressed={following}
          onClick={() => setFollowing(!following)}
        >
          {following ? 'Following' : 'Follow club'}
        </button>
      </div>
    </div>
  );
}

function CountdownCard({ target = '2026-11-21T19:30:00+05:30' }: { target?: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const totalSecs = Math.max(0, Math.floor((new Date(target).getTime() - now) / 1000));
  const timeParts: [string, number][] = [
    ['days', Math.floor(totalSecs / 86400)],
    ['hours', Math.floor((totalSecs % 86400) / 3600)],
    ['mins', Math.floor((totalSecs % 3600) / 60)],
    ['secs', totalSecs % 60],
  ];

  return (
    <div className="yv-card yv-count">
      <div className="yv-row">
        <span className="yv-label">Next up · Sample</span>
      </div>
      <h3>ROBORUSH ’26</h3>
      <p>Innovation Lab 2 · Lineup live</p>
      <div className="yv-clock" role="timer" aria-label="Time until event starts">
        {timeParts.map(([label, val]) => (
          <div key={label}>
            <strong>{String(val).padStart(2, '0')}</strong>
            <span>{label}</span>
          </div>
        ))}
      </div>
      <button className="yv-btn" tabIndex={-1}>
        Register for free
      </button>
    </div>
  );
}

function RegistrationsFeed() {
  const [items, setItems] = useState([4, 3, 2, 1]);
  const [counter, setCounter] = useState(5);

  useEffect(() => {
    const timer = setInterval(() => {
      setItems((prev) => [counter, ...prev].slice(0, 4));
      setCounter((c) => c + 1);
    }, 1800);
    return () => clearInterval(timer);
  }, [counter]);

  return (
    <div className="yv-card yv-feed">
      <div className="yv-row">
        <span className="yv-pill ok">
          <span className="yv-dot" />
          Live registrations
        </span>
        <span className="yv-tag">Sample</span>
      </div>
      <ul>
        {items.map((item, idx) => {
          const user = REG_USERS[item % REG_USERS.length];
          return (
            <li key={item}>
              <span className="yv-av" style={{ background: user[2] }}>
                {user[0]
                  .split(' ')
                  .map((w) => w[0])
                  .join('')}
              </span>
              <div>
                <b>{user[0]}</b>
                <small>{user[1]}</small>
              </div>
              <time>{idx === 0 ? 'now' : `${idx} min`}</time>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ScannerCard() {
  const progress = useProgress(65);
  return (
    <div className="yv-card yv-scan">
      <div className="yv-row">
        <span className="yv-label" style={{ color: '#a9a4d8' }}>
          Door scanner
        </span>
        <span
          className="yv-tag"
          style={{ background: 'rgba(143,132,255,.2)', color: '#cfc9ff' }}
        >
          Gate B
        </span>
      </div>
      <div className="yv-frame" aria-hidden="true">
        <div className="yv-beam" />
      </div>
      <div className="yv-last">
        <span className="tick">✓</span>
        <div>
          <b>Priya K. checked in</b>
          <small>Ticket #0482 · just now</small>
        </div>
      </div>
      <div className="yv-row" style={{ marginTop: 14, fontSize: 13 }}>
        <span>Checked in</span>
        <b>312 / 480</b>
      </div>
      <div className="yv-meter">
        <i style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}

function DashboardCard() {
  const progress = useProgress(1);
  return (
    <div className="yv-card yv-dash">
      <div className="yv-row">
        <span className="yv-label">Registrations this week</span>
        <span className="yv-tag">Sample</span>
      </div>
      <div className="big">428</div>
      <span className="yv-pill ok">▲ 18% vs last week</span>
      <div className="yv-chart" aria-hidden="true">
        {WEEK_CHART.map((val, idx) => (
          <div
            key={idx}
            className={idx === 4 ? 'hi' : ''}
            style={{ height: `${progress * val}%` }}
          />
        ))}
      </div>
      <div className="yv-days">
        {'MTWTFSS'.split('').map((char, idx) => (
          <span key={idx}>{char}</span>
        ))}
      </div>
    </div>
  );
}

const STAGES = [
  {
    id: 'Browse',
    slotA: <ClubCard />,
    slotB: <CountdownCard />,
    isChip: false,
  },
  {
    id: 'Register',
    slotA: <RegistrationsFeed />,
    slotB: (
      <StatChip
        label="Capacity"
        value="149"
        unit="/ 200 seats"
        pct={74}
        note="74% filled · Live updates"
      />
    ),
    isChip: true,
  },
  {
    id: 'Scan',
    slotA: <ScannerCard />,
    slotB: (
      <StatChip
        label="Entry"
        value="312"
        unit="inside"
        pct={65}
        note="QR check-in · Gate B"
      />
    ),
    isChip: true,
  },
  {
    id: 'Manage',
    slotA: <DashboardCard />,
    slotB: (
      <StatChip
        label="Your clubs"
        value="12"
        unit="live"
        pct={80}
        note="Events across campus"
      />
    ),
    isChip: true,
  },
];

export default function HeroStage({ interval = 4800 }: { interval?: number }) {
  const [activeTab, setActiveTab] = useState(0);
  const [paused, setPaused] = useState(false);
  const [userClicked, setUserClicked] = useState(false);

  useEffect(() => {
    if (paused || userClicked) return;
    const timer = setInterval(() => {
      setActiveTab((curr) => (curr + 1) % STAGES.length);
    }, interval);
    return () => clearInterval(timer);
  }, [paused, userClicked, interval]);

  const currentStage = STAGES[activeTab];

  return (
    <div
      className="yv-root"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="yv-stage" aria-live="off">
        <TicketCard />
        <div className="yv-slot yv-slotA" key={`A-${activeTab}`}>
          {currentStage.slotA}
        </div>
        <div
          className={`yv-slot yv-slotB${currentStage.isChip ? ' yv-slot--chip' : ''}`}
          key={`B-${activeTab}`}
        >
          {currentStage.slotB}
        </div>
      </div>

      <div className="yv-steps" role="tablist" aria-label="How it works">
        {STAGES.map((stage, idx) => (
          <button
            key={stage.id}
            role="tab"
            className="yv-step"
            aria-selected={idx === activeTab}
            onClick={() => {
              setActiveTab(idx);
              setUserClicked(true);
            }}
          >
            {stage.id}
          </button>
        ))}
      </div>
    </div>
  );
}
