# qr-frame-source.ts

## Purpose

The throttled RGBA capturer that feeds QR detection. A per-XR-frame tick that
performs the camera-texture blit + readback **only at the detection cadence**
(~8 Hz), not every render frame — the efficiency win behind plan option **B2**.

## Public API

- `class QrFrameSource`
  - `constructor(callbacks: QrFrameSourceCallbacks, config?: Partial<QrFrameSourceConfig>)`
  - `start()` / `stop()` / `isRunning(): boolean`
  - `onFrame(timestamp: number): void` — call once per XR frame; captures at most
    once per `intervalMs`.
  - `getFrameCount(): number` — successful captures since `start()`.
  - `getConfig()` / `updateConfig(partial)` — `intervalMs` only; invalid values ignored.
- `QrFrameSourceCallbacks`
  - `capture: () => RgbaImage | null` — the GPU blit → top-left RGBA (production:
    `CameraBlitCapture.captureToRgba`). `null` = no frame this tick.
  - `onCapture: (image: RgbaImage) => void` — receives throttled frames.
- `QrFrameSourceConfig` — `{ intervalMs }` (default 125 ms ≈ 8 Hz).

## Invariants & assumptions

- The throttle is driven by the **`timestamp` argument** (the XR `time`), not a
  wall clock, so tests are deterministic.
- A `null`/throwing `capture()` does **not** consume the interval slot — the next
  frame retries immediately (a missing camera texture is transient). `capture`
  throwing is swallowed (never escapes the frame loop).
- `start()` resets the cadence (`lastCaptureTime`) and the counter; the first
  tick after `start()` always captures.
- `capture` is injected (no hard dependency on `CameraBlitCapture` /
  `WebGLRenderer`) so the throttle is unit-testable without a GPU.

## Examples

```ts
const src = new QrFrameSource(
  {
    capture: () => blit.captureToRgba(renderer, texture),
    onCapture: offerToController,
  },
  { intervalMs: 125 }
);
src.start();
// in the XR frame loop:
src.onFrame(time);
```

## Tests

- `qr-frame-source.test.ts` — throttle math, the **performance regression** test
  (≈ 8 captures over ~1 s of 60 fps frames, not ~60), null-retry, throw-safety,
  stop/restart, and `updateConfig` validation.
