# Step 02, mirror images to ECR: debugging

## Blockers hit

### B1. Images that aren't in any chart value
- **Symptom (expected in a no-internet cluster):** chart values leave many images empty, meaning "use the operator's built-in default", and those defaults point at quay.io / registry.k8s.io / ghcr.io. Without them, pods would sit in `ImagePullBackOff` with no egress.
- **Diagnosis:** extract the operator binaries from their images and search for image references:
  ```bash
  crane export <operator-image> - | tar -x -O <path/to/binary> | strings | grep -E '(quay|registry.k8s|ghcr)\.io/.+:v?[0-9]'
  ```
- **Found:**
  - ceph-csi-operator v1.1.0 defaults: cephcsi v3.18.1, registrar v2.18.0, provisioner v6.3.0, snapshotter v8.6.0, attacher v4.13.0, resizer v2.2.1, snapshot-metadata v1.1.0, csiaddons sidecar v0.15.1.
  - CNPG defaults: postgresql 18.7-system-trixie, pgbouncer 1.26.1.
- **Fix:** all 16 images mirrored (`images.txt` → `image-map.txt`), every one pinned explicitly in values (`values/rook-ceph.yaml` `csi.*`, `values/cloudnative-pg.yaml` `config.data`).
- **Lesson:** for air-gapped installs, read the binary, not just `values.yaml`.
