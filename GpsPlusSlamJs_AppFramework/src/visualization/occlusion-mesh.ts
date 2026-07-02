/**
 * Persistent occlusion mesh — a depth-only `THREE.Mesh` of the occupancy grid.
 *
 * Wraps the pure {@link meshOccupiedCells} (face-culled voxel surface) into a
 * THREE object that **writes depth but no color** (`colorWrite = false`,
 * `depthWrite = true`), drawn before virtual content (low `renderOrder`) so real
 * geometry the camera saw earlier hides virtual objects placed behind it —
 * including out-of-view surfaces a single-frame live depth occluder cannot
 * remember (2026-06-13-occupancy-mesh-options-plan.md §4; complements the live
 * occluder in 2026-06-14-webxr-depth-occlusion-plan.md).
 *
 * Reusable across consumer apps (AnchorStarter / MinimalExample want occlusion
 * too); the recorder only owns the off-by-default toggle + scene wiring.
 *
 * Coordinate space: the grid cells (and therefore the mesh positions) are **raw
 * WebXR**, but the parent `arWorldGroup` is AR-odometry NUE. The mesh carries
 * the constant `WEBXR_TO_NUE` basis change as its own local matrix — identical
 * to `OccupancyCubesVisualizer` — so it rides the `alignment × WEBXR_TO_NUE`
 * chain. The parent node is injected (no `getArWorldGroup()`) to stay testable.
 *
 * Scope: this is a full-rebuild occluder (re-mesh the whole snapshot on
 * `update`). The chunked dirty-remesh perf layer (plan §7) is a follow-on.
 *
 * @see occlusion-mesh.ts.md for detailed documentation
 */

import * as THREE from 'three';
import type { GridCell } from '../ar/bresenham3d.js';
import {
  meshOccupiedCells,
  type Aabb,
  type MeshMode,
  type MeshOccupiedCellsOptions,
} from '../ar/occupancy-mesher.js';
import { WEBXR_TO_NUE } from '../ar/webxr-nue-basis.js';
import type { Vector3 } from 'gps-plus-slam-js';
import type { OccluderDebugStyle } from '../state/recording-options.js';

const MESH_NAME = 'occupancy-occluder';
const DEBUG_MESH_NAME = 'occupancy-occluder-debug';
const DEBUG_WIREFRAME_MESH_NAME = 'occupancy-occluder-debug-wireframe';

/** Default render order — well before virtual content (which is ≥ 0). */
const DEFAULT_RENDER_ORDER = -1;

/** Opacity of the matcap debug skin — see-through enough to read the real scene
 *  behind it while the shape stays legible. */
const DEBUG_SKIN_OPACITY = 0.6;

/** Light-cyan GL lines of the wireframe skin — faint enough not to swamp the
 *  shaded skin in the combined style, visible enough to read triangle density. */
const WIREFRAME_COLOR = 0xaaeeff;
const WIREFRAME_OPACITY = 0.35;

/** Which styles shade with the matcap (and therefore need vertex normals —
 *  pure 'wireframe' is unlit and keeps the remesh path normal-free). */
function styleNeedsNormals(style: OccluderDebugStyle): boolean {
  return (
    style === 'matcap' ||
    style === 'depth-shaded' ||
    style === 'depth-shaded-wireframe'
  );
}

/**
 * Build a tiny procedural matcap texture (a shaded sphere with a specular
 * highlight) so the debug skin reads as a **shiny** surface with **no scene
 * lights** — `MeshMatcapMaterial` bakes the lighting into this lookup. Generated
 * from a typed array (no canvas/WebGL), so it works headless in tests too.
 */
