#!/usr/bin/env bash
set -euo pipefail
container_name="${ATLAS_CONTAINER:-podman-in-docker}"
runtime_image="docker.io/library/node@sha256:e9f565d32859f0cbfb52125eafe8be39390f24dac302dc3cdf566e8ba3ab21ee"
docker exec "$container_name" sh -c 'mkdir -p /workspace/verification/run-a /workspace/verification/run-b && chown 1002:1002 /workspace/verification/run-a /workspace/verification/run-b'
for run_name in run-a run-b; do
  timeout --signal=INT --kill-after=10s 120s docker exec "$container_name" podman run --rm \
    --network none --read-only --cap-drop ALL --security-opt no-new-privileges \
    --memory 1g --cpus 1 --pids-limit 64 --user 1002:1002 \
    -v /workspace:/bot:ro -v /kit/input:/input:ro \
    -v "/workspace/verification/$run_name:/output" -w /bot "$runtime_image" node main.ts
done
docker exec "$container_name" node scripts/compare-runs.mjs
docker exec "$container_name" node --test --test-concurrency=1 test/model.test.mjs test/output.test.mjs
