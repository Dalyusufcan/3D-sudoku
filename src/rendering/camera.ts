import { PerspectiveCamera, Vector3 } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CAMERA_FOV, focusFrame, overviewDistance } from './framing.ts';

export function createCamera(canvas: HTMLCanvasElement) {
  const camera = new PerspectiveCamera(CAMERA_FOV, 1, 0.1, 100);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.09;
  controls.enablePan = false;
  controls.minDistance = 6;
  controls.maxDistance = 24;
  controls.minPolarAngle = 0.12;
  controls.maxPolarAngle = Math.PI - 0.12;
  controls.rotateSpeed = 0.65;
  controls.zoomSpeed = 0.7;

  const defaultDirection = new Vector3(7.8, 6.1, 9.3).normalize();
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let baseDistance = overviewDistance(1);
  let selected: number | null = null;
  let restorePosition = defaultDirection.clone().multiplyScalar(baseDistance);
  let restoreTarget = new Vector3();
  let transition: { position: Vector3; target: Vector3 } | null = null;
  camera.position.copy(restorePosition);
  controls.update();

  function move(position: Vector3, target: Vector3): void {
    // Drain orbit inertia through the public API, preserving the current pose.
    // Otherwise a selection immediately after dragging can fight the camera tween.
    const currentPosition = camera.position.clone();
    const currentTarget = controls.target.clone();
    controls.enableDamping = false;
    controls.update();
    controls.enableDamping = true;
    camera.position.copy(currentPosition);
    controls.target.copy(currentTarget);
    controls.update();
    if (reducedMotion.matches) {
      camera.position.copy(position);
      controls.target.copy(target);
      transition = null;
      controls.update();
    } else {
      transition = { position, target };
    }
  }

  // A deliberate orbit immediately takes ownership from the focus animation.
  function cancelTransition(): void { transition = null; }
  controls.addEventListener('start', cancelTransition);

  return {
    camera,
    resize(width: number, height: number): void {
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      const previousDistance = baseDistance;
      baseDistance = overviewDistance(camera.aspect);
      const factor = baseDistance / previousDistance;
      camera.position.sub(controls.target).multiplyScalar(factor).add(controls.target);
      restorePosition.sub(restoreTarget).multiplyScalar(factor).add(restoreTarget);
      if (transition) {
        transition.position.sub(transition.target).multiplyScalar(factor).add(transition.target);
      }
      controls.maxDistance = Math.max(24, baseDistance * 1.8);
      controls.update();
      if (selected !== null) {
        const { target, distance } = focusFrame(selected, camera.aspect);
        const direction = camera.position.clone().sub(controls.target).normalize();
        move(target.clone().addScaledVector(direction, distance), target);
      }
    },
    select(index: number | null): void {
      if (selected === index) return;
      if (index === null) {
        move(restorePosition.clone(), restoreTarget.clone());
      } else {
        if (selected === null) {
          restorePosition.copy(camera.position);
          restoreTarget.copy(controls.target);
        }
        const { target, distance } = focusFrame(index, camera.aspect);
        const direction = camera.position.clone().sub(controls.target).normalize();
        move(target.clone().addScaledVector(direction, distance), target);
      }
      selected = index;
    },
    reset(): void {
      restorePosition = defaultDirection.clone().multiplyScalar(baseDistance);
      restoreTarget = new Vector3();
      if (selected === null) {
        move(restorePosition.clone(), restoreTarget.clone());
      } else {
        const { target, distance } = focusFrame(selected, camera.aspect);
        move(target.clone().addScaledVector(defaultDirection, distance), target);
      }
    },
    tick(delta: number): void {
      if (transition) {
        const amount = 1 - Math.exp(-Math.min(delta, 0.1) * 8);
        camera.position.lerp(transition.position, amount);
        controls.target.lerp(transition.target, amount);
        if (camera.position.distanceToSquared(transition.position) < 0.0001
          && controls.target.distanceToSquared(transition.target) < 0.0001) {
          camera.position.copy(transition.position);
          controls.target.copy(transition.target);
          transition = null;
        }
      }
      controls.update();
    },
    dispose(): void {
      controls.removeEventListener('start', cancelTransition);
      controls.dispose();
    },
  };
}