function createOccluderDebugMatcap(): THREE.DataTexture {
  const size = 64;
  const data = new Uint8Array(size * size * 4);
  // Light direction (front-upper-right); normalized via its length below.
  const lx = 0.4;
  const ly = 0.5;
  const lz = 0.75;
  const llen = Math.hypot(lx, ly, lz);
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const idx = (j * size + i) * 4;
      const nx = ((i + 0.5) / size) * 2 - 1;
      const ny = ((j + 0.5) / size) * 2 - 1;
      const r2 = nx * nx + ny * ny;
      let r = 12;
      let g = 12;
      let b = 14;
      if (r2 <= 1) {
        const nz = Math.sqrt(1 - r2);
        const ndl = Math.max(0, (nx * lx + ny * ly + nz * lz) / llen);
        const diff = 0.25 + 0.75 * ndl; // ambient + diffuse
        const spec = Math.pow(ndl, 32); // tight specular highlight
        // Cyan-ish tint so the occluder reads as obviously "debug".
        r = Math.min(255, 255 * (0.15 * diff + spec));
        g = Math.min(255, 255 * (0.55 * diff + spec));
        b = Math.min(255, 255 * (0.78 * diff + spec));
      }
      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.needsUpdate = true;
  return tex;
}

export interface OcclusionMeshOptions {
  /**
   * Merge coplanar faces (fewer triangles, same occluded volume). Default
   * true — the occluder is invisible, so the coarser triangulation is free.
   * Ignored when {@link OcclusionMeshOptions.mode} is set.
   */
  readonly greedy?: boolean;
  /**
   * Mesher strategy (additive opt-in; 2026-06-30 occluder-tuning, F2). When set
   * it takes precedence over {@link greedy}. `'smooth'` selects the surface-nets
   * mesher that hugs the measured per-cell centroids — pass a `getCellPoint`
   * provider to {@link OcclusionMesh.update} for it to read. Left **unset by
   * default** so existing behaviour (greedy cubes) is byte-for-byte unchanged
   * until the smooth occluder is confirmed on-device.
   */
  readonly mode?: MeshMode;
  /**
   * `renderOrder` of the depth-only mesh. Must be below virtual content so the
   * occluder lays down depth first. Default −1. (The live occluder, when it
   * exists, sits between this and content — plan §5.)
   */
  readonly renderOrder?: number;
}

/**
 * A depth-only occlusion mesh that rebuilds from an occupancy-grid snapshot.
 * Mirrors {@link OccupancyCubesVisualizer}'s lifecycle (inject parent, `update`,
 * `clear`, `dispose`) so the recorder can wire it the same way as the cubes.
 */
export class OcclusionMesh {
  private readonly arSpaceNode: THREE.Object3D;
  private readonly greedy: boolean;
  private readonly mode: MeshMode | undefined;
  private readonly material: THREE.MeshBasicMaterial;
  private readonly mesh: THREE.Mesh;
  private geometry: THREE.BufferGeometry;
  private lastAabbs: readonly Aabb[] = [];
  private disposed = false;
  // Debug visualization (off by default): VISIBLE "skins" sharing the
  // occluder's geometry, composed per style (shaded matcap-based skin and/or a
  // wireframe skin). Kept separate from `this.mesh` (the invisible depth
  // writer) so styling never changes the actual occlusion — the depth mesh is
  // untouched, the skins are purely additive. Materials (and the shared matcap
  // texture) are lazily created once and cached across style switches; they are
  // released only in dispose().
  private debugStyle: OccluderDebugStyle = 'off';
  private shadedSkin: THREE.Mesh | null = null;
  private wireframeSkin: THREE.Mesh | null = null;
  private matcapTexture: THREE.DataTexture | null = null;
  private matcapMaterial: THREE.MeshMatcapMaterial | null = null;
  private depthShadedMaterial: THREE.MeshMatcapMaterial | null = null;
  private wireframeMaterial: THREE.MeshBasicMaterial | null = null;

