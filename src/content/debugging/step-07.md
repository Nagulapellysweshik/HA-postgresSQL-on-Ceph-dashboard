# Step 07, CloudNativePG cluster: debugging

## Blockers hit
None. The step worked first time, and rerunning it was idempotent (`unchanged`). The preventive design choices are what made it work:
- the `-system-` image variant, because only it ships `barman-cloud`;
- the IRSA role trusting exactly SA `pg/pg-lab`;
- the **regional** S3 `endpointURL`, because the S3 gateway endpoint doesn't route the global name.
