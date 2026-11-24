# HA PostgreSQL on Ceph: project site

The write-up for a hands-on reliability lab: a 3-zone CloudNativePG cluster on Rook-Ceph, behind PgBouncer and HAProxy,
on a fully private Amazon EKS cluster, tested under a payment-shaped workload (pod crash, zone loss, disk loss,
connection storm, pool tuning, read/write split, rolling upgrade, point-in-time recovery).

Code: https://github.com/Nagulapellysweshik/HA-postgresSQL-on-Ceph

A static React + Vite site, with no backend. Routes use hash URLs (`#/tests/t6-node-loss`), so the build works on any static host.

## Run locally
```bash
npm ci
npm run dev        # http://localhost:5173
npm run build      # writes dist/
npm run preview    # serves dist/
```

## Publish
GitHub Pages: Settings → Pages → Source: **GitHub Actions**. `.github/workflows/deploy.yml` builds and deploys on every push to `main`.

## Layout
| Path | What |
|---|---|
| `src/data/tests.js` | T0–T12: question, setup, results, timelines, learnings |
| `src/data/steps.js` | Build steps with the issues hit at each |
| `src/content/debugging/` | Debugging notes for the issues actually faced |
| `src/pages.jsx`, `src/ArchPage.jsx`, `src/components.jsx`, `src/viewers.jsx` | Pages and components |
| `public/img/`, `public/media/` | Screenshots and screen recordings from the runs (identifiers redacted) |
| `public/evidence/` | Selected logs per build step and per test (identifiers replaced with placeholders) |
| `public/charts/` | Throughput charts rendered from the per-second test timelines (`scripts/charts.py`) |

Questions or corrections: sweshiknagulapelly@gmail.com