  /**
   * @param arSpaceNode the AR-odometry-NUE node that receives the alignment
   *   matrix (`arWorldGroup` live, `replaySceneState.arWorldGroup` in replay).
   */
  constructor(arSpaceNode: THREE.Object3D, options: OcclusionMeshOptions = {}) {
    this.arSpaceNode = arSpaceNode;
    this.greedy = options.greedy ?? true;
    this.mode = options.mode;
    this.geometry = new THREE.BufferGeometry();
    // Invisible depth-writer: contributes only to the depth buffer, so virtual
    // content's normal depth test hides fragments behind the real surface.
    this.material = new THREE.MeshBasicMaterial({
      colorWrite: false,
      depthWrite: true,
    });
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.name = MESH_NAME;
    this.mesh.renderOrder = options.renderOrder ?? DEFAULT_RENDER_ORDER;
    this.mesh.frustumCulled = false; // surface spans the whole room
    // Raw-WebXR positions; the mesh node converts to the parent's NUE frame.
    this.mesh.matrixAutoUpdate = false;
    this.mesh.matrix.copy(WEBXR_TO_NUE);
    this.arSpaceNode.add(this.mesh);
  }

  /** The number of triangles currently drawn. */
  getTriangleCount(): number {
    const index = this.geometry.getIndex();
    return index ? index.count / 3 : 0;
  }

  /** The AABB list from the most recent {@link update} (physics export hook). */
  getAabbs(): readonly Aabb[] {
    return this.lastAabbs;
  }

  /**
   * Re-mesh from a fresh occupied-cell snapshot. Pass
   * `grid.getOccupiedCells(occupancy.minConfidence)` so the occluder shares the
   * same noise floor as the cubes and the COLMAP export.
   *
   * @param getCellPoint optional per-cell measured-centroid provider
   *   (`grid.getCellPoint`); only consumed when this occluder was constructed
   *   with `mode: 'smooth'` (otherwise ignored). When omitted under `'smooth'`,
   *   the surface nets falls back to cell centres.
   */
  update(
    cells: Iterable<GridCell>,
    cellSizeM: number,
    getCellPoint?: (cell: GridCell) => Vector3 | null
  ): void {
    if (this.disposed) return;
    const meshOptions: MeshOccupiedCellsOptions = this.mode
      ? { mode: this.mode, getCellPoint }
      : { greedy: this.greedy };
    const { positions, indices, aabbs } = meshOccupiedCells(
      cells,
      cellSizeM,
      meshOptions
    );
    this.lastAabbs = aabbs;
    this.swapGeometry(positions, indices);
  }

  /**
   * Apply **precomputed** geometry (positions/indices) without meshing — the
   * entry point for the Web Worker offload: the driver posts the occupied-cell
   * snapshot to a worker (`packMeshRequest`/`runMeshRequest`), and this swaps in
   * the returned typed arrays off the render-critical path. Byte-identical result
   * to {@link update} for the same input.
   *
   * The AABB physics hook is NOT populated on this path (the worker returns
   * geometry only; AABBs are an export hook unused by rendering) — {@link getAabbs}
   * returns empty here. Use the synchronous {@link update} if AABBs are needed.
   */
  applyMeshData(positions: Float32Array, indices: Uint32Array): void {
    if (this.disposed) return;
    this.lastAabbs = [];
    this.swapGeometry(positions, indices);
  }

  /**
   * Replace the geometry wholesale from typed arrays — a full rebuild is the
   * simple first cut; dispose the old buffers to avoid leaking GPU memory across
   * refreshes.
   */
  private swapGeometry(positions: Float32Array, indices: Uint32Array): void {
    const next = new THREE.BufferGeometry();
    next.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    next.setIndex(new THREE.BufferAttribute(indices, 1));
    // Matcap shading needs per-vertex normals; the mesher emits none. Compute
    // them only when a matcap-based debug skin is showing, so the default
    // occluder path (invisible — normals unused) and the pure wireframe style
    // stay cheap.
    if (styleNeedsNormals(this.debugStyle)) next.computeVertexNormals();
    this.geometry.dispose();
    this.geometry = next;
    this.mesh.geometry = next;
    this.rebindSkinGeometry(next);
  }

