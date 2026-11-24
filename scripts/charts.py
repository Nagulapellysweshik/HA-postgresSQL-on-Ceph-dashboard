#!/usr/bin/env python3
"""Render the throughput charts on the site straight from results/raw/*.timeline.csv.

Run:  python3 scripts/charts.py   (PG_LAB_REPO defaults to ~/projects/pg-lab)
Writes public/charts/*.svg. Colours are mid-tone so the SVGs read on light and dark pages.
"""
import csv, json, os
from datetime import datetime, timedelta

REPO = os.environ.get("PG_LAB_REPO", os.path.expanduser("~/projects/pg-lab"))
RAW = os.path.join(REPO, "results", "raw")
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "public", "charts")
os.makedirs(OUT, exist_ok=True)

W, H = 960, 300
L, R, T, B = 56, 16, 34, 40
WRITE, READ, ERR, MISS, MARK, GRID, TEXT = "#3b82f6", "#10b981", "#ef4444", "#f59e0b", "#a855f7", "#8884", "#8a8f98"
FONT = "font-family='ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif'"


def load(run):
    rows = list(csv.DictReader(open(os.path.join(RAW, run + ".timeline.csv"))))
    return [{k: int(v) for k, v in r.items()} for r in rows]


def t0_of(run, day="2026-11-22"):
    s = json.load(open(os.path.join(RAW, run + ".summary.json")))
    first = s["servers"][0]["first_utc"]
    return datetime.fromisoformat(f"{day}T{first}")


def sec(t0, hhmmss, day="2026-11-22"):
    return (datetime.fromisoformat(f"{day}T{hhmmss}") - t0).total_seconds()


def nice_max(v):
    for m in (500, 1000, 1500, 2000, 2500, 3000, 4000, 5000, 10000, 15000, 20000, 30000):
        if v <= m:
            return m
    return v


def chart(name, title, series, xmax, ymax=None, marks=(), spans=(), xlabel="seconds since load start", xfmt=None, legend_note=""):
    ymax = ymax or nice_max(max(max(s[1]) for s in series))
    pw, ph = W - L - R, H - T - B
    X = lambda x: L + pw * x / xmax
    Y = lambda y: T + ph * (1 - min(y, ymax) / ymax)
    o = [f"<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 {W} {H}' role='img' aria-label='{title}' {FONT}>"]
    o.append(f"<title>{title}</title>")
    for x0, x1, label in spans:
        o.append(f"<rect x='{X(x0):.1f}' y='{T}' width='{max(1.5, X(x1) - X(x0)):.1f}' height='{ph}' fill='{ERR}' opacity='0.12'/>")
        if label:
            o.append(f"<text x='{(X(x0) + X(x1)) / 2:.1f}' y='{T + ph - 6}' fill='{ERR}' font-size='11' text-anchor='middle'>{label}</text>")
    for i in range(5):
        yv = ymax * i / 4
        o.append(f"<line x1='{L}' x2='{W - R}' y1='{Y(yv):.1f}' y2='{Y(yv):.1f}' stroke='{GRID}' stroke-width='1'/>")
        o.append(f"<text x='{L - 8}' y='{Y(yv) + 4:.1f}' fill='{TEXT}' font-size='11' text-anchor='end'>{int(yv):,}</text>")
    step = [s for s in (10, 20, 30, 60, 120, 300, 600) if xmax / s <= 10][0]
    x = 0
    while x <= xmax:
        lab = xfmt(x) if xfmt else f"{x}"
        o.append(f"<text x='{X(x):.1f}' y='{H - B + 16}' fill='{TEXT}' font-size='11' text-anchor='middle'>{lab}</text>")
        x += step
    o.append(f"<text x='{L + pw / 2}' y='{H - 6}' fill='{TEXT}' font-size='11' text-anchor='middle'>{xlabel}</text>")
    for label, ys, color, width in series:
        pts = " ".join(f"{X(i):.1f},{Y(v):.1f}" for i, v in enumerate(ys) if i <= xmax)
        o.append(f"<polyline points='{pts}' fill='none' stroke='{color}' stroke-width='{width}' stroke-linejoin='round'/>")
    for i, (xm, label) in enumerate(marks):
        o.append(f"<line x1='{X(xm):.1f}' x2='{X(xm):.1f}' y1='{T}' y2='{T + ph}' stroke='{MARK}' stroke-width='1.5' stroke-dasharray='4 3'/>")
        anchor = "start" if X(xm) < W - 180 else "end"
        dx = 4 if anchor == "start" else -4
        o.append(f"<text x='{X(xm) + dx:.1f}' y='{T + 12 + 13 * (i % 3)}' fill='{MARK}' font-size='11' text-anchor='{anchor}'>{label}</text>")
    lx = L
    for label, _, color, _ in series:
        o.append(f"<rect x='{lx}' y='10' width='12' height='3' fill='{color}'/><text x='{lx + 16}' y='15' fill='{TEXT}' font-size='12'>{label}</text>")
        lx += 30 + 7 * len(label)
    if legend_note:
        o.append(f"<text x='{W - R}' y='15' fill='{TEXT}' font-size='11' text-anchor='end'>{legend_note}</text>")
    o.append("</svg>")
    open(os.path.join(OUT, name + ".svg"), "w").write("\n".join(o))
    print("wrote", name)


def col(rows, k):
    return [r[k] for r in rows]


