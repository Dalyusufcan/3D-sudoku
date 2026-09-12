import {
  ArrowHelper, BoxGeometry, BufferGeometry, CanvasTexture, Color, EdgesGeometry, Group,
  Line, LineBasicMaterial, LineLoop, LineSegments, Mesh, MeshBasicMaterial, Scene,
  Sprite, SpriteMaterial, SRGBColorSpace, Vector3, WebGLRenderer,
} from 'three';
import { axisLinesForCell, CELL_COUNT, toCoordinates, type Axis } from '../core/cube.ts';
import type { GameState } from '../game/state.ts';
import { createCamera } from './camera.ts';
import { createInteraction } from './interaction.ts';
import { CELL_SPACING, cellPosition } from './positions.ts';
import { axisOrigin, axisDirection } from './orientation.ts';

const COLORS = {
  ink: '#34433c', green: '#416a54', selected: '#345a44', conflict: '#c34d43',
  x: '#408267', y: '#c89542', z: '#658ba6', background: '#f4f5f1',
} as const;
const AXES: readonly Axis[] = ['x', 'y', 'z'];

interface CellVisual {
  readonly group: Group;
  readonly mesh: Mesh<BoxGeometry, MeshBasicMaterial>;
  readonly edge: LineSegments<EdgesGeometry, LineBasicMaterial>;
  readonly label: Sprite;
  labelKey: string;
}

export interface CubeRenderer {
  update(state: GameState): void;
  setLayer(layer: number | null): void;
  resetView(): void;
  dispose(): void;
}