  /** Point every active debug skin at the (new) shared geometry. */
  private rebindSkinGeometry(geometry: THREE.BufferGeometry): void {
    if (this.shadedSkin) this.shadedSkin.geometry = geometry;
    if (this.wireframeSkin) this.wireframeSkin.geometry = geometry;
  }

  /**
   * Select which **visible debug skin(s)** render the occluder mesh so its
   * shape and structure can be judged on-device (2026-07-02 debug-viz-styles
   * plan): the original `'matcap'` skin, a `'depth-shaded'` variant (distance
   * fade + fresnel rim, separates overlapping layers), a `'wireframe'` overlay
   * (the raw triangulation as GL lines), the combined
   * `'depth-shaded-wireframe'`, or `'off'`.
   *
   * Additive by design: every style adds/removes separate skin meshes sharing
   * the occluder's geometry and **never touches the invisible depth-only
   * mesh**, so occlusion is byte-for-byte unchanged whichever style is active.
   * The skins are `transparent` with `depthWrite:false` (the depth-only mesh
   * already wrote the occluding depth), so they just paint where the occluder
   * is the nearest geometry; the wireframe draws at renderOrder 1 so its lines
   * overlay the shaded surface in the combined style.
   *
   * Vertex normals (the mesher emits none) are computed only for the
   * matcap-based styles — `'wireframe'` is unlit, so like `'off'` it keeps the
   * remesh path normal-free.
   *
   * Only meaningful when this occluder is actually meshing the grid (it is the
   * persistent occluder's mesh); setting a style on an empty/disabled occluder
   * is a harmless no-op until {@link update} feeds geometry.
   */
  setDebugStyle(style: OccluderDebugStyle): void {
    if (this.disposed || style === this.debugStyle) return;
    this.debugStyle = style;
    this.applyShadedSkin(this.shadedMaterialFor(style));
    this.applyWireframeSkin(
      style === 'wireframe' || style === 'depth-shaded-wireframe'
    );
  }

  /** Which matcap-based material the style shades with (null = no shaded skin). */
  private shadedMaterialFor(
    style: OccluderDebugStyle
  ): THREE.MeshMatcapMaterial | null {
    if (style === 'matcap') return this.getMatcapMaterial();
    if (style === 'depth-shaded' || style === 'depth-shaded-wireframe') {
      return this.getDepthShadedMaterial();
    }
    return null;
  }

  /** Add/retarget/remove the single shaded skin node for the desired material. */
  private applyShadedSkin(material: THREE.MeshMatcapMaterial | null): void {
    if (material) {
      // Normals for the (possibly already-meshed) current geometry.
      this.geometry.computeVertexNormals();
      if (this.shadedSkin) {
        this.shadedSkin.material = material;
      } else {
        this.shadedSkin = this.createSkinMesh(DEBUG_MESH_NAME, 0, material);
        this.arSpaceNode.add(this.shadedSkin);
      }
    } else if (this.shadedSkin) {
      this.arSpaceNode.remove(this.shadedSkin);
      this.shadedSkin = null;
    }
  }

  /** Add/remove the wireframe skin — drawn after the shaded skin (renderOrder
   *  1) so its lines sit on top of the surface in the combined style. */
  private applyWireframeSkin(want: boolean): void {
    if (want) {
      if (!this.wireframeSkin) {
        this.wireframeSkin = this.createSkinMesh(
          DEBUG_WIREFRAME_MESH_NAME,
          1,
          this.getWireframeMaterial()
        );
        this.arSpaceNode.add(this.wireframeSkin);
      }
    } else if (this.wireframeSkin) {
      this.arSpaceNode.remove(this.wireframeSkin);
      this.wireframeSkin = null;
    }
  }