# T2 r4: primary force-killed, direct path
r = load("t2-r4"); t0 = t0_of("t2-r4")
chart("t2-r4", "T2 run 4: writes and reads per second around the primary kill",
      [("writes ok/s", col(r, "tx_ok"), WRITE, 2), ("reads ok/s", col(r, "read_ok"), READ, 1.5), ("write errors/s", col(r, "tx_err"), ERR, 1.2)],
      len(r) - 1, ymax=3000,
      marks=[(sec(t0, "07:57:17.383"), "kill -9 primary"), (sec(t0, "07:57:37.096"), "lease acquired (+19.7 s)"), (sec(t0, "07:57:44.120"), "first ack on new primary")],
      spans=[(sec(t0, "07:57:19.909"), sec(t0, "07:57:44.120"), "24.2 s no writes")])

# T3: r1 (defaults) vs r2 (server_login_retry 1 s), aligned at the promote command
r1, r2 = load("t3-r1"), load("t3-r2")
p1 = int(round(sec(t0_of("t3-r1"), "08:14:50.987"))); p2 = int(round(sec(t0_of("t3-r2"), "08:30:09.739")))
a = col(r1, "tx_ok")[max(0, p1 - 20):p1 + 50]; b = col(r2, "tx_ok")[max(0, p2 - 20):p2 + 50]
chart("t3-compare", "T3: planned switchover, client writes per second before and after the PgBouncer fix",
      [("before: server_login_retry 15 s (30.0 s outage)", a, ERR, 2), ("after: server_login_retry 1 s (8.0 s outage)", b, WRITE, 2)],
      min(len(a), len(b)) - 1, ymax=2000, marks=[(20, "cnpg promote"), (27.6, "DB switchover done (7.6 s)")],
      xlabel="seconds (promote at 20)")

# T5: OSD loss
r = load("t5-r1"); t0 = t0_of("t5-r1")
chart("t5-r1", "T5: Ceph OSD on the primary's node stopped for 3 min 22 s",
      [("writes ok/s", col(r, "tx_ok"), WRITE, 1.6), ("read misses/s", col(r, "read_miss"), MISS, 1.2)],
      len(r) - 1, ymax=2500,
      marks=[(sec(t0, "08:54:02"), "osd.1 stopped"), (sec(t0, "08:57:24"), "osd.1 restart"), (sec(t0, "08:59:10"), "osd rejoins: stall + backfill")],
      spans=[(sec(t0, "08:54:02"), sec(t0, "08:57:24"), "degraded, 0 errors"), (sec(t0, "08:59:10"), sec(t0, "08:59:50"), "")])

# T6: zone loss (22.5 min)
r = load("t6-r2"); t0 = t0_of("t6-r2")
mm = lambda x: f"{int(x // 60)}m"
chart("t6-r2", "T6: EC2 node with the primary stopped for 16 min (zone ap-south-2c)",
      [("writes ok/s", col(r, "tx_ok"), WRITE, 1.2), ("read misses/s", col(r, "read_miss"), MISS, 1)],
      len(r) - 1, ymax=2500, xfmt=mm, xlabel="minutes since load start",
      marks=[(sec(t0, "12:02:56"), "stop-instances"), (sec(t0, "12:04:56"), "24.5 s failover"), (sec(t0, "12:18:55"), "start-instances"), (sec(t0, "12:24:44"), "HEALTH_OK")],
      spans=[(sec(t0, "12:05:20"), sec(t0, "12:18:55"), "zone down: full rate on 2 zones"), (sec(t0, "12:22:16"), sec(t0, "12:24:30"), "")])

# T11: rolling minor upgrade (57 min)
r = load("t11-r1"); t0 = t0_of("t11-r1")
chart("t11-r1", "T11: rolling upgrade 18.6 to 18.7 under load (57 min)",
      [("writes ok/s", col(r, "tx_ok"), WRITE, 1), ("write errors/s", col(r, "tx_err"), ERR, 1)],
      len(r) - 1, ymax=2500, xfmt=mm, xlabel="minutes since load start",
      marks=[(sec(t0, "10:05:17"), "image patched"), (sec(t0, "10:51:00"), "CSI fixed"), (sec(t0, "11:00:28"), "primary restart: 16.5 s")],
      spans=[(sec(t0, "10:05:17"), sec(t0, "10:52:00"), "replica stuck Pending (2/3 instances), writes unaffected")])

# T7: 1000 clients, direct vs pooled
d, p = load("t7-a-direct"), load("t7-a-pooled")
chart("t7-storm", "T7: 1 000 clients, direct to Postgres vs through PgBouncer",
      [("direct: tx/s", col(d, "tx_ok"), ERR, 1.8), ("direct: errors/s", col(d, "tx_err"), MISS, 1.2), ("PgBouncer: tx/s", col(p, "tx_ok"), WRITE, 2), ("PgBouncer: errors/s", col(p, "tx_err"), READ, 1.2)],
      min(len(d), len(p)) - 1, ymax=3000, legend_note="direct: 57/1000 clients served · pooled: 1000/1000")

# T12: load during backup + incident
r = load("t12-r1"); t0 = t0_of("t12-r1")
chart("t12-r1", "T12: 1 500 tx/s during a 12-min base backup, then the fat-finger DELETE",
      [("writes ok/s", col(r, "tx_ok"), WRITE, 1.2), ("reads ok/s", col(r, "read_ok"), READ, 1)],
      len(r) - 1, ymax=2500, xfmt=mm, xlabel="minutes since load start",
      marks=[(sec(t0, "11:15:32"), "base backup starts"), (sec(t0, "11:27:51"), "backup done"), (sec(t0, "11:28:24.3"), "TARGET"), (sec(t0, "11:28:56.9"), "DELETE")])