export function createCubeRenderer(
  container: HTMLElement,
  onSelect: (index: number | null) => void,
): CubeRenderer {
  const renderer = new WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(COLORS.background);
  renderer.outputColorSpace = SRGBColorSpace;
  const canvas = renderer.domElement;
  canvas.className = 'cube-canvas';
  canvas.style.display = 'block';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.touchAction = 'none';
  canvas.tabIndex = 0;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'Interactive 4 by 4 by 4 cube. Drag to rotate, tap a cell to focus. WASD moves along X and Y; Q and E move through depth.');
  container.append(canvas);

  const scene = new Scene();
  const cameraRig = createCamera(canvas);
  const box = new BoxGeometry(0.79, 0.79, 0.79);
  const edges = new EdgesGeometry(box);
  const textures = new Map<string, CanvasTexture>();
  const disposableMaterials = new Set<MeshBasicMaterial | LineBasicMaterial | SpriteMaterial>();
  const disposableGeometries = new Set<BufferGeometry>([box, edges]);

  function textTexture(text: string, color: string, fixed = false): CanvasTexture {
    const key = `${text}:${color}:${fixed}`;
    const existing = textures.get(key);
    if (existing) return existing;
    const surface = document.createElement('canvas');
    surface.width = 192;
    surface.height = 192;
    const context = surface.getContext('2d');
    if (!context) throw new Error('Canvas text rendering is unavailable.');
    context.fillStyle = color;
    context.font = `${fixed ? 600 : 500} ${text.length > 1 ? 86 : 116}px system-ui, sans-serif`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text, 96, 101);
    if (fixed && text !== '·') {
      context.globalAlpha = 0.6;
      context.fillRect(83, 161, 26, 4);
    }
    const texture = new CanvasTexture(surface);
    texture.colorSpace = SRGBColorSpace;
    textures.set(key, texture);
    return texture;
  }

  function sprite(text: string, color: string, size: number): Sprite {
    const material = new SpriteMaterial({ map: textTexture(text, color), transparent: true,
      depthWrite: false, depthTest: false });
    disposableMaterials.add(material);
    const label = new Sprite(material);
    label.scale.setScalar(size);
    label.renderOrder = 3;
    return label;
  }

  const cells: CellVisual[] = Array.from({ length: CELL_COUNT }, (_, index) => {
    const material = new MeshBasicMaterial({ color: '#ffffff', transparent: true,
      opacity: 0.6, depthWrite: false });
    const edgeMaterial = new LineBasicMaterial({ color: '#91a396', transparent: true,
      opacity: 0.7, depthWrite: false });
    disposableMaterials.add(material);
    disposableMaterials.add(edgeMaterial);
    const mesh = new Mesh(box, material);
    const edge = new LineSegments(edges, edgeMaterial);
    const label = sprite('·', COLORS.ink, 0.78);
    const group = new Group();
    group.position.copy(cellPosition(index));
    group.add(mesh, edge, label);
    scene.add(group);
    return { group, mesh, edge, label, labelKey: '' };
  });

  const layerFrames: LineLoop<BufferGeometry, LineBasicMaterial>[] = [];
  const extent = CELL_SPACING * 1.5 + 0.57;
  for (let z = 0; z < 4; z += 1) {
    const depth = (1.5 - z) * CELL_SPACING;
    const geometry = new BufferGeometry().setFromPoints([
      new Vector3(-extent, -extent, depth), new Vector3(extent, -extent, depth),
      new Vector3(extent, extent, depth), new Vector3(-extent, extent, depth),
    ]);
    const material = new LineBasicMaterial({ color: COLORS.z, transparent: true, opacity: 0.12 });
    disposableGeometries.add(geometry);
    disposableMaterials.add(material);
    const frame = new LineLoop(geometry, material);
    scene.add(frame);
    layerFrames.push(frame);
  }

  // These persistent world-space rulers remain anchored while the camera rotates.
  const guideOrigin = axisOrigin();
  const originMarker = sprite('·', '#708465', 0.32);
  originMarker.position.copy(guideOrigin);
  originMarker.renderOrder = 9;
  scene.add(originMarker);
  const arrows: ArrowHelper[] = [];
  const guideDirections: Record<Axis, Vector3> = {
    x: axisDirection('x'), y: axisDirection('y'), z: axisDirection('z'),
  };
  for (const axis of AXES) {
    const origin = guideOrigin;
    const arrow = new ArrowHelper(guideDirections[axis], origin, 4.95, COLORS[axis], 0.16, 0.09);
    // Render orientation on top of ghosted cells so the shared Z origin cannot disappear inside the cube.
    for (const part of [arrow.line, arrow.cone]) {
      for (const material of Array.isArray(part.material) ? part.material : [part.material]) {
        material.transparent = true;
        material.depthTest = false;
        material.depthWrite = false;
      }
      part.renderOrder = 7;
    }
    arrows.push(arrow);
    scene.add(arrow);
    const title = sprite(axis.toUpperCase(), COLORS[axis], 0.45);
    title.position.copy(origin).addScaledVector(guideDirections[axis], 5.2);
    title.renderOrder = 8;
    scene.add(title);
    for (let tick = 0; tick < 4; tick += 1) {
      const label = sprite(String(tick + 1), COLORS[axis], 0.26);
      label.renderOrder = 8;
      const value = (tick - 1.5) * CELL_SPACING;
      label.position.copy(axis === 'x'
        ? new Vector3(value, -3.02, 2.76)
        : axis === 'y'
          ? new Vector3(-3.03, value, 2.76)
          : new Vector3(-3.03, -2.76, -value));
      scene.add(label);
    }
  }

  const highlightedLines = AXES.map((axis) => {
    const geometry = new BufferGeometry().setFromPoints([new Vector3(), new Vector3()]);
    const material = new LineBasicMaterial({ color: COLORS[axis], transparent: true,
      opacity: 0.8, depthTest: false, depthWrite: false });
    disposableGeometries.add(geometry);
    disposableMaterials.add(material);
    const line = new Line(geometry, material);
    line.visible = false;
    line.renderOrder = 1;
    scene.add(line);
    return line;
  });

  let state: GameState | null = null;
  let layer: number | null = null;
  let hovered: number | null = null;
  let disposed = false;

  function paint(): void {
    if (!state) return;
    const selected = state.selected;
    const focus = selected ?? hovered;
    const related = focus === null ? null : axisLinesForCell(focus);
    const conflicts = new Set(state.conflicts);
    const active = new Set(related === null ? [] : [...related.x, ...related.y, ...related.z]);
    for (let index = 0; index < cells.length; index += 1) {
      const cell = cells[index]!;
      const value = state.values[index]!;
      const fixed = state.generated.fixed[index] === true;
      const isSelected = selected === index;
      const isRelated = active.has(index);
      const isConflict = conflicts.has(index);
      const isLayer = layer === null || toCoordinates(index).z === layer;
      const ghost = selected !== null ? !isRelated : !isLayer;
      const axis = related === null ? undefined : AXES.find((candidate) => related[candidate].includes(index));
      const tint = isConflict ? COLORS.conflict : isSelected ? COLORS.selected
        : axis && isRelated ? COLORS[axis] : '#91a396';
      cell.mesh.material.color.set(isSelected ? tint : '#ffffff');
      if (!isSelected && isRelated) cell.mesh.material.color.lerp(new Color(tint), 0.15);
      cell.mesh.material.opacity = ghost ? 0.045 : isSelected ? 0.97 : value === 0 ? 0.24 : 0.73;
      cell.edge.material.color.set(isConflict || isSelected || isRelated ? tint : '#9aa99c');
      cell.edge.material.opacity = ghost ? 0.09 : isSelected ? 1 : isRelated ? 0.87 : 0.45;
      cell.group.scale.setScalar(isSelected ? 1.08 : 1);
      const color = isSelected ? '#ffffff' : isConflict ? COLORS.conflict : fixed ? COLORS.ink : COLORS.green;
      const labelKey = `${value}:${color}:${fixed}`;
      if (cell.labelKey !== labelKey) {
        cell.label.material.map = textTexture(value === 0 ? '·' : String(value), color, fixed);
        cell.labelKey = labelKey;
      }
      // Ghost labels are suppressed so the ten active cells carry the visual weight.
      cell.label.visible = !ghost;
      cell.label.material.opacity = selected !== null ? 1 : value === 0 ? 0.5 : 0.94;
      cell.label.renderOrder = isSelected ? 5 : isRelated ? 4 : 3;
    }
    highlightedLines.forEach((line, index) => {
      const axis = AXES[index]!;
      line.visible = related !== null;
      if (!related) return;
      const first = cellPosition(related[axis][0]!);
      const last = cellPosition(related[axis][3]!);
      const direction = last.clone().sub(first).normalize();
      first.addScaledVector(direction, -0.52);
      last.addScaledVector(direction, 0.52);
      line.geometry.setFromPoints([first, last]);
      line.material.opacity = selected === null ? 0.25 : 0.8;
    });
    layerFrames.forEach((frame, index) => {
      frame.material.opacity = selected !== null ? 0.055 : layer === index ? 0.5 : 0.12;
    });
    canvas.style.cursor = hovered === null ? 'grab' : 'pointer';
  }

  const removeInteraction = createInteraction(canvas, cameraRig.camera, cells.map((cell) => cell.mesh),
    (index) => {
      if (state?.selected !== null && state?.selected !== undefined) {
        const lines = axisLinesForCell(state.selected);
        return [...lines.x, ...lines.y, ...lines.z].includes(index);
      }
      return layer === null || toCoordinates(index).z === layer;
    }, onSelect, (index) => {
      if (hovered === index) return;
      hovered = index;
      paint();
    });

  function resize(): void {
    const width = Math.max(container.clientWidth, 1);
    const height = Math.max(container.clientHeight, 1);
    renderer.setSize(width, height, false);
    cameraRig.resize(width, height);
  }
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);
  resize();
  let previousTime = performance.now();
  renderer.setAnimationLoop((time) => {
    cameraRig.tick((time - previousTime) / 1000);
    previousTime = time;
    renderer.render(scene, cameraRig.camera);
  });

  function contextLost(event: Event): void {
    event.preventDefault();
    renderer.setAnimationLoop(null);
    container.dispatchEvent(new CustomEvent('sudoku-render-error', { bubbles: true,
      detail: 'The 3D view was interrupted. Reload to restart the puzzle.' }));
  }
  canvas.addEventListener('webglcontextlost', contextLost);

  return {
    update(nextState): void {
      if (disposed) return;
      state = nextState;
      cameraRig.select(nextState.selected);
      paint();
    },
    setLayer(nextLayer): void {
      if (nextLayer !== null && (!Number.isInteger(nextLayer) || nextLayer < 0 || nextLayer > 3)) return;
      layer = nextLayer;
      hovered = null;
      paint();
    },
    resetView(): void { cameraRig.reset(); },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      renderer.setAnimationLoop(null);
      resizeObserver.disconnect();
      canvas.removeEventListener('webglcontextlost', contextLost);
      removeInteraction();
      cameraRig.dispose();
      textures.forEach((texture) => texture.dispose());
      disposableMaterials.forEach((material) => material.dispose());
      disposableGeometries.forEach((geometry) => geometry.dispose());
      arrows.forEach((arrow) => arrow.dispose());
      renderer.dispose();
      canvas.remove();
    },
  };
}
