import ArchDiagram from "./ArchDiagram.jsx";
import { Md, Table, SectionHead, Callout } from "./components.jsx";
import { CodeBlock } from "./viewers.jsx";

/* A horizontal chain of boxes with arrows; wraps to vertical on narrow screens. */
function Flow({ steps, note }) {
  return (
    <div className="flow-wrap">
      <div className="flow">
        {steps.map((s, i) => (
          <div key={i} className="flow-item">
            <div className={`flow-box ${s.tone || ""}`}>
              {s.tag && <div className="flow-tag">{s.tag}</div>}
              <div className="flow-title"><Md>{s.title}</Md></div>
              {s.sub && <div className="flow-sub"><Md>{s.sub}</Md></div>}
            </div>
            {i < steps.length - 1 && <div className="flow-arrow"><span><Md>{s.edge || ""}</Md></span></div>}
          </div>
        ))}
      </div>
      {note && <p className="muted small flow-note"><Md>{note}</Md></p>}
    </div>
  );
}

function NetDiagram() {
  // Private VPC with the endpoints that replace internet access.
  const ep = [
    ["ecr.api", "image auth + manifests API", 246],
    ["ecr.dkr", "registry (docker pull)", 290],
    ["sts", "IRSA: AssumeRoleWithWebIdentity", 334],
    ["ec2", "node bootstrap, CSI", 378],
  ];
  return (
    <div className="diagram">
      <svg viewBox="0 0 1040 470" role="img" aria-label="Network: private subnets in three zones reach ECR, STS and EC2 through interface endpoints and S3 through a gateway endpoint; no NAT or internet gateway">
        <defs>
          <marker id="ar2" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" className="d-arrow" /></marker>
        </defs>
        {/* laptop */}
        <rect x="20" y="40" width="190" height="78" rx="9" className="d-box" />
        <text x="115" y="66" textAnchor="middle" className="d-t">Admin workstation</text>
        <text x="115" y="85" textAnchor="middle" className="d-s">kubectl · helm · eksctl · crane</text>
        <text x="115" y="102" textAnchor="middle" className="d-s">from an allow-listed IP</text>
        <path d="M210 79 H300" className="d-line" markerEnd="url(#ar2)" />
        <text x="255" y="70" textAnchor="middle" className="d-s">HTTPS</text>
        <rect x="302" y="40" width="200" height="78" rx="9" className="d-ext" />
        <text x="402" y="66" textAnchor="middle" className="d-t">EKS API endpoint</text>
        <text x="402" y="85" textAnchor="middle" className="d-s">private access for nodes</text>
        <text x="402" y="102" textAnchor="middle" className="d-s">public only for allow-listed /32s</text>

        <rect x="20" y="146" width="640" height="66" rx="9" className="d-box" />
        <text x="36" y="172" className="d-t">Images: public registries → private ECR, copied by crane on the laptop</text>
        <text x="36" y="192" className="d-s">quay.io · docker.io · ghcr.io · registry.k8s.io → 16 repos pg-lab/* — the nodes never talk to the internet</text>
        {/* VPC */}
        <rect x="20" y="240" width="700" height="215" rx="12" className="d-vpc" />
        <text x="36" y="262" className="d-m">VPC 10.90.0.0/16 · PRIVATE SUBNETS ONLY · NO NAT · NO IGW · NO EIP</text>
        {["2a", "2b", "2c"].map((z, i) => (
          <g key={z}>
            <rect x={40 + i * 225} y="278" width="205" height="160" rx="10" className="d-zone" />
            <text x={52 + i * 225} y="298" className="d-m">PRIVATE SUBNET {z.toUpperCase()}</text>
            <rect x={55 + i * 225} y="310" width="175" height="46" rx="8" className="d-box" />
            <text x={142 + i * 225} y="331" textAnchor="middle" className="d-t">EKS node</text>
            <text x={142 + i * 225} y="347" textAnchor="middle" className="d-s">kubelet · Postgres · Ceph</text>
            <rect x={55 + i * 225} y="368" width="175" height="54" rx="8" className="d-proxy" />
            <text x={142 + i * 225} y="389" textAnchor="middle" className="d-t">endpoint ENIs</text>
            <text x={142 + i * 225} y="407" textAnchor="middle" className="d-s">one per interface endpoint</text>
          </g>
        ))}

        {/* ECR + S3 + STS on the right */}
        <text x="760" y="236" className="d-m">AWS SERVICES · ap-south-2</text>
        {ep.map(([n, d, y]) => (
          <g key={n}>
            <rect x="760" y={y} width="260" height="38" rx="8" className="d-ext" />
            <text x="772" y={y + 16} className="d-t" style={{ fontSize: 12.5 }}>{`Interface endpoint: ${n}`}</text>
            <text x="772" y={y + 31} className="d-s" style={{ fontSize: 11 }}>{d}</text>
            <path d={`M720 ${y + 19} H758`} className="d-line" markerEnd="url(#ar2)" />
          </g>
        ))}
        <rect x="760" y="422" width="260" height="38" rx="8" className="d-ceph" />
        <text x="772" y="438" className="d-t" style={{ fontSize: 12.5 }}>Gateway endpoint: s3</text>
        <text x="772" y="453" className="d-s" style={{ fontSize: 11 }}>ECR layers + backups · route-table entry</text>
        <path d="M720 441 H758" className="d-line" markerEnd="url(#ar2)" />
      </svg>
    </div>
  );
}

