// Index of every blocker hit (docs/DEBUGGING.md), plus the method that found them.

export const method = [
  ["Write the symptom down precisely, with timestamps", "\"Writes 0 from 08:14:52 to 08:15:22\" beats \"it's broken\"."],
  ["Walk the request path and read each component's log in order", "Client → HAProxy → PgBouncer → Service → Postgres → CSI → Ceph; operator → instance manager → Lease. T3 needed four logs."],
  ["Measure at the client, not only at the component", "`kubectl cnpg status` said 7.6 s; the application saw 30 s."],
  ["Cross-check every number with an independent source", "T10's script vs a live HAProxy view exposed a broken grep; T8's averages vs per-client counts exposed starvation."],
  ["Change one thing, then re-measure under the same load", "`server_login_retry` 15 → 1 s; outage 30 → 8 s."],
  ["Separate 'fixed' from 'understood'", "Open questions (the T3 SCRAM rejection) are recorded, not explained with a guess."],
  ["Capture evidence before the next fault destroys it", "A killed pod takes its log with it; live panes tee to files."],
  ["Check the blast radius before every fault", "T6's pre-flight found three placement flaws before the fault did."],
  ["Re-validate the basics after every fault", "T5 passed but left a CSI config fault that surfaced 70 minutes later in T11."],
];

// [where, blocker, root cause, kind]  kind: setup | test | design | tooling
export const blockers = [
  ["Step 2", "Images hidden from the chart values", "Operator binaries default to upstream registries; found with `strings`", "setup"],
  ["Steps 3–4", "\"Private\" cluster created with a public endpoint", "eksctl only disables public access as its last step", "setup"],
  ["Step 5", "Only 2 OSDs", "NVMe device names swap on Nitro", "setup"],
  ["Step 5", "Never HEALTH_OK", "`AUTH_INSECURE_*` warnings with the `aes` key type on kernels < 7.0", "setup"],
  ["Steps 5/6", "PVC Pending forever", "Rook 1.21 needs the separate `ceph-csi-drivers` chart", "setup"],
  ["Step 9", "19 sessions with no clients", "Readiness probe proxied through to PgBouncer", "setup"],
  ["Step 9 / T6", "Single HAProxy replica next to the primary", "No replicas or placement rules on a stateless tier", "design"],
  ["T6", "Both CoreDNS replicas on the primary's node", "EKS add-on default: soft node anti-affinity, no zone spread", "design"],
  ["T6", "Cordon silently moved the primary", "CNPG switches over off unschedulable nodes (a feature)", "design"],
  ["Step 10", "New scripts missing in the pod", "ConfigMap volume sync delay", "tooling"],
  ["T2", "24 s failover", "15 s CNPG primary-lease expiry (split-brain guard, by design)", "test"],
  ["T3", "7.6 s switchover, 30 s client outage", "PgBouncer `server_login_retry` 15 s, twice", "test"],
  ["T5", "Stall and 35% throughput when the disk returned", "Peering plus backfill competing with clients", "test"],
  ["T7", "DBA's superuser `psql` refused during the storm", "Reserved slots consumed", "test"],
  ["T8", "Session mode looked fastest", "Averages hid per-client starvation", "test"],
  ["T8/T9", "Slot exhaustion; next workload refused at rest", "32 PgBouncer auth connections plus idle server connections", "test"],
  ["T10", "Identical 1.4–1.6 s 'detection' in every setting", "Script timing artifact, caught by cross-checking a live HAProxy view", "tooling"],
  ["T11", "Rolling upgrade stuck 45 min; replica Pending", "CSI ClientProfile gone, config `[]` (latent since T5); Rook operator restart", "test"],
];

export const designFindings = [
  { title: "Least-redundant hop caps availability", body: "A 3-zone, zero-data-loss database behind one HAProxy replica has the availability of that one pod." },
  { title: "Shared dependencies need failure-domain spread", body: "Both CoreDNS replicas sat on the primary's node. A node loss would have been a cluster-wide DNS outage, not a DB failover." },
  { title: "Defaults in the middle tier dominate", body: "PgBouncer's 15 s `server_login_retry` was 80% of a planned switchover's outage." },
  { title: "The sync standby is part of the write path", body: "Heavy reads on the replicas doubled commit latency on the primary (T9)." },
  { title: "Size max_connections for hidden consumers", body: "32 PgBouncer auth connections + idle pools left ~65 of 100 slots for the application." },
  { title: "Recovery, not failure, is the incident", body: "Ceph was quiet while degraded; throughput dropped to 35–40% when the disk or zone came back." },
];
