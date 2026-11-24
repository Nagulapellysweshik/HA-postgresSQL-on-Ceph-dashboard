# Case study: a 7.5 s database switchover that cost clients 30 s

**Summary:** A planned PostgreSQL switchover under payment load (1 500 tx/s + 2 000 reads/s) finished in **7.6 s at the database**, but the application couldn't write for **30.0 s**. Logs from four components (load generator, CNPG operator, PgBouncer, PostgreSQL) traced the extra 24 s to **PgBouncer caching failed server logins for `server_login_retry` (default 15 s), twice in a row**. Setting it to 1 s cut the client outage to **8.0 s (−73%)**, verified by re-running the same test. Zero acknowledged payments were lost and the books balanced in both runs.

| | Before (t3-r1, defaults) | After (t3-r2, `server_login_retry: 1`) |
|---|---|---|
| Database switchover complete | 7.6 s | 7.5 s |
| **Client write outage** | **30.0 s** | **8.0 s** |
| Clients writing again after the database was ready | 24.3 s | **2.4 s** |
| Client errors | 5 739 | 721 |
| Acked payments lost / invariants | 0 / hold | 0 / hold |

---

## 1. The test
- **Setup:** `tests/t3-switchover/t3-switchover.sh`.
  - 64 writers send payment transactions (INSERT payment, INSERT ledger, UPDATE merchant balance, COMMIT) at 1 500 tx/s through **HAProxy :5432 → PgBouncer (rw, transaction mode) → primary**.
  - 16 readers send status lookups at 2 000/s through HAProxy :5433 → PgBouncer (ro) → replicas.
- **Action:** after 30 s, `kubectl cnpg promote pg-lab <standby>`: a controlled switchover, which is what a DBA runs before maintenance.
- **Expectation:** much faster than an unplanned crash (T2: ~24 s, dominated by the 15 s primary-lease expiry), because the old primary shuts down cleanly and hands over the lease.

## 2. The symptom (t3-r1)
![t3-r1 live: test summary, traffic per second, pods, operator log](../../docs/screenshots/t3-r1-switchover-4-pane-live.png)

The traffic pane (middle) shows two distinct phases. Writes went to 0 for 30 s while reads mostly continued:

| Seconds (UTC) | Writes ok/s | Clients connected | Client errors/s | Reads ok/s |
|---|---|---|---|---|
| ≤ 08:14:52 | ~1 500 | 64/64 | 0 | ~2 000 |
| 08:14:53 – 08:15:07 (**phase A**) | 0 | **25/64** | ~39 | ~2 000 |
| 08:15:08 – 08:15:22 (**phase B**) | 0 | **3–5/64** | **~340** | ~1 300 |
| 08:15:23 → | 1 595 → steady 1 500 | 64/64 | 0 | ~2 000 |

Load-generator summary (`results/raw/t3-r1.summary.json`):
```
write_outage_s=30.042  (08:14:52.859 -> 08:15:22.902 UTC)
acked_rows_lost=0   committed_not_acked=11   invariants_hold=True (88 659 payments)
 5014 x SSL connection has been closed unexpectedly
  718 x connect failed: FATAL: server login has been failing, cached error: ...
```

## 3. Investigation
**Step 1: was the database slow?** No. The test's own events and the CNPG operator (`results/raw/t3-r1.events`, `t3-r1.operator-live.txt`):
```
08:14:50.987  promote pg-lab-1
08:14:52.398  operator: Setting primary label to unhealthy in the old primary
08:14:57.769  operator: Setting primary label
08:14:58.572  new primary = pg-lab-1          <- database side done in 7.6 s
08:15:22.902  first client ack                 <- 24.3 s later
```
The new primary's instance log (`t3-r1.new-primary-auth.txt`) confirms a clean promotion with **no lease wait**: `Acquiring primary lease` at 08:14:52.36, then `promoted successfully` at 08:14:57.52. So the gap is **between the database and the clients**.

**Step 2: what did PgBouncer do?** Grouped rw-pooler log (`t3-r1.pooler-rw.grouped.txt`; raw: `t3-r1.pooler-rw.log.gz`):
```
08:14:52.835 .. 08:14:52.873    110  server conn crashed?                      <- old primary shutting down
08:14:52     ..                   4  closing because: connect failed           <- reconnect hits the old primary
08:14:52     .. 08:15:07       1440  server login has been failing, cached error: connect failed (server_login_retry)
08:15:07     ..                  61  new connection to server / SSL established <- retry reaches the NEW primary
08:15:07     ..                  27  password authentication failed for user "app"
08:15:07     .. 08:15:22       4954  server login has been failing, cached error: password authentication failed (server_login_retry)
```
**Phases A and B are each exactly one `server_login_retry` window (15 s).** After one failed server login, PgBouncer caches the error and **rejects every client login** until the window expires. It doesn't matter that the new primary was ready 6 s into phase A.

