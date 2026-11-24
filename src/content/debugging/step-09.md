# Step 09, HAProxy: debugging

## Blockers hit

### B1. 19 sessions on `pg_rw` with no clients
- **Evidence:** `docs/screenshots/09-haproxy-stats-backends-up.png` (Sessions Total 19 at 38 s uptime, LbTot 8 + 11).
- **Diagnosis:** 38 s ÷ 2 s = 19, matching the readiness probe period (`tcpSocket :5432`, `periodSeconds: 2`).
- **Root cause:** each kubelet TCP probe on 5432 was proxied through to a PgBouncer pod. That's fake traffic in counters and logs, and it proves nothing about HAProxy's health.
- **Fix:** probe the stats page (`httpGet :8404 /`).

### B2. `MAINT (resolution)` on rw3/rw4: not a fault
`server-template … 4` reserves 4 slots; DNS returned 2 pods. The slots fill if pods are added or replaced.

### B3. Design debt: a single HAProxy replica ended up on the primary's node (found in T6 pre-flight)
- **How it was found:** before stopping the primary's EC2 node for T6, a placement check:
  ```bash
  kubectl -n pg get pods -o wide | awk '{print $1, $7}'
  ```
  showed `haproxy-6968c5b47c-nsw4k` **and** the primary `pg-lab-1` (and the Ceph toolbox) all on `ip-10-90-173-158`. HAProxy had been rescheduled onto that node during T10's restarts.
- **Why it matters:** HAProxy is the **only entry point** for the application (`:5432` writes, `:5433` reads) and ran **1 replica with no placement rules**. Losing that one node would have taken out the database primary **and** the only proxy at the same moment:
  - the 3-zone database would fail over in ~25 s, but **no client could reach it**;
  - Kubernetes only evicts pods from an unreachable node after `tolerationSeconds: 300` (5 min), and only then starts a new HAProxy. **A ~5-minute total outage for apps from a single node loss**, though the database itself was fine.
- **Root cause (design):** the HA effort went into the database tier (3 instances, 3 zones, sync replication, fencing). The stateless tiers in front of it were treated as "stateless = safe". Scheduling is dynamic, so without explicit rules any pod can land anywhere, including next to the component it's supposed to survive.
- **Immediate action:** T6 targets a node without HAProxy (primary switched to pg-lab-3 first), so the test measures database failover rather than the proxy SPOF.
- **Fix (in `manifests/40-haproxy.yaml`):**
  - `replicas: 2`;
  - `topologySpreadConstraints` across zones (`maxSkew: 1`), so each replica is in a different zone;
  - a PodDisruptionBudget (`minAvailable: 1`), so drains/upgrades never remove both;
  - shorter `tolerationSeconds` (30 s) for `not-ready`/`unreachable`, so a replacement starts in ~30 s instead of 5 min.
  - The ClusterIP Service already load-balances across replicas; kube-proxy drops a dead one when its endpoint goes NotReady.
- **Lessons:**
  1. **The availability of a system is capped by its least-redundant hop.** A 3-zone, zero-data-loss database behind one proxy has the availability of that proxy.
  2. **"Stateless" isn't "highly available".** Stateless pods are easy to *replace*, but replacement from a failed node takes minutes unless a replica is *already running* elsewhere.
  3. **Placement is a design decision, not luck.** Without anti-affinity or topology spread, restarts quietly co-locate components, correlating their failures.
  4. **Do a blast-radius check before every fault test (and every node maintenance):** list what runs on the target node. It found this before any outage did.
