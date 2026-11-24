import { createContext, useContext, useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";

/* ---------- inline markup: **bold**, `code`, [text](url) ---------- */
export function Md({ children, as: Tag = "span" }) {
  const parts = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  let last = 0, m, i = 0;
  const s = String(children ?? "");
  while ((m = re.exec(s))) {
    if (m.index > last) parts.push(s.slice(last, m.index));
    const t = m[0];
    if (t.startsWith("**")) parts.push(<b key={i++}><Md>{t.slice(2, -2)}</Md></b>);
    else if (t.startsWith("`")) parts.push(<code key={i++}>{t.slice(1, -1)}</code>);
    else {
      const [, text, href] = t.match(/\[([^\]]+)\]\(([^)]+)\)/);
      parts.push(<a key={i++} href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noreferrer">{text}</a>);
    }
    last = m.index + t.length;
  }
  if (last < s.length) parts.push(s.slice(last));
  return <Tag>{parts}</Tag>;
}

/* ---------- lightbox ---------- */
const LightboxCtx = createContext(() => {});
export function LightboxProvider({ children }) {
  const [img, setImg] = useState(null);
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && setImg(null);
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, []);
  return (
    <LightboxCtx.Provider value={setImg}>
      {children}
      {img && (
        <div className="lb open" onClick={() => setImg(null)}>
          <img src={img.src} alt={img.caption} />
          <div className="cap">{img.caption.replace(/`/g, "")}</div>
        </div>
      )}
    </LightboxCtx.Provider>
  );
}

export function Shot({ src, caption, crop }) {
  const open = useContext(LightboxCtx);
  return (
    <figure>
      <img className="zoom" src={src} alt={caption.replace(/`/g, "")} loading="lazy" style={crop ? { aspectRatio: "16/10", objectFit: "cover", objectPosition: "top left" } : undefined} onClick={() => open({ src, caption })} />
      <figcaption><Md>{caption}</Md></figcaption>
    </figure>
  );
}

export function Shots({ items }) {
  if (!items?.length) return null;
  return <div className="shots">{items.map((s) => <Shot key={s.src} {...s} crop />)}</div>;
}

export function Chart({ src, caption }) {
  const open = useContext(LightboxCtx);
  return (
    <figure className="chart">
      <img className="zoom" src={src} alt={caption.replace(/`/g, "")} onClick={() => open({ src, caption })} />
      <figcaption><Md>{caption}</Md></figcaption>
    </figure>
  );
}

// Up to 10x the browser plays the recording natively. Above that it switches to a pre-encoded 2x copy
// (<name>-2x.mp4) played at half the rate, because browsers cap playbackRate (Chrome at 16).
const SWITCH_AT = 10;
const fastSrc = (src) => src.replace(/\.mp4$/, "-2x.mp4");

export function Video({ src, poster, caption, rate: initialRate = 1 }) {
  const ref = useRef(null);
  const [rate, setRate] = useState(initialRate);
  const fast = rate > SWITCH_AT;
  const file = fast ? fastSrc(src) : src;
  const native = fast ? rate / 2 : rate;
  const pending = useRef(null); // position (in original seconds) to restore after a source switch

  const apply = () => { if (ref.current) ref.current.playbackRate = native; };
  useEffect(apply, [native]);

  const changeRate = (next) => {
    const v = ref.current;
    if (v && (next > SWITCH_AT) !== fast) {
      const original = fast ? v.currentTime * 2 : v.currentTime;
      pending.current = { t: original, playing: !v.paused };
    }
    setRate(next);
  };

  const onLoaded = () => {
    const v = ref.current;
    apply();
    if (v && pending.current) {
      v.currentTime = fast ? pending.current.t / 2 : pending.current.t;
      if (pending.current.playing) v.play().catch(() => {});
      pending.current = null;
    }
  };

  return (
    <figure>
      <video ref={ref} key={file} controls preload="metadata" poster={poster} playsInline muted onLoadedMetadata={onLoaded} onPlay={apply}>
        <source src={file} type="video/mp4" />
      </video>
      <div className="speed">
        <span className="speed-label">Speed</span>
        <input type="range" min="1" max="20" step="1" value={rate} onChange={(e) => changeRate(Number(e.target.value))} aria-label="Playback speed" />
        <span className="speed-val">{rate}×</span>
      </div>
      <figcaption><Md>{caption}</Md></figcaption>
    </figure>
  );
}

/* ---------- data display ---------- */
export function Table({ head, rows, caption, numeric = [] }) {
  return (
    <>
      {caption && <h4><Md>{caption}</Md></h4>}
      <div className="table-wrap">
        <table>
          <thead><tr>{head.map((h, i) => <th key={i} className={numeric.includes(i) ? "num" : ""}><Md>{h}</Md></th>)}</tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>{r.map((c, j) => <td key={j} className={numeric.includes(j) ? "num" : ""}><Md>{c}</Md></td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function Stats({ items, compact }) {
  return (
    <div className={compact ? "verdict" : "stats"}>
      {items.map((s, i) =>
        compact ? (
          <div key={i} className={s.tone ? `t-${s.tone}` : ""}><b>{s.v}</b><span>{s.l}</span></div>
        ) : (
          <div key={i} className={`stat ${s.tone || ""}`}><div className="v">{s.v}</div><div className="l"><Md>{s.l}</Md></div></div>
        )
      )}
    </div>
  );
}

export function Learnings({ items }) {
  return <ol className="learn">{items.map((l, i) => <li key={i}><Md>{l}</Md></li>)}</ol>;
}

export function EvidenceLinks({ files }) {
  if (!files?.length) return null;
  return (
    <div className="evidence-links">
      {files.map((f) => <a key={f} href={f} target="_blank" rel="noreferrer">{f.split("/").pop()}</a>)}
    </div>
  );
}

export function Callout({ tone = "", title, children }) {
  return <div className={`callout ${tone}`}>{title && <p><b>{title}</b></p>}{children}</div>;
}

export function SectionHead({ kicker, title, sub }) {
  return (
    <header className="section-head">
      {kicker && <div className="kicker">{kicker}</div>}
      <h2>{title}</h2>
      {sub && <p className="sub"><Md>{sub}</Md></p>}
    </header>
  );
}

/* ---------- T2 failover anatomy ---------- */
export function FailoverBar() {
  const seg = [
    ["Detect", 0.75, "var(--c1)"],
    ["Elect", 2.65, "var(--c2)"],
    ["Lease expiry (split-brain guard)", 16.1, "var(--c3)"],
    ["Promote", 2.7, "var(--c4)"],
    ["Service + reconnect", 4.3, "var(--c5)"],
  ];
  const total = seg.reduce((a, s) => a + s[1], 0);
  return (
    <div className="fbar-wrap">
      <div className="bar">
        {seg.map(([l, v, c]) => (
          <div key={l} style={{ width: `${(v / total) * 100}%`, background: c }} title={`${l}: ${v} s`}>{v >= 2.5 ? `${v} s` : ""}</div>
        ))}
      </div>
      <div className="bar-legend">
        {seg.map(([l, v, c]) => <span key={l} style={{ "--c": c }}>{l} · {v} s</span>)}
      </div>
    </div>
  );
}

/* ---------- layout ---------- */
const NAV = [
  ["/", "Architecture"],
  ["/tests", "Failure tests"],
  ["/case-study", "Case study"],
  ["/evidence", "Evidence"],
  ["/build", "Build log"],
];

function useTheme() {
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem("theme"); } catch { return null; }
  });
  useEffect(() => {
    if (theme) document.documentElement.setAttribute("data-theme", theme);
    try { theme && localStorage.setItem("theme", theme); } catch { /* storage unavailable */ }
  }, [theme]);
  const toggle = () => {
    const dark = theme ? theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    setTheme(dark ? "light" : "dark");
  };
  return toggle;
}

// Three database cylinders, one per availability zone: the primary (filled) between two standbys.
function BrandMark() {
  const db = (x, primary) => (
    <g key={x} className={primary ? "bm-primary" : "bm-standby"}>
      <path d={`M${x} 9v10c0 1.4 2.5 2.5 5.5 2.5s5.5-1.1 5.5-2.5V9`} />
      <ellipse cx={x + 5.5} cy="9" rx="5.5" ry="2.5" />
      <path d={`M${x} 14c0 1.4 2.5 2.5 5.5 2.5s5.5-1.1 5.5-2.5`} className="bm-band" />
    </g>
  );
  return (
    <svg className="brand-mark" viewBox="0 0 40 28" width="34" height="24" aria-hidden="true">
      {db(1, false)}
      {db(14.5, true)}
      {db(28, false)}
    </svg>
  );
}

export function Layout({ children }) {
  const toggle = useTheme();
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
    // keep the current tab visible in the swipeable mobile tab strip
    document.querySelector(".nav-links a.active")?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [pathname]);
  return (
    <LightboxProvider>
      <nav className="nav">
        <div className="nav-inner">
          <Link to="/" className="brand" aria-label="HA PostgreSQL on Ceph, home"><BrandMark /><span className="brand-full">HA PostgreSQL on Ceph</span><span className="brand-short">HA PG on Ceph</span></Link>
          <div className="nav-links">
            {NAV.map(([to, label]) => <NavLink key={to} to={to} end={to === "/"}>{label}</NavLink>)}
          </div>
          <button className="theme-btn" onClick={toggle} aria-label="Toggle dark mode">◐</button>
        </div>
      </nav>
      <main>{children}</main>
      <footer>
        <div className="wrap">
          <span>HA PostgreSQL on Ceph · CloudNativePG, Rook-Ceph, PgBouncer, HAProxy on Kubernetes</span>
          <span className="contact-links">Questions, findings or corrections:{" "}
            <a href="mailto:sweshiknagulapelly@gmail.com" title="sweshiknagulapelly@gmail.com">Email</a>
            {" · "}<a href="https://www.linkedin.com/in/nagulapelly-sweshik/" target="_blank" rel="noreferrer">LinkedIn</a>
            {" · "}<a href="https://github.com/Nagulapellysweshik/HA-postgresSQL-on-Ceph" target="_blank" rel="noreferrer">GitHub</a></span>
        </div>
      </footer>
    </LightboxProvider>
  );
}
