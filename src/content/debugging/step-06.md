# Step 06, storage check (PVC + snapshot): debugging

## Blockers hit

### B1. PVC Pending: missing CSI drivers chart
See [05 B3](05-rook-ceph.DEBUGGING.md).

### B2. Snapshot blocks PVC deletion
- **Symptom:** deleting the PVC first hangs.
- **Root cause:** a VolumeSnapshot adds the finalizer `snapshot.storage.kubernetes.io/pvc-as-source-protection` to its source PVC.
- **Fix:** delete the snapshot, then the PVC.
