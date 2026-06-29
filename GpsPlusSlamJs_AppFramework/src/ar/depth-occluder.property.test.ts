/**
 * Live depth occluder — property-based tests for the pure occlusion math.
 *
 * Why this test matters (plan 2026-06-14 §9): the occlusion decision is finally
 * *ours* (CPU-fed custom occluder), so its math must hold for ANY input, not just
 * hand-picked cases. The on-device GLSL mirrors these functions, so pinning their
 * invariants here is what lets us trust the shader once it is verified on a device.
 * These are exact, oracle-able properties — no real recording needed.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import * as THREE from 'three';
import {
  metricDepthToWindowDepth,
  screenUvToDepthUv,
  unpackLuminanceAlphaToMeters,
  selectDepthTextureFormat,
  occlusionStrength,
} from './depth-occluder.js';

/** A real WebXR-style column-major perspective projection matrix. */
function perspectiveElements(near: number, far: number): number[] {
  return new THREE.PerspectiveCamera(60, 1.5, near, far).projectionMatrix
    .elements;
}

describe('metricDepthToWindowDepth (property)', () => {
  it('maps [near, far] into [0, 1], monotonically increasing in depth', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.05, max: 0.5, noNaN: true }), // near
        fc.double({ min: 2, max: 50, noNaN: true }), // far
        fc.double({ min: 0, max: 1, noNaN: true }), // t1
        fc.double({ min: 0, max: 1, noNaN: true }), // t2
        (near, far, t1, t2) => {
          const P = perspectiveElements(near, far);
          // Order the two depths so monotonicity is an unconditional assertion.
          const dLo = near + Math.min(t1, t2) * (far - near);
          const dHi = near + Math.max(t1, t2) * (far - near);
          const wLo = metricDepthToWindowDepth(dLo, P);
          const wHi = metricDepthToWindowDepth(dHi, P);
          // Bounded (small epsilon for float round-off at the [near, far] ends).
          expect(wLo).toBeGreaterThanOrEqual(-1e-6);
          expect(wHi).toBeLessThanOrEqual(1 + 1e-6);
          // Monotonic: nearer depth ⇒ smaller window depth.
          expect(wLo).toBeLessThanOrEqual(wHi + 1e-9);
        }
      )
    );
  });

  it('lands at 0 at the near plane and 1 at the far plane', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.05, max: 0.5, noNaN: true }),
        fc.double({ min: 2, max: 50, noNaN: true }),
        (near, far) => {
          const P = perspectiveElements(near, far);
          expect(metricDepthToWindowDepth(near, P)).toBeCloseTo(0, 4);
          expect(metricDepthToWindowDepth(far, P)).toBeCloseTo(1, 4);
        }
      )
    );
  });
});

describe('screenUvToDepthUv (property)', () => {
  it('the identity matrix is a fixed point', () => {
    const I = new THREE.Matrix4().identity().elements;
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        (u, v) => {
          const [du, dv] = screenUvToDepthUv(u, v, I);
          expect(du).toBeCloseTo(u, 10);
          expect(dv).toBeCloseTo(v, 10);
        }
      )
    );
  });

  it('matches a known scale + translate transform', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.double({ min: 0.1, max: 4, noNaN: true }), // sx
        fc.double({ min: 0.1, max: 4, noNaN: true }), // sy
        fc.double({ min: -1, max: 1, noNaN: true }), // tx
        fc.double({ min: -1, max: 1, noNaN: true }), // ty
        (u, v, sx, sy, tx, ty) => {
          const M = new THREE.Matrix4()
            .makeScale(sx, sy, 1)
            .setPosition(tx, ty, 0).elements;
          const [du, dv] = screenUvToDepthUv(u, v, M);
          expect(du).toBeCloseTo(sx * u + tx, 8);
          expect(dv).toBeCloseTo(sy * v + ty, 8);
        }
      )
    );
  });
});

describe('unpackLuminanceAlphaToMeters (property)', () => {
  it('round-trips a 16-bit raw value × scale', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 65535 }),
        fc.double({ min: 1e-5, max: 1e-2, noNaN: true }),
        (raw, scale) => {
          const lo = raw & 0xff;
          const hi = (raw >> 8) & 0xff;
          expect(unpackLuminanceAlphaToMeters(lo, hi, scale)).toBeCloseTo(
            raw * scale,
            9
          );
        }
      )
    );
  });
});

describe('selectDepthTextureFormat (property)', () => {
  it('4 bytes/texel ⇒ r32f, 2 bytes/texel ⇒ luminance-alpha', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 512 }),
        fc.integer({ min: 1, max: 512 }),
        (w, h) => {
          expect(selectDepthTextureFormat(w, h, w * h * 4)).toBe('r32f');
          expect(selectDepthTextureFormat(w, h, w * h * 2)).toBe(
            'luminance-alpha'
          );
        }
      )
    );
  });
});

describe('occlusionStrength (property)', () => {
  it('is always bounded to [0, 1]', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -10, max: 10, noNaN: true }),
        fc.double({ min: -10, max: 10, noNaN: true }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        (real, frag, margin) => {
          const s = occlusionStrength(real, frag, margin);
          expect(s).toBeGreaterThanOrEqual(0);
          expect(s).toBeLessThanOrEqual(1);
        }
      )
    );
  });

  it('never occludes on holes / invalid real depth', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(0, -1, -100, NaN, Infinity, -Infinity),
        fc.double({ min: -10, max: 10, noNaN: true }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        (real, frag, margin) => {
          expect(occlusionStrength(real, frag, margin)).toBe(0);
        }
      )
    );
  });

  it('is monotonic non-decreasing in fragment depth (positive margin)', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.1, max: 10, noNaN: true }), // real (valid)
        fc.double({ min: -5, max: 5, noNaN: true }),
        fc.double({ min: -5, max: 5, noNaN: true }),
        fc.double({ min: 0.001, max: 1, noNaN: true }), // margin > 0
        (real, fragA, fragB, margin) => {
          const lo = Math.min(fragA, fragB);
          const hi = Math.max(fragA, fragB);
          expect(occlusionStrength(real, lo, margin)).toBeLessThanOrEqual(
            occlusionStrength(real, hi, margin) + 1e-12
          );
        }
      )
    );
  });

  it('fully hides well behind, fully shows well in front', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.1, max: 10, noNaN: true }),
        fc.double({ min: 0.01, max: 0.2, noNaN: true }),
        (real, margin) => {
          // Far behind the surface (> margin) ⇒ fully occluded.
          expect(occlusionStrength(real, real + 10 * margin, margin)).toBe(1);
          // Far in front of the surface (< -margin) ⇒ fully visible.
          expect(occlusionStrength(real, real - 10 * margin, margin)).toBe(0);
        }
      )
    );
  });

  it('degrades to a hard step when the margin is non-positive', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.1, max: 10, noNaN: true }),
        fc.double({ min: -5, max: 5, noNaN: true }),
        fc.constantFrom(0, -0.1, -1),
        (real, frag, margin) => {
          const expected = frag - real > 0 ? 1 : 0;
          expect(occlusionStrength(real, frag, margin)).toBe(expected);
        }
      )
    );
  });
});
