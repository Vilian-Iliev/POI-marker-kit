# depth-occluder.ts

## Purpose

The **live CPU-depth occluder** — hides virtual fragments behind the real surface the camera sees _this frame_. It is the sharp, registration-free, no-memory half of the occlusion feature; its companion is the persistent [`OcclusionMesh`](../visualization/occlusion-mesh.ts.md) (out-of-view memory, blocky, lagging). Both are depth-only under `arWorldGroup` and **compose** at render time (live wins where this frame has depth, the mesh fills out-of-view / depth holes — [2026-06-14-webxr-depth-occlusion-plan.md](../../../../gps-plus-slam/GpsPlusSlamJs_Docs/docs/2026-06-14-webxr-depth-occlusion-plan.md) §5).

It is a **second consumer** of the same per-frame `XRCPUDepthInformation` the sparse [`DepthSampler`](depth-sampler.ts.md) already reads for the occupancy grid — no extra depth read, no second session.

## Two confidence levels (read this before changing anything)

- **Pure occlusion math** — fully CI-tested (plan §9). Deterministic, property-tested in `depth-occluder.property.test.ts`.
- **`DepthOccluder` class** — its CPU-observable behaviour (texture (re)creation, format selection, uniform updates, patch registration, dispose) is unit-tested in jsdom (`depth-occluder.test.ts`). **The actual GLSL occlusion is device-gated** (plan §8 Iter 2–3): no headless GL renders it, so `injectOcclusionGlsl` is a **first-light draft** to verify and tune on-device. Keep `occupancy.liveOcclusion` **OFF by default** until that verification lands.

## Public API

### Pure functions

- `metricDepthToWindowDepth(viewSpaceDepthMeters, projectionMatrix)` → `number` — view-space perpendicular depth (m) → window depth `[0,1]` via the WebXR `XRView.projectionMatrix` (column-major 16). Monotonic in depth; `0` at near, `1` at far. The conversion the shader needs to compare real vs. virtual depth (plan §3b).
- `screenUvToDepthUv(u, v, matrix)` → `[number, number]` — normalized screen UV → depth-buffer UV via `XRDepthInformation.normDepthBufferFromNormView.matrix` (column-major 16), with the perspective divide. Identity is a fixed point.
- `unpackLuminanceAlphaToMeters(lo, hi, rawValueToMeters)` → `number` — reconstruct metres from a 16-bit depth value packed across the `luminance` (low byte) + `alpha` (high byte) channels of an `RG8` texel.
- `selectDepthTextureFormat(width, height, byteLength)` → `'r32f' | 'luminance-alpha'` — pick the upload format from the resolved byte layout (4 bytes/texel → float32/R32F; 2 → packed). Read at runtime, not assumed (plan §3a).
- `occlusionStrength(realDepthMeters, fragmentDepthMeters, softMarginMeters)` → `number` in `[0,1]` — the soft-margin / holes policy (plan §3c). Holes (`real ≤ 0` / non-finite) ⇒ `0` (never occlude). Positive margin ⇒ a symmetric fade band centred on the surface; non-positive ⇒ a hard step. The **single source of truth** the GLSL mirrors.
- `injectOcclusionGlsl(fragmentShader)` → `string` — splice the occluder uniforms + decision into a fragment shader (device-gated draft).

### Class

- `new DepthOccluder({ softMarginMeters? })` — defaults `softMarginMeters` to `DEFAULT_SOFT_MARGIN_M` (0.05 m).
- `update(depthInfo: DepthInfo)` — upload this frame's depth + metadata. **No-op that DISABLES occlusion** when the frame lacks the occluder fields (`data` / `rawValueToMeters` / `normDepthBufferFromNormView` / `projectionMatrix`) — frame-level holes policy, so a degraded frame never occludes with stale/absent depth.
- `patch(material)` — `onBeforeCompile`-inject the occlusion decision; idempotent per material. Shared uniforms injected **by reference** so each `update` reaches every patched material. Per-object opt-out = don't patch it.
- `isEnabled()` / `getTextureFormat()` / `isPatched(material)` — inspection hooks.
- `dispose()` — release the depth texture, disable, forget patched materials. Idempotent; post-dispose `update` is a no-op.

## Invariants & assumptions

- Matrices are **column-major 16-tuples** (`Matrix4`), matching `DepthInfo.projectionMatrix` / `normDepthBufferFromNormView` from `wrapXRDepthInfo`.
- `occlusionStrength` and the GLSL agree on semantics: `delta = fragment − real`; `> 0` ⇒ fragment behind the real surface ⇒ occlude.
- The depth map is low-res (~160×120) so the per-frame `DataTexture` upload is a few tens of KB (plan §3a). Mono AR session (one `XRView`).
- Defensive: invalid/degraded frames disable rather than throw; non-finite real/fragment depth ⇒ no occlusion.

## Examples

```ts
const occ = new DepthOccluder({ softMarginMeters: 0.05 });
sceneObjects.forEach((o) => occ.patch(o.material));
// per frame, from the wrapped XRCPUDepthInformation:
registerXrFrameUpdate(() => occ.update(getDepthInfoFromFrame(frame, pose)));
// on session end:
registerSessionDisposer(() => occ.dispose());
```

## Tests

- `depth-occluder.property.test.ts` — property tests for all five pure functions (bounds, monotonicity, holes, round-trip, format selection, near/far endpoints).
- `depth-occluder.test.ts` — `DepthOccluder` lifecycle + the by-reference uniform injection + GLSL splice in jsdom.
- **On-device (device-gated, not in CI):** does a real surface hide a virtual object behind it; the `gl_FragDepth` metric sanity check; soft edges reduce shimmer; the `dataFormatPreference` default (float32 vs luminance-alpha); per-frame perf; the §5 compose with the persistent mesh. See [2026-06-14-webxr-depth-occlusion-plan.md](../../../../gps-plus-slam/GpsPlusSlamJs_Docs/docs/2026-06-14-webxr-depth-occlusion-plan.md) §8.

## Related

- [depth-sampler.ts.md](depth-sampler.ts.md) — `DepthInfo` / `wrapXRDepthInfo` (the shared per-frame source).
- [webxr-session.ts.md](webxr-session.ts.md) — the `requestDepthOcclusion` session flag that negotiates `cpu-optimized` depth for this occluder.
- [occlusion-mesh.ts.md](../visualization/occlusion-mesh.ts.md) — the persistent companion occluder.
- [recording-options.ts.md](../state/recording-options.ts.md) — the `occupancy.liveOcclusion` toggle.
