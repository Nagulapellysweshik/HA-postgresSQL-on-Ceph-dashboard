// The lab's architecture: request path on top, three zones below, AWS services on the right.
export default function ArchDiagram() {
  const zones = [
    { x: 40, name: "ap-south-2a", pg: "pg-lab-2", role: "sync standby", osd: "osd.2", primary: false },
    { x: 290, name: "ap-south-2b", pg: "pg-lab-3", role: "sync standby", osd: "osd.0", primary: false },
    { x: 540, name: "ap-south-2c", pg: "pg-lab-1", role: "PRIMARY", osd: "osd.1", primary: true },
  ];
  return (
    <div className="diagram">
      <svg viewBox="0 0 1040 640" role="img" aria-label="Architecture: load client, HAProxy, PgBouncer, CloudNativePG across three zones on Rook-Ceph, with S3 and ECR through VPC endpoints">
        <defs>
          <marker id="ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" className="d-arrow" />
          </marker>
        </defs>

        {/* VPC boundary */}
        <rect x="16" y="16" width="790" height="608" rx="14" className="d-vpc" />
        <text x="32" y="38" className="d-m">PRIVATE VPC · NO NAT · NO IGW · NO PUBLIC IP · ALL SERVICES ClusterIP</text>

        {/* client */}
        <rect x="290" y="54" width="230" height="48" rx="9" className="d-box" />
        <text x="405" y="75" textAnchor="middle" className="d-t">Load client pod</text>
        <text x="405" y="92" textAnchor="middle" className="d-s">64 writers · 16 readers · payload.py</text>
        <path d="M405 102 V128" className="d-line" markerEnd="url(#ar)" />

        {/* haproxy */}
        <rect x="230" y="130" width="350" height="50" rx="9" className="d-proxy" />
        <text x="405" y="151" textAnchor="middle" className="d-t">HAProxy 3.4 · TCP · 2 replicas, zone-spread</text>
        <text x="405" y="168" textAnchor="middle" className="d-s">:5432 writes → rw poolers   |   :5433 reads → ro poolers</text>
        <path d="M330 180 V206" className="d-line" markerEnd="url(#ar)" />
        <path d="M480 180 V206" className="d-line" markerEnd="url(#ar)" />

        {/* poolers */}
        <rect x="200" y="208" width="200" height="50" rx="9" className="d-proxy" />
        <text x="300" y="229" textAnchor="middle" className="d-t">PgBouncer rw × 2</text>
        <text x="300" y="246" textAnchor="middle" className="d-s">transaction mode → pg-lab-rw</text>
        <rect x="410" y="208" width="200" height="50" rx="9" className="d-proxy" />
        <text x="510" y="229" textAnchor="middle" className="d-t">PgBouncer ro × 2</text>
        <text x="510" y="246" textAnchor="middle" className="d-s">→ pg-lab-ro (replicas)</text>

        {/* to db */}
        <path d="M300 258 C300 300, 640 290, 640 330" className="d-line" markerEnd="url(#ar)" />
        <path d="M510 258 C510 295, 140 290, 140 330" className="d-line" markerEnd="url(#ar)" />
        <path d="M510 258 C510 300, 390 290, 390 330" className="d-line" markerEnd="url(#ar)" />

        {zones.map((z) => (
          <g key={z.name}>
            <rect x={z.x} y="300" width="220" height="300" rx="10" className="d-zone" />
            <text x={z.x + 12} y="594" className="d-m">{z.name.toUpperCase()}</text>
            <rect x={z.x + 15} y="332" width="190" height="62" rx="9" className={z.primary ? "d-pgp" : "d-pg"} />
            <text x={z.x + 110} y="358" textAnchor="middle" className={z.primary ? "d-w" : "d-t"}>{z.pg}</text>
            <text x={z.x + 110} y="378" textAnchor="middle" className={z.primary ? "d-w" : "d-s"} style={z.primary ? { fontSize: 11.5, fontWeight: 600 } : undefined}>PostgreSQL 18 · {z.role}</text>
            <rect x={z.x + 15} y="420" width="190" height="56" rx="9" className="d-ceph" />
            <text x={z.x + 110} y="444" textAnchor="middle" className="d-t">Ceph {z.osd} + mon</text>
            <text x={z.x + 110} y="462" textAnchor="middle" className="d-s">50 GiB gp3 · RBD copy 1 of 3</text>
            <path d={`M${z.x + 110} 394 V418`} className="d-ceph-line" />
            <rect x={z.x + 15} y="500" width="190" height="80" rx="9" className="d-box" />
            <text x={z.x + 110} y="526" textAnchor="middle" className="d-t">EKS node m6i.xlarge</text>
            <text x={z.x + 110} y="544" textAnchor="middle" className="d-s">4 vCPU · 16 GiB · AL2023</text>
            <text x={z.x + 110} y="562" textAnchor="middle" className="d-s">private subnet</text>
          </g>
        ))}

        {/* sync replication */}
        <path d="M555 352 H470" className="d-sync" markerEnd="url(#ar)" />
        <path d="M580 394 C560 408, 160 408, 140 396" className="d-sync" markerEnd="url(#ar)" />
        <text x="390" y="417" textAnchor="middle" className="d-s" style={{ fill: "var(--accent)", fontSize: 11 }}>quorum sync WAL · ANY 1 · dataDurability required</text>

        {/* ceph replication */}
        <path d="M245 448 H305" className="d-ceph-line" />
        <path d="M495 448 H555" className="d-ceph-line" />
        <text x="390" y="492" textAnchor="middle" className="d-s" style={{ fill: "var(--ok)" }}>RBD size 3 · min_size 2 · failure domain zone</text>

        {/* AWS services */}
        <text x="830" y="70" className="d-m">AWS · SAME REGION</text>
        <rect x="830" y="84" width="190" height="70" rx="9" className="d-ext" />
        <text x="925" y="110" textAnchor="middle" className="d-t">S3 (private bucket)</text>
        <text x="925" y="128" textAnchor="middle" className="d-s">base backups + WAL archive</text>
        <text x="925" y="143" textAnchor="middle" className="d-s">via S3 gateway endpoint · IRSA</text>
        <rect x="830" y="172" width="190" height="62" rx="9" className="d-ext" />
        <text x="925" y="198" textAnchor="middle" className="d-t">Private ECR pg-lab/*</text>
        <text x="925" y="216" textAnchor="middle" className="d-s">16 mirrored images</text>
        <rect x="830" y="252" width="190" height="62" rx="9" className="d-ext" />
        <text x="925" y="278" textAnchor="middle" className="d-t">EKS control plane</text>
        <text x="925" y="296" textAnchor="middle" className="d-s">private endpoint · OIDC</text>
        <rect x="830" y="332" width="190" height="62" rx="9" className="d-ext" />
        <text x="925" y="358" textAnchor="middle" className="d-t">VPC endpoints</text>
        <text x="925" y="376" textAnchor="middle" className="d-s">ec2 · ecr.api/dkr · sts · s3</text>
        <path d="M760 362 C790 300, 790 150, 828 120" className="d-line" markerEnd="url(#ar)" strokeDasharray="4 3" />
        <text x="790" y="250" className="d-s" transform="rotate(-80 790 250)">WAL archive</text>

        <rect x="830" y="420" width="190" height="180" rx="9" className="d-box" />
        <text x="845" y="444" className="d-m">FAILURES INJECTED</text>
        {["pod kill -9 (T2, T4)", "planned switchover (T3)", "Ceph disk loss (T5)", "whole zone stopped (T6)", "1 000-client storm (T7)", "pooler pod deleted (T10)", "rolling upgrade (T11)", "fat-finger DELETE (T12)"].map((t, i) => (
          <text key={t} x="845" y={466 + i * 16.5} className="d-s">· {t}</text>
        ))}
      </svg>
    </div>
  );
}
