import * as THREE from 'three';
import { SparkRenderer, SplatFileType, SplatMesh } from '@sparkjsdev/spark';

export interface GaussianSceneMetadata {
  src: string;
  width: number;
  height: number;
  fov: number;
  focusDepth: number;
  bytes: number;
  pointCount: number;
  mobile?: { src: string; bytes: number; pointCount: number };
}

export const createGaussianViewer = async (
  host: HTMLDivElement,
  metadata: GaussianSceneMetadata,
  fileBytes: Uint8Array,
  mobile: boolean,
  signal: AbortSignal,
  onError: () => void
): Promise<() => void> => {
  if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
  const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: 'high-performance' });
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xffffff);
  const depth = metadata.focusDepth;
  const camera = new THREE.PerspectiveCamera(metadata.fov, metadata.width / metadata.height, depth * 0.005, depth * 200);
  camera.lookAt(0, 0, -depth);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.25 : 1.5));
  renderer.domElement.className = 'absolute inset-0 block h-full w-full pointer-events-none';
  renderer.domElement.setAttribute('aria-hidden', 'true');
  host.appendChild(renderer.domElement);

  let disposed = false;
  let initialized = false;
  let frame = 0;
  let previousTime = 0;
  let inView = true;
  let spark: SparkRenderer | undefined;
  let splats: SplatMesh | undefined;
  let resizeObserver: ResizeObserver | undefined;
  let visibilityObserver: IntersectionObserver | undefined;
  const current = new THREE.Vector2();
  const target = new THREE.Vector2();
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const requestRender = () => {
    if (initialized && !disposed && !frame && inView && !document.hidden) frame = requestAnimationFrame(render);
  };
  const render = (time: number) => {
    frame = 0;
    if (disposed || !inView || document.hidden) return;
    const delta = Math.min(50, previousTime ? time - previousTime : 16);
    previousTime = time;
    current.lerp(target, 1 - Math.exp(-delta / 80));
    camera.position.set(current.x * depth * 0.045, current.y * depth * 0.035, 0);
    camera.lookAt(0, 0, -depth);
    try {
      renderer.render(scene, camera);
      if (current.distanceToSquared(target) > 0.000001) requestRender();
    } catch {
      dispose();
      onError();
    }
  };
  const move = (event: PointerEvent) => {
    if (reducedMotion.matches) return;
    const bounds = host.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    target.set(
      THREE.MathUtils.clamp((event.clientX - bounds.left) / bounds.width * 2 - 1, -1, 1),
      THREE.MathUtils.clamp(1 - (event.clientY - bounds.top) / bounds.height * 2, -1, 1)
    );
    requestRender();
  };
  const reset = () => {
    target.set(0, 0);
    if (reducedMotion.matches) current.set(0, 0);
    requestRender();
  };
  const pointerUp = (event: PointerEvent) => { if (event.pointerType !== 'mouse') reset(); };
  const visibilityChanged = () => {
    cancelAnimationFrame(frame);
    frame = 0;
    previousTime = 0;
    requestRender();
  };
  const resize = () => {
    if (disposed) return;
    const { width, height } = host.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(Math.round(width), Math.round(height), false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    requestRender();
  };
  const contextLost = (event: Event) => { event.preventDefault(); dispose(); onError(); };
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(frame);
    signal.removeEventListener('abort', dispose);
    resizeObserver?.disconnect();
    visibilityObserver?.disconnect();
    host.removeEventListener('pointermove', move);
    host.removeEventListener('pointerleave', reset);
    host.removeEventListener('pointerup', pointerUp);
    host.removeEventListener('pointercancel', reset);
    document.removeEventListener('visibilitychange', visibilityChanged);
    reducedMotion.removeEventListener('change', reset);
    renderer.domElement.removeEventListener('webglcontextlost', contextLost);
    splats?.dispose();
    spark?.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    renderer.domElement.remove();
  };
  signal.addEventListener('abort', dispose, { once: true });

  try {
    splats = new SplatMesh({ fileBytes, fileType: SplatFileType.SPZ, lod: false, editable: false, raycastable: false });
    await splats.initialized;
    if (disposed) {
      splats.dispose();
      throw new DOMException('Aborted', 'AbortError');
    }
    spark = new SparkRenderer({
      renderer, onDirty: requestRender, sortRadial: false,
      preBlurAmount: 0.3, blurAmount: 0,
      enableLod: false, minSortIntervalMs: mobile ? 50 : 24
    });
    scene.add(spark, splats);
    renderer.domElement.addEventListener('webglcontextlost', contextLost);
    host.addEventListener('pointermove', move, { passive: true });
    host.addEventListener('pointerleave', reset);
    host.addEventListener('pointerup', pointerUp);
    host.addEventListener('pointercancel', reset);
    document.addEventListener('visibilitychange', visibilityChanged);
    reducedMotion.addEventListener('change', reset);
    resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);
    visibilityObserver = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      visibilityChanged();
    });
    visibilityObserver.observe(host);
    resize();
    await spark.update({ scene, camera });
    if (disposed) throw new DOMException('Aborted', 'AbortError');
    initialized = true;
    renderer.render(scene, camera);
    return dispose;
  } catch (error) {
    dispose();
    throw error;
  }
};
