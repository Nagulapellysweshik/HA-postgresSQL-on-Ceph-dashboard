// Build steps 1–10 from docs/steps/*.md, with the blockers hit at each one.

export const steps = [
  {
    n: "1",
    key: "step-01",
    title: "Tooling and private S3 bucket",
    what: "Workstation set up with `aws`, `eksctl`, `kubectl`, `helm`, `crane` and `yq`. A private, encrypted, tagged S3 bucket in ap-south-2 holds the database backups and test results.",
    result: ["Region ap-south-2, three availability zones (2a, 2b, 2c)", "Bucket: Block Public Access on, AES256 encryption, tagged `project=pg-lab`"],
  },
  {
    n: "2",
    key: "step-02",
    title: "Mirror every image into private ECR",
    what: "The nodes have no internet path (no NAT, no IGW), so every image must already be in a private ECR repo in the same region. The hard part is finding the complete list.",
    code: `# Templates only show 4 images. The rest are compiled into operator binaries:
crane export --platform linux/amd64 quay.io/cephcsi/ceph-csi-operator:v1.1.0 - | tar x manager
strings manager | grep -oE 'sig-storage/csi-[a-z-]+:v[0-9.]+|cephcsi/cephcsi:v[0-9.]+' | sort -u
# -> cephcsi v3.18.1, registrar, provisioner, snapshotter, attacher, resizer, csiaddons sidecar`,
    result: ["16 images mirrored (Rook/Ceph, 8 CSI images, CNPG, PostgreSQL 18.6 + 18.7 `-system-`, PgBouncer, HAProxy)", "No `ImagePullBackOff` at any later step: the list was complete"],
    blockers: [
      { t: "Images hidden from chart values", d: "Rook 1.21's `csi.*` image values are empty (\"use operator built-in defaults\"); CNPG's operand images are compiled in too. Found them with `strings` on the operator binaries." },
    ],
  },
  {
    n: "3–4",
    key: "step-03-04",
    title: "Stage files and create the fully private EKS cluster",
    what: "`eksctl` private-cluster mode: own VPC, private subnets only, no NAT gateway, no internet gateway, no Elastic IP; OIDC for IRSA; 3 × m6i.xlarge, one per AZ, each with a blank 50 GiB gp3 disk for Ceph. AWS services through VPC endpoints.",
    result: ["EKS 1.37 with private endpoint access, created in ~20 min", "Generated CloudFormation contains no IGW, NAT gateway or EIP (verified)", "Add-ons: vpc-cni, coredns, kube-proxy, snapshot-controller, metrics-server"],
    blockers: [
      { t: "eksctl creates a 'private' cluster with the public endpoint ON", d: "It's open to 0.0.0.0/0 for the ~20 min of creation and only disabled as the last step; not in eksctl's printed plan. `--dry-run` also prints `nat: Single` before private-mode overrides. Set `vpc.nat.gateway: Disable` explicitly." },
    ],
  },
  {
    n: "5",
    key: "step-05",
    title: "Rook-Ceph: 3 mons, 3 OSDs, one per zone",
    what: "Rook operator + cluster charts from staged files, every image from ECR. RBD pool `size 3`, `min_size 2`, failure domain `zone`, so every block has one copy in each AZ.",
    result: ["HEALTH_OK, mons a,b,c in quorum", "3 OSDs up/in: osd.2 in 2a, osd.0 in 2b, osd.1 in 2c", "33 PGs active+clean, 150 GiB raw"],
    shots: [
      { src: "img/05-rook-install-nodes-in-3-zones.png", caption: "3 nodes, one per AZ; Rook operator and cluster charts installing" },
      { src: "img/05-ceph-health-ok-osd-tree-pools.png", caption: "Ceph HEALTH_OK, 3 mons in quorum, one OSD per zone in the CRUSH tree, pool size 3 / min_size 2" },
    ],
    blockers: [
      { t: "Only 2 OSDs came up", d: "NVMe names on Nitro follow probe order: the root disk was `nvme1n1` on one node, so `deviceFilter: ^nvme1n1$` skipped the blank disk there. Fix: `^nvme[0-9]+n1$` (Rook refuses disks with partitions, so it's safe)." },
      { t: "Never HEALTH_OK", d: "Rook 1.21 uses the `aes` cephx key type on kernels < 7.0; Ceph Tentacle warns about it forever. The install script mutes exactly the three `AUTH_INSECURE_*` codes." },
    ],
  },
  {
    n: "6",
    key: "step-06",
    title: "Prove the storage data path: PVC + VolumeSnapshot",
    what: "Before any database goes on Ceph: a 1 Gi PVC must bind and a VolumeSnapshot of it must become ready.",
    result: ["PVC Bound in ~3 s", "VolumeSnapshot readyToUse in ~2 s", "Cleanup: snapshot before PVC (finalizer)"],
    shots: [
      { src: "img/06-blocker-pvc-pending-timeout.png", caption: "Blocker: the test PVC never binds" },
      { src: "img/06-blocker-no-csi-driver-pods.png", caption: "Root-cause evidence: only the ceph-csi operator is running, no RBD ctrlplugin/nodeplugin" },
    ],
    blockers: [
      { t: "PVC Pending forever though Ceph was HEALTH_OK", d: "From Rook 1.18 the ceph-csi-operator only runs a driver when a `Driver` resource exists, and in 1.21 neither Rook chart creates one. It comes from a third chart, `ceph-csi-drivers`. Setting `ROOK_CREATE_CSI_OPERATOR_RESOURCES=true` did nothing (no code behind it in v1.21.2). Fix: install the chart with `rbd.snapshotPolicy: volumeSnapshot`. Lesson: 'operator healthy' isn't 'storage works'." },
    ],
  },
  {
    n: "7",
    key: "step-07",
    title: "CloudNativePG: 3 instances, quorum sync replication, S3 backups",
    what: "Operator 1.30.2; Cluster `pg-lab` with 3 instances on `ceph-block`, required zone anti-affinity, `synchronous: method any, number 1, dataDurability required`, and `barmanObjectStore` to S3 through the gateway endpoint with IRSA (no keys in the cluster).",
    result: ["1 primary + 2 quorum sync standbys, one per zone, lag 0", "WAL archiving OK — proves IRSA, STS endpoint, S3 gateway endpoint and bucket policy", "First base backup completed; PITR possible from 10:35:32Z"],
    shots: [{ src: "img/07-cnpg-healthy-sync-replicas-wal-archiving.png", caption: "`kubectl cnpg status`: healthy, 2 quorum standbys streaming, WAL archiving OK, base backup completed (registry host redacted)" }],
  },
  {
    n: "8",
    key: "step-08",
    title: "PgBouncer poolers (rw + ro)",
    what: "Two CNPG Poolers, 2 PgBouncer 1.26.1 pods each, transaction mode, `auth_query` via the operator-managed user (no passwords stored), headless services so HAProxy can check each pod.",
    result: ["rw → primary, ro → replicas, 2/2 pods each across zones", "`max_client_conn 1000`, `default_pool_size 20`, `query_wait_timeout 30`"],
    shots: [{ src: "img/08-pgbouncer-poolers-rw-ro.png", caption: "2+2 PgBouncer pods across zones, poolers active, ClusterIP and headless services" }],
  },
  {
    n: "9",
    key: "step-09",
    title: "HAProxy in TCP mode",
    what: "`:5432` → rw poolers, `:5433` → ro poolers. `server-template` slots filled from headless-service DNS (re-resolved every 5 s), TCP health checks `inter 1s fall 3 rise 2`, `retries 2` + `redispatch`. Timing values in a separate ConfigMap, validated with `haproxy -c` in an initContainer.",
    result: ["rw1/rw2 and ro1/ro2 UP (L4OK)", "Spare slots MAINT (resolution) fill automatically when poolers scale"],
    shots: [
      { src: "img/09-haproxy-stats-backends-up.png", caption: "HAProxy stats via port-forward: backends UP, spare slots MAINT, 19 sessions from the readiness probe" },
    ],
    blockers: [
      { t: "19 sessions with no clients", d: "The kubelet `tcpSocket` readiness probe on 5432 was proxied through to PgBouncer every 2 s, polluting the counters later tests read. Fix: probe the stats page." },
      { t: "Design debt: one HAProxy replica, no placement rules", d: "Found later in the T6 pre-flight sitting next to the primary. Fixed with 2 zone-spread replicas, a PDB and 30 s eviction tolerations." },
    ],
  },
  {
    n: "10",
    key: "step-10",
    title: "Load client and smoke test of all 6 paths",
    what: "A PostgreSQL pod with the test scripts (ConfigMap) and a Ceph PVC for logs, so evidence survives pod restarts. For each path, `select inet_server_addr(), pg_is_in_recovery()`.",
    result: ["pg-lab-rw, pooler-rw, haproxy:5432 → the primary", "pg-lab-ro, pooler-ro, haproxy:5433 → a replica", "Full chain HAProxy → PgBouncer → CNPG service → Postgres works for reads and writes"],
    blockers: [
      { t: "New scripts missing in the pod", d: "Mounted ConfigMaps sync on the kubelet's interval (~60–90 s); recreating the pod mounts the current version at once." },
    ],
  },
];