  /**
   * Toggle the matcap debug rendering of the occluder mesh.
   *
   * @deprecated Superseded by {@link setDebugStyle} (2026-07-02) — this is a
   * thin wrapper mapping `enabled ? 'matcap' : 'off'`, kept so existing
   * consumers of the boolean API keep working unchanged.
   */
  setDebugVisualization(enabled: boolean): void {
    this.setDebugStyle(enabled ? 'matcap' : 'off');
  }

  /** A debug skin mesh sharing the occluder's geometry, transform and culling
   *  behaviour — only name, renderOrder and material differ per skin. */
  private createSkinMesh(
    name: string,
    renderOrder: number,
    material: THREE.Material
  ): THREE.Mesh {
    const skin = new THREE.Mesh(this.geometry, material);
    skin.name = name;
    skin.renderOrder = renderOrder; // transparent overlay, after the depth pass
    skin.frustumCulled = false;
    skin.matrixAutoUpdate = false;
    skin.matrix.copy(WEBXR_TO_NUE); // same raw-WebXR → NUE basis as the occluder
    return skin;
  }

  /** The procedural matcap texture, shared by both matcap-based materials. */
  private getMatcapTexture(): THREE.DataTexture {
    if (!this.matcapTexture) {
      this.matcapTexture = createOccluderDebugMatcap();
    }
    return this.matcapTexture;
  }

  private getMatcapMaterial(): THREE.MeshMatcapMaterial {
    if (!this.matcapMaterial) {
      this.matcapMaterial = new THREE.MeshMatcapMaterial({
        matcap: this.getMatcapTexture(),
        transparent: true,
        opacity: DEBUG_SKIN_OPACITY,
        depthWrite: false, // the invisible depth mesh owns the occluding depth
      });
    }
    return this.matcapMaterial;
  }

  private getDepthShadedMaterial(): THREE.MeshMatcapMaterial {
    if (!this.depthShadedMaterial) {
      this.depthShadedMaterial = new THREE.MeshMatcapMaterial({
        matcap: this.getMatcapTexture(),
        transparent: true,
        opacity: DEBUG_SKIN_OPACITY,
        depthWrite: false,
      });
    }
    return this.depthShadedMaterial;
  }

  private getWireframeMaterial(): THREE.MeshBasicMaterial {
    if (!this.wireframeMaterial) {
      this.wireframeMaterial = new THREE.MeshBasicMaterial({
        wireframe: true, // GL 1-px lines over the shared triangulation
        color: WIREFRAME_COLOR,
        transparent: true,
        opacity: WIREFRAME_OPACITY,
        depthWrite: false,
      });
    }
    return this.wireframeMaterial;
  }

  /** Empty the mesh (e.g. on store swap); the node stays in the scene. */
  clear(): void {
    if (this.disposed) return;
    const next = new THREE.BufferGeometry();
    this.geometry.dispose();
    this.geometry = next;
    this.mesh.geometry = next;
    // Keep the visible debug skins in sync with the depth-only mesh (as
    // swapGeometry does) — otherwise they keep rendering the old, now-disposed
    // geometry and a stale debug surface lingers on screen after a clear.
    this.rebindSkinGeometry(next);
    this.lastAabbs = [];
  }

  /** Remove the mesh from its parent and release GPU resources. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.arSpaceNode.remove(this.mesh);
    if (this.shadedSkin) {
      this.arSpaceNode.remove(this.shadedSkin);
      this.shadedSkin = null;
    }
    if (this.wireframeSkin) {
      this.arSpaceNode.remove(this.wireframeSkin);
      this.wireframeSkin = null;
    }
    this.matcapTexture?.dispose();
    this.matcapTexture = null;
    this.matcapMaterial?.dispose();
    this.matcapMaterial = null;
    this.depthShadedMaterial?.dispose();
    this.depthShadedMaterial = null;
    this.wireframeMaterial?.dispose();
    this.wireframeMaterial = null;
    this.geometry.dispose();
    this.material.dispose();
    this.lastAabbs = [];
  }
}