const HAPROXY_CFG = `resolvers k8s
  parse-resolv-conf          # CoreDNS from the pod's resolv.conf
  hold valid 5s              # re-resolve the headless Service every 5 s

frontend pg_rw
  bind :5432
  default_backend poolers_rw
frontend pg_ro
  bind :5433
  default_backend poolers_ro

backend poolers_rw
  balance leastconn          # long-lived connections -> least busy pooler
  default-server inter 1s fall 3 rise 2 on-marked-down shutdown-sessions
  server-template rw 4 pg-lab-pooler-rw-hl.pg.svc.cluster.local:5432 check resolvers k8s init-addr none

defaults
  mode tcp
  retries 2
  option redispatch          # a failed connect is retried on another pooler`;

const BACKUP_YAML = `# manifests/20-cnpg-cluster.yaml
serviceAccountTemplate:
  metadata:
    annotations:
      eks.amazonaws.com/role-arn: arn:aws:iam::__ACCOUNT__:role/pg-lab-backup
backup:
  retentionPolicy: "7d"
  barmanObjectStore:
    destinationPath: s3://__BUCKET__/pg-lab
    # regional name: the S3 gateway endpoint never routes s3.amazonaws.com
    endpointURL: https://s3.ap-south-2.amazonaws.com
    s3Credentials:
      inheritFromIAMRole: true
    wal:  {compression: gzip, maxParallel: 4}
    data: {compression: gzip}`;

const IRSA_YAML = `# cluster.yaml (eksctl)
iam:
  withOIDC: true
  serviceAccounts:
    - metadata: {name: pg-lab, namespace: pg}   # CNPG names the SA after the Cluster
      roleName: pg-lab-backup
      roleOnly: true
      attachPolicy:
        Statement:
          - {Effect: Allow, Action: [s3:ListBucket, s3:GetBucketLocation], Resource: "arn:aws:s3:::<s3_bucket_name>"}
          - {Effect: Allow, Action: [s3:GetObject, s3:PutObject, s3:DeleteObject], Resource: "arn:aws:s3:::<s3_bucket_name>/*"}`;

const POOLER_YAML = `# manifests/30-pooler-rw.yaml
spec:
  cluster: {name: pg-lab}
  instances: 2
  type: rw                       # -> pg-lab-rw (primary)
  pgbouncer:
    poolMode: transaction
    parameters:
      max_client_conn: "1000"
      default_pool_size: "20"    # T8: 32 is this cluster's sweet spot
      reserve_pool_size: "5"
      query_wait_timeout: "30"
      server_login_retry: "1"    # T3: default 15 s turned an 8 s switchover into 30 s`;

const SECTIONS = [
  ["overview", "Whole system"],
  ["network", "Private network"],
  ["ecr", "Private ECR"],
  ["s3", "Backups to S3"],
  ["proxy", "HAProxy & PgBouncer"],
  ["data", "Database & storage"],
  ["components", "Components"],
];