**Step 3: why did the login to the new primary fail?** PostgreSQL's view (`t3-r1.new-primary-auth.txt`):
```
FATAL   password authentication failed for user "app"
DETAIL  Connection matched file "pg_hba.conf" line 26: "host all all all scram-sha-256"
```
- The rule is the normal SCRAM rule (not a missing `pg_hba` entry).
- The new primary's log shows **no role or password change** around the promotion.
- The failing sessions were PgBouncer's **client sessions connected before the switchover** (`age=49s`).
- **Fresh** client logins after the cache expired succeeded.

## 4. Root cause
1. **Primary cause (fixed):** PgBouncer's `server_login_retry` defaults to **15 s**. It's designed to stop PgBouncer hammering a dead server. During a switchover there's always a moment when the old primary refuses connections, so **one** failed login turns into **15 s of refusals for every client**. It happened twice, for two different reasons, so the outage was 30 s.
2. **Contributing (contained, open):** after promotion, PgBouncer's SCRAM pass-through login for sessions authenticated **before** the switchover is rejected by the new primary. It reproduced in **2/2 runs** (t3-r2: `age=38–39s` sessions, 08:30:17.35). The role's verifier is replicated and unchanged, so the exact mechanism inside PgBouncer's SCRAM key handling is still to be determined. With the fix it costs < 1 s.

## 5. Fix
`manifests/30-pooler-rw.yaml` and `30-pooler-ro.yaml`:
```yaml
spec:
  pgbouncer:
    parameters:
      server_login_retry: "1"   # was default 15 s
```
Applied with `kubectl apply -f manifests/30-pooler-rw.yaml -f manifests/30-pooler-ro.yaml`. CNPG reloaded PgBouncer in place (pooler pods weren't restarted).

## 6. Verification (t3-r2, same test, same load)
![t3-r2 live after the fix](../../docs/screenshots/t3-r2-switchover-tuned-4-pane-live.png)

```
08:30:09.739  promote pg-lab-2
08:30:17.197  new primary = pg-lab-2           <- database side 7.5 s (unchanged)
08:30:19.636  first client ack                 <- 2.4 s later (was 24.3 s)
write_outage_s=8.037   acked_rows_lost=0   invariants_hold=True (110 851 payments)
```
Grouped pooler log (`t3-r2.pooler-rw.grouped.txt`):
```
08:30:11.600 .. 08:30:16.468   694  cached error: connect failed        <- retried every 1 s until the new primary was up
08:30:17.346 ..                 25  password authentication failed      <- the SCRAM issue again (pre-switchover sessions)
08:30:17.388 .. 08:30:18.183   309  cached error: password auth failed   <- now 0.8 s instead of 15 s
```

## 7. Lessons
1. **Measure availability where the clients are.** `kubectl cnpg status` said 7.6 s; the application said 30 s. Any HA claim measured only at the database is incomplete.
2. **Defaults in the middle tier can dominate.** The database, operator and lease logic were already fast. A 15 s pooler default, built for a different failure mode, was 80% of the outage.
3. **Read every component's log in the request path, in order:** client errors, then operator decisions, then pooler, then database. Each log answered one question and pointed to the next.
4. **Change one thing, then re-measure under the same load.** The fix is credible because t3-r2 repeated t3-r1 exactly and moved only the expected term (24.3 s → 2.4 s after the database was ready).
5. **Separate "fixed" from "understood".** The SCRAM rejection is reproducible and contained, but its mechanism isn't proven yet. It's recorded as open rather than explained with a guess.
6. **Safety and availability are separate properties.** Through both runs, zero acknowledged payments were lost and the financial invariant held. Only the outage length changed.

## Evidence index
| File | Content |
|---|---|
| `results/raw/t3-r1.summary.json`, `.timeline.csv`, `.console`, `.events` | r1 client-side numbers, per-second traffic, live console, test events |
| `results/raw/t3-r1.operator-live.txt` | r1 CNPG operator decisions (transcribed from the live pane) |
| `results/raw/t3-r1.pooler-rw.grouped.txt`, `.log.gz` | r1 PgBouncer log, grouped and raw |
| `results/raw/t3-r1.new-primary-auth.txt` | r1 PostgreSQL FATAL + DETAIL on the new primary, promotion sequence |
| `results/raw/t3-r2.*` (same set + `failover-live.txt`) | r2 after the fix |
| `docs/screenshots/t3-r1-switchover-4-pane-live.png` | r1 live 4-pane capture |
| `docs/screenshots/t3-r2-switchover-tuned-4-pane-live.png` | r2 live 4-pane capture |
