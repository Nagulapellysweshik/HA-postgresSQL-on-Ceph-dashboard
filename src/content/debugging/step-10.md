# Step 10, load client and test tooling: debugging

## Blockers hit

### B1. New scripts not visible in the pod
- **Symptom:** after `kubectl apply` of the `lab-scripts` ConfigMap, `ls /scripts/payload.py` → no such file.
- **Root cause:** a mounted ConfigMap is synced by the kubelet periodically (~60–90 s), not instantly.
- **Fix:** recreate the pod (`kubectl delete pod load-client && kubectl apply -f manifests/50-load-client.yaml`). Logs survive on the Ceph PVC.
- **Lesson:** know your config-propagation delay. It matters for config rollouts during incidents.

### B2. Load generator too light to be meaningful
- **Symptom:** one `psql` process per row, ~10 writes/s.
- **Fix:** `scripts/payload.py`:
  - pooled persistent connections;
  - payment transactions over 3 tables;
  - unique, never-retried ids;
  - financial invariants;
  - replica readers;
  - TCP keepalive + `tcp_user_timeout`.
- **Validated** against a local PostgreSQL crash first (`results/local-e2e/`).

### B3. Analyzer bugs, caught by unit-testing with synthetic data
- Negative `recovery_to_90pct_s` (counted the partial second the outage ends in).
- Connect errors truncated to "connection to server at …", which hid `FATAL: too many clients`. Now it strips libpq's host/port prefix.
