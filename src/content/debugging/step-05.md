# Step 05 (and 5b), Rook-Ceph: debugging

## Blockers hit

### B1. Only 2 OSDs instead of 3
- **Symptom:** the 05 script waited forever for 3 OSDs.
- **Diagnosis:**
  - `kubectl -n rook-ceph logs <osd-prepare pod>` reported "no available devices" on one node.
  - `lsblk` on that node (via a debug pod) showed the **root disk as `nvme1n1`** and the data disk as `nvme0n1`.
- **Root cause:** NVMe device names on Nitro instances aren't stable. The filter `^nvme1n1$` matched the root disk there.
- **Fix:** `deviceFilter: "^nvme[0-9]+n1$"`. Rook skips disks that have partitions, so the root disk is never used.
- **Evidence:** `results/step05-ceph.txt` (osd.2 on nvme0n1, the others on nvme1n1).

### B2. Never reaches HEALTH_OK
- **Symptom:** HEALTH_WARN `AUTH_INSECURE_CLIENT_KEY_TYPE`, `AUTH_INSECURE_KEYS_ALLOWED`, `AUTH_INSECURE_KEYS_CREATABLE`.
- **Root cause:** Ceph 20 warns about the `aes` cephx key type, which CSI uses on kernels < 7.0.
- **Fix:** `ceph health mute <code> --sticky` for those three codes (in the 05 script). It's expected, not a fault.

### B3. PVCs Pending forever (found at step 06)
- **Evidence:** `docs/screenshots/06-blocker-pvc-pending-timeout.png`, `06-blocker-no-csi-driver-pods.png`.
- **Symptom:** `Waiting for a volume to be created … by external provisioner 'rook-ceph.rbd.csi.ceph.com'`.
- **Diagnosis:**
  - `kubectl -n rook-ceph get pods | grep csi` showed only `ceph-csi-controller-manager`: no ctrlplugin, no nodeplugin.
  - `kubectl -n rook-ceph get drivers.csi.ceph.io,operatorconfigs.csi.ceph.io` returned nothing.
  - The Rook v1.21.2 source has no code creating Driver CRs.
  - The Rook docs (Helm-Charts/csi-drivers-chart.md) name a **third chart**.
- **Root cause:** in Rook 1.21 the Driver and OperatorConfig CRs come from `ceph-csi-operator/ceph-csi-drivers`, which our plan didn't include.
- **Fix:** step 5b installs `charts/ceph-csi-drivers-1.1.0.tgz` with Rook's values plus `rbd.snapshotPolicy: volumeSnapshot` (without it, no snapshotter sidecar).
- **Dead end, recorded:** setting `ROOK_CREATE_CSI_OPERATOR_RESOURCES=true` and restarting the operator did nothing (no code behind it). Reverted.
- **Lesson:** "operator healthy" isn't "storage works". Prove it with a real PVC and snapshot (step 06).
