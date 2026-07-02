/**
 * OcclusionMesh debug styles — property-based tests.
 *
 * Why this test matters:
 * `setDebugStyle` composes additive debug skins (shaded matcap / depth-shaded,
 * wireframe) over the invisible depth-only occluder, and the skins must stay
 * consistent through ANY interleaving of style switches and geometry lifecycle
 * calls (`update`, `applyMeshData`, `clear`) — not just the fixed orders the
 * unit tests exercise. For every random operation sequence these invariants
 * must hold after every step (2026-07-02 debug-viz-styles plan):
 *  1. the depth-only occluder mesh is untouched (colorWrite:false,
 *     depthWrite:true, renderOrder < 0) — occlusion never depends on the style;
 *  2. exactly the skins the current style implies exist (shaded / wireframe);
 *  3. every present skin SHARES the occluder's geometry object (never a copy);
 *  4. matcap-based styles imply vertex normals on the current geometry;
 *  5. a pure-'wireframe' or 'off' style never triggers normal computation on a
 *     fresh remesh (the cheap path stays cheap).
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import * as THREE from 'three';
import type { GridCell } from '../ar/bresenham3d';
import { meshOccupiedCells } from '../ar/occupancy-mesher';
import type { OccluderDebugStyle } from '../state/recording-options';
import { OcclusionMesh } from './occlusion-mesh';

const CELL_SIZE = 0.15;

const STYLES = [
  'off',
  'matcap',
  'depth-shaded',
  'wireframe',
  'depth-shaded-wireframe',
] as const;

const MATCAP_BASED: readonly OccluderDebugStyle[] = [
  'matcap',
  'depth-shaded',
  'depth-shaded-wireframe',
];

type Op =
  | { kind: 'setStyle'; style: OccluderDebugStyle }
  | { kind: 'update'; cells: GridCell[] }
  | { kind: 'applyMeshData'; cells: GridCell[] }
  | { kind: 'clear' };

const cellArb = fc.tuple(
  fc.integer({ min: -2, max: 2 }),
  fc.integer({ min: -2, max: 2 }),
  fc.integer({ min: -2, max: 2 })
) as fc.Arbitrary<GridCell>;

const opArb: fc.Arbitrary<Op> = fc.oneof(
  fc.constantFrom(...STYLES).map((style): Op => ({ kind: 'setStyle', style })),
  fc
    .array(cellArb, { minLength: 0, maxLength: 8 })
    .map((cells): Op => ({ kind: 'update', cells })),
  fc
    .array(cellArb, { minLength: 0, maxLength: 8 })
    .map((cells): Op => ({ kind: 'applyMeshData', cells })),
  fc.constant<Op>({ kind: 'clear' })
);

function meshes(parent: THREE.Object3D): THREE.Mesh[] {
  return parent.children.filter((c) => c instanceof THREE.Mesh) as THREE.Mesh[];
}

function byName(parent: THREE.Object3D, name: string): THREE.Mesh | undefined {
  return meshes(parent).find((m) => m.name === name);
}

describe('OcclusionMesh.setDebugStyle — properties', () => {
  it('holds the skin/occluder invariants across any op sequence', () => {
    fc.assert(
      fc.property(fc.array(opArb, { minLength: 1, maxLength: 15 }), (ops) => {
        const parent = new THREE.Group();
        const occluder = new OcclusionMesh(parent);
        let style: OccluderDebugStyle = 'off';

        for (const op of ops) {
          if (op.kind === 'setStyle') {
            occluder.setDebugStyle(op.style);
            style = op.style;
          } else if (op.kind === 'update') {
            occluder.update(op.cells, CELL_SIZE);
          } else if (op.kind === 'applyMeshData') {
            const { positions, indices } = meshOccupiedCells(
              op.cells,
              CELL_SIZE,
              { greedy: true }
            );
            occluder.applyMeshData(positions, indices);
          } else {
            occluder.clear();
          }

          // (1) The depth-only occluder is untouched by any debug styling.
          const depthMesh = meshes(parent).find(
            (m) => (m.material as THREE.Material).colorWrite === false
          );
          expect(depthMesh).toBeDefined();
          expect((depthMesh!.material as THREE.Material).depthWrite).toBe(true);
          expect(depthMesh!.renderOrder).toBeLessThan(0);

          // (2) Exactly the skins the current style implies exist.
          const wantShaded = style !== 'off' && style !== 'wireframe';
          const wantWire =
            style === 'wireframe' || style === 'depth-shaded-wireframe';
          const shaded = byName(parent, 'occupancy-occluder-debug');
          const wire = byName(parent, 'occupancy-occluder-debug-wireframe');
          expect(shaded !== undefined).toBe(wantShaded);
          expect(wire !== undefined).toBe(wantWire);
          expect(meshes(parent)).toHaveLength(
            1 + (wantShaded ? 1 : 0) + (wantWire ? 1 : 0)
          );

          // (3) Every present skin shares the occluder's geometry object
          // (vitest/no-conditional-expect: assert the implication as a bool).
          expect(
            shaded === undefined || shaded.geometry === depthMesh!.geometry
          ).toBe(true);
          expect(
            wire === undefined || wire.geometry === depthMesh!.geometry
          ).toBe(true);

          // (4) Matcap-based styles imply normals on the current geometry —
          // but only once it HAS positions: a cleared/never-meshed geometry
          // has no position attribute, so computeVertexNormals is a no-op
          // there (nothing to shade yet; the next swapGeometry computes).
          const normalsSatisfied =
            !MATCAP_BASED.includes(style) ||
            depthMesh!.geometry.getAttribute('position') === undefined ||
            depthMesh!.geometry.getAttribute('normal') !== undefined;
          expect(normalsSatisfied).toBe(true);
        }

        occluder.dispose();
        expect(parent.children).toHaveLength(0);
      })
    );
  });

  it("a remesh under 'off'/'wireframe' stays normal-free (the cheap path)", () => {
    fc.assert(
      fc.property(
        fc.constantFrom<OccluderDebugStyle>('off', 'wireframe'),
        fc.array(cellArb, { minLength: 1, maxLength: 8 }),
        (style, cells) => {
          const parent = new THREE.Group();
          const occluder = new OcclusionMesh(parent);
          occluder.setDebugStyle(style);
          occluder.update(cells, CELL_SIZE);
          const depthMesh = meshes(parent).find(
            (m) => (m.material as THREE.Material).colorWrite === false
          );
          // A FRESH geometry built while no matcap-based skin is active must
          // not pay for normals — that is the whole point of the conditional.
          expect(depthMesh!.geometry.getAttribute('normal')).toBeUndefined();
          occluder.dispose();
        }
      )
    );
  });
});
