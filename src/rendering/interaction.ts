import { Mesh, PerspectiveCamera, Raycaster, Vector2 } from 'three';

export function createInteraction(
  canvas: HTMLCanvasElement,
  camera: PerspectiveCamera,
  cells: readonly Mesh[],
  canSelect: (index: number) => boolean,
  onSelect: (index: number | null) => void,
  onHover: (index: number | null) => void,
): () => void {
  const raycaster = new Raycaster();
  const pointer = new Vector2();
  const indexByMesh = new Map(cells.map((cell, index) => [cell, index]));
  let down: { x: number; y: number; pointerId: number; moved: boolean } | null = null;
  const activePointers = new Set<number>();
  let wasMultitouch = false;

  function pick(event: PointerEvent): number | null {
    const bounds = canvas.getBoundingClientRect();
    if (bounds.width === 0 || bounds.height === 0) return null;
    pointer.set((event.clientX - bounds.left) / bounds.width * 2 - 1,
      -(event.clientY - bounds.top) / bounds.height * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const targets = cells.filter((_cell, index) => canSelect(index));
    const intersection = raycaster.intersectObjects(targets, false)[0];
    if (!intersection || !(intersection.object instanceof Mesh)) return null;
    return indexByMesh.get(intersection.object) ?? null;
  }

  function pointerDown(event: PointerEvent): void {
    if (event.button !== 0) return;
    activePointers.add(event.pointerId);
    if (activePointers.size > 1) wasMultitouch = true;
    down = { x: event.clientX, y: event.clientY, pointerId: event.pointerId, moved: false };
  }

  function pointerMove(event: PointerEvent): void {
    if (down?.pointerId === event.pointerId
      && Math.hypot(event.clientX - down.x, event.clientY - down.y) > 6) down.moved = true;
    if (activePointers.size === 0 && event.pointerType !== 'touch') onHover(pick(event));
  }

  function pointerUp(event: PointerEvent): void {
    activePointers.delete(event.pointerId);
    if (down?.pointerId === event.pointerId && !down.moved && !wasMultitouch
      && Math.hypot(event.clientX - down.x, event.clientY - down.y) <= 6) {
      canvas.focus({ preventScroll: true });
      onSelect(pick(event));
    }
    if (activePointers.size === 0) {
      down = null;
      wasMultitouch = false;
    }
  }

  function pointerCancel(event: PointerEvent): void {
    activePointers.delete(event.pointerId);
    down = null;
    if (activePointers.size === 0) wasMultitouch = false;
    onHover(null);
  }

  function pointerLeave(): void { onHover(null); }
  canvas.addEventListener('pointerdown', pointerDown);
  canvas.addEventListener('pointermove', pointerMove);
  canvas.addEventListener('pointerup', pointerUp);
  canvas.addEventListener('pointercancel', pointerCancel);
  canvas.addEventListener('pointerleave', pointerLeave);

  return () => {
    canvas.removeEventListener('pointerdown', pointerDown);
    canvas.removeEventListener('pointermove', pointerMove);
    canvas.removeEventListener('pointerup', pointerUp);
    canvas.removeEventListener('pointercancel', pointerCancel);
    canvas.removeEventListener('pointerleave', pointerLeave);
  };
}