export default function ArchPage() {
  return (
    <section>
      <div className="wrap">
        <SectionHead kicker="Architecture" title="A zero-data-loss PostgreSQL platform with no internet path" sub="One PostgreSQL instance and one Ceph disk per availability zone, a pooled and health-checked entry point, continuous backups to S3, and every dependency reached privately." />
        <div className="toc">{SECTIONS.map(([id, l]) => <a key={id} href="#/" onClick={(e) => { e.preventDefault(); document.getElementById(id)?.scrollIntoView({ behavior: "smooth" }); }}>{l}</a>)}</div>

        {/* 1 */}
        <div id="overview" className="arch-sec">
          <h3>1 · The whole system</h3>
          <ArchDiagram />
          <div className="grid g3" style={{ marginTop: 14 }}>
            <div className="card"><h4>Request path</h4><p className="small muted"><Md>{"App → HAProxy `:5432`/`:5433` → PgBouncer rw/ro → CNPG Service `pg-lab-rw`/`pg-lab-ro` → PostgreSQL → Ceph RBD."}</Md></p></div>
            <div className="card"><h4>Failure domain</h4><p className="small muted">Each zone holds one Postgres instance, one Ceph OSD and one Ceph mon. Losing a zone leaves a sync standby, 2 of 3 data copies and mon quorum.</p></div>
            <div className="card"><h4>Trust boundary</h4><p className="small muted">Private subnets, ClusterIP services only, images from private ECR, AWS APIs through VPC endpoints, S3 via IRSA. Nothing listens on the internet.</p></div>
          </div>
        </div>

        {/* 2 */}
        <div id="network" className="arch-sec">
          <h3>2 · Private network: how a cluster with no internet still works</h3>
          <p className="muted">eksctl's private-cluster mode builds its own VPC with private subnets only, and no NAT gateway, internet gateway or Elastic IP. Everything a node needs from AWS comes through <b>VPC endpoints</b> instead.</p>
          <NetDiagram />
          <div className="grid g2" style={{ marginTop: 14 }}>
            <div className="card">
              <h4>Interface vs gateway endpoints</h4>
              <ul className="small tight muted">
                <li><b>Interface endpoints</b> (<code>ecr.api</code>, <code>ecr.dkr</code>, <code>sts</code>, <code>ec2</code>) put an ENI with a private IP in each subnet; private DNS makes the normal AWS hostnames resolve to them.</li>
                <li><b>The S3 gateway endpoint</b> is a route-table entry, not an ENI. It only routes buckets <i>in the same region</i> and only the <i>regional</i> hostname — which is why the region choice and <code>endpointURL</code> matter.</li>
                <li>The cluster security group allows traffic only between cluster members. No inbound rule was ever added by hand.</li>
              </ul>
            </div>
            <div className="card">
              <h4>How the API is reached</h4>
              <ul className="small tight muted">
                <li><b>Nodes</b> reach the Kubernetes API through the endpoint's <b>private access</b>, inside the VPC.</li>
                <li><b>Administration</b> (kubectl, helm) runs from a workstation; the endpoint's public access is limited to an allow-list of single /32 addresses. No bastion, no open CIDR.</li>
                <li>Gotcha found: eksctl creates a "private" cluster with the public endpoint open to 0.0.0.0/0 for the ~20 min of creation, closing it as its last step.</li>
              </ul>
            </div>
          </div>
        </div>

        {/* 3 */}
        <div id="ecr" className="arch-sec">
          <h3>3 · Private ECR: getting 16 images into a cluster that can't pull from the internet</h3>
          <Flow steps={[
            { tag: "find", title: "Pin chart versions", sub: "`helm template … | grep image:` shows only 4 images", edge: "" },
            { tag: "find", title: "Read operator binaries", sub: "`strings` on ceph-csi-operator and CNPG: 8 CSI images + PostgreSQL / PgBouncer defaults" },
            { tag: "copy", title: "crane copy → ECR", sub: "`mirror-images-to-ecr.sh`: all platforms, repos `pg-lab/*`, tagged `project=pg-lab`", tone: "ext" },
            { tag: "render", title: "stage.sh", sub: "replaces `__ECR__` in values + manifests; apply only from `build/`" },
            { tag: "pull", title: "Node pulls privately", sub: "auth via `ecr.api`, manifests via `ecr.dkr`, **layers from S3** via the gateway endpoint", tone: "ok" },
          ]} note="ECR stores image layers in S3, so private pulls need the S3 gateway endpoint as well as the two ECR interface endpoints. PostgreSQL uses the `-system-` image variant because only it ships `barman-cloud-*` for backups. Result: zero `ImagePullBackOff` across the whole lab." />
        </div>

        {/* 4 */}
        <div id="s3" className="arch-sec">
          <h3>4 · Backups to S3: no keys anywhere</h3>
          <p className="muted">CloudNativePG archives every WAL segment and takes base backups with <code>barman-cloud</code> running inside the Postgres pods. Authentication is IRSA: the pod exchanges its Kubernetes identity for short-lived AWS credentials, so no access key exists in the cluster.</p>
          <Flow steps={[
            { tag: "pod", title: "Postgres pod", sub: "SA `pg/pg-lab`, annotated with the IAM role ARN", tone: "pg" },
            { tag: "token", title: "Projected SA token", sub: "signed by the cluster's OIDC issuer" },
            { tag: "sts", title: "AssumeRoleWithWebIdentity", sub: "via the `sts` interface endpoint → temporary credentials", tone: "ext" },
            { tag: "network", title: "Regional S3 endpoint", sub: "`s3.ap-south-2.amazonaws.com`, routed by the S3 **gateway** endpoint" },
            { tag: "bucket", title: "Private bucket", sub: "Block Public Access, SSE, role limited to this bucket", tone: "ok" },
          ]} />
          <div className="grid g2">
            <div><h4>CNPG backup config</h4><CodeBlock text={BACKUP_YAML} lang="yaml" /></div>
            <div><h4>IRSA role (eksctl)</h4><CodeBlock text={IRSA_YAML} lang="yaml" /></div>
          </div>
          <div className="grid g3" style={{ marginTop: 12 }}>
            <div className="card"><h4>What gets stored</h4><p className="small muted">Every WAL segment (gzip, 4 in parallel), a daily base backup plus on-demand ones, 7-day retention. "Working WAL archiving: OK" right after setup proved the whole chain.</p></div>
            <div className="card"><h4>Restore = a new cluster</h4><p className="small muted"><Md>{"PITR bootstraps `pg-lab-restore` from base backup + WAL to a timestamp. It runs as a **different** service account, so the role's trust policy needed a second subject (`install/11-pitr-irsa-trust.sh`) — found by testing the restore, not the backup."}</Md></p></div>
            <div className="card"><h4>Measured</h4><p className="small muted"><Md>{"Base backup under 1 500 tx/s: ~12 min. Restore after a fat-finger DELETE: **97 s**, to 6 ms before the target, books balanced. [See T12](#/tests/t12-pitr)."}</Md></p></div>
          </div>
        </div>

        {/* 5 */}
        <div id="proxy" className="arch-sec">
          <h3>5 · HAProxy and PgBouncer: one entry point, few server connections</h3>
          <Flow steps={[
            { tag: "client", title: "App connects to `haproxy:5432`", sub: "or `:5433` for reads" },
            { tag: "L4", title: "HAProxy (TCP)", sub: "2 replicas in different zones; picks the least-busy healthy pooler", tone: "proxy" },
            { tag: "pool", title: "PgBouncer (transaction mode)", sub: "1 000 client connections → 20–32 server connections per pod", tone: "proxy" },
            { tag: "svc", title: "CNPG Service", sub: "`pg-lab-rw` follows the primary label after a failover" },
            { tag: "db", title: "PostgreSQL", sub: "`max_connections` 100", tone: "pg" },
          ]} />
          <div className="grid g2">
            <div>
              <h4>HAProxy config (essentials)</h4>
              <CodeBlock text={HAPROXY_CFG} lang="ini" />
            </div>
            <div>
              <h4>How it behaves</h4>
              <ul className="small tight muted">
                <li><b>Discovery without reloads:</b> <code>server-template</code> reserves 4 slots per side and fills them from the poolers' headless Service every 5 s. Spare slots show <code>MAINT (resolution)</code>.</li>
                <li><b>Health checks:</b> TCP every 1 s, DOWN after 3 failures; sessions on a DOWN server are cut so clients reconnect at once. T10 measured ~4 s detection — and that Kubernetes DNS removal often beats slow checks.</li>
                <li><b>Retries:</b> <code>retries 2</code> + <code>redispatch</code> send a failed connect to the other pooler: deleting a PgBouncer pod cost clients ≤ 0.31 s.</li>
                <li><b>Readiness probe on the stats page,</b> not on 5432 — a TCP probe was being proxied through to PgBouncer every 2 s (19 phantom sessions).</li>
                <li><b>2 zone-spread replicas, a PDB and 30 s eviction tolerations</b> after the T6 pre-flight found the only replica on the primary's node.</li>
                <li>Stats page is ClusterIP, opened only with <code>kubectl port-forward</code>.</li>
              </ul>
              <h4>PgBouncer (CNPG Pooler)</h4>
              <CodeBlock text={POOLER_YAML} lang="yaml" />
            </div>
          </div>
          <Callout tone="warn" title="Why the middle tier mattered most">
            <p><Md>{"With defaults, PgBouncer turned a 7.6 s database switchover into a **30 s** client outage (two cached 15 s `server_login_retry` windows). With `server_login_retry: 1` it was **8 s**. [Read the case study](#/case-study)."}</Md></p>
          </Callout>
        </div>

        {/* 6 */}
        <div id="data" className="arch-sec">
          <h3>6 · Database and storage layers</h3>
          <div className="grid g2">
            <div className="card">
              <h4>CloudNativePG</h4>
              <ul className="small tight muted">
                <li>3 instances, <b>required</b> zone anti-affinity: one per AZ.</li>
                <li><code>synchronous: method any, number 1, dataDurability required</code> — a commit returns only when a standby in another zone has flushed it. RPO = 0, measured in T2/T6/T11.</li>
                <li>Failover guarded by a Kubernetes <b>Lease</b> (15 s): a crashed primary can't release it, so ~16 s of every ~24 s unplanned failover is the split-brain guard.</li>
                <li>Cordoning the primary's node triggers a proactive switchover (~8 s, clean lease hand-off).</li>
              </ul>
            </div>
            <div className="card">
              <h4>Rook-Ceph</h4>
              <ul className="small tight muted">
                <li>3 mons (quorum survives a zone), 3 OSDs on blank 50 GiB gp3 disks, one per zone.</li>
                <li>RBD pool <code>size 3</code>, <code>min_size 2</code>, CRUSH failure domain <code>zone</code>: writes continue on 2 copies.</li>
                <li>CSI via <code>ceph-csi-operator</code> + the separate <code>ceph-csi-drivers</code> chart (Rook 1.21), with VolumeSnapshots.</li>
                <li>With one OSD per zone Ceph can't re-replicate while a zone is down; production needs ≥ 2 OSDs per zone.</li>
              </ul>
            </div>
          </div>
        </div>

        {/* 7 */}
        <div id="components" className="arch-sec">
          <h3>7 · Components and versions</h3>
          <Table head={["Layer", "Component", "Role in the lab"]} rows={[
            ["Compute", "EKS managed node group, 3 × m6i.xlarge (4 vCPU, 16 GiB), AL2023", "The three failure domains"],
            ["Kubernetes", "Amazon EKS 1.37, private-cluster mode, access entries", "Managed control plane"],
            ["Images", "Private ECR `pg-lab/*` (16 repos)", "Every image pulled without internet"],
            ["Storage", "Rook 1.21.2 / Ceph 20.2.4, RBD", "Replicated block storage, snapshots"],
            ["Database", "CloudNativePG 1.30.2, PostgreSQL 18.6 → 18.7 (`-system-`)", "Failover, quorum sync replication, backups"],
            ["Pooling", "PgBouncer 1.26.1 (CNPG Pooler), rw + ro", "Transaction pooling"],
            ["Load balancing", "HAProxy 3.4.8, TCP", "Health-checked entry point"],
            ["Backup", "barman-cloud → S3, IRSA", "WAL archive, base backups, PITR"],
            ["Load", "`payload.py` (psycopg), `analyze_payload.py`", "Payment workload + invariants"],
          ]} />
          <p className="muted small">The manifests, Helm values and scripts are on <a href="https://github.com/Nagulapellysweshik/HA-postgresSQL-on-Ceph" target="_blank" rel="noreferrer">GitHub</a>.</p>
        </div>
      </div>
    </section>
  );
}
