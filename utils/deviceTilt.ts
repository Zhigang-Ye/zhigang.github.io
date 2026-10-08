import { Euler, MathUtils, Quaternion, Vector3 } from 'three';

export type DeviceTiltStatus = 'unsupported' | 'prompt' | 'requesting' | 'active' | 'paused' | 'denied' | 'unavailable';
export interface DeviceTiltControls {
  enable: () => Promise<void>;
  recenter: () => void;
  setPaused: (paused: boolean) => void;
  dispose: () => void;
}

type OrientationConstructor = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<'granted' | 'denied'>;
};

// Permission lasts for this page; switching works should not ask again.
let permissionGranted = false;

export const createDeviceTilt = (
  onTilt: (x: number, y: number) => void,
  onStatus: (status: DeviceTiltStatus) => void
): DeviceTiltControls => {
  const orientation = window.DeviceOrientationEvent as OrientationConstructor | undefined;
  const supported = window.isSecureContext && !!orientation;
  let disposed = false;
  let paused = false;
  let enabled = false;
  let requesting = false;
  let listening = false;
  let currentStatus: DeviceTiltStatus = 'prompt';
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let baseline: Quaternion | undefined;
  let previousX = 0;
  let previousY = 0;
  const euler = new Euler(0, 0, 0, 'ZXY');
  const rotation = new Quaternion();
  const screenRotation = new Quaternion();
  const relative = new Quaternion();
  const direction = new Vector3();
  const zAxis = new Vector3(0, 0, 1);

  const status = (value: DeviceTiltStatus) => {
    currentStatus = value;
    if (!disposed) onStatus(paused && value !== 'unsupported' ? 'paused' : value);
  };
  const recenter = () => {
    baseline = undefined;
    previousX = previousY = 0;
    if (!disposed) onTilt(0, 0);
  };
  const normalize = (angle: number) => {
    const degrees = MathUtils.radToDeg(angle);
    const magnitude = Math.abs(degrees);
    return magnitude < 0.7 ? 0 : Math.sign(degrees) * Math.min(1, (magnitude - 0.7) / 13.3);
  };
  const receive = (event: DeviceOrientationEvent) => {
    if (disposed || paused || !enabled || event.beta === null || event.gamma === null
      || !Number.isFinite(event.beta) || !Number.isFinite(event.gamma)
      || (event.alpha !== null && !Number.isFinite(event.alpha))) return;
    if (timeout) { clearTimeout(timeout); timeout = undefined; }
    // Z-X-Y intrinsic rotations, corrected into the current screen axes.
    const angle = window.screen.orientation?.angle
      ?? (window as Window & { orientation?: number }).orientation ?? 0;
    euler.set(MathUtils.degToRad(event.beta), MathUtils.degToRad(event.gamma), MathUtils.degToRad(event.alpha ?? 0), 'ZXY');
    rotation.setFromEuler(euler).multiply(screenRotation.setFromAxisAngle(zAxis, -MathUtils.degToRad(angle)));
    if (!baseline) { baseline = rotation.clone().invert(); status('active'); }
    relative.copy(baseline).multiply(rotation);
    direction.set(0, 0, 1).applyQuaternion(relative);
    const x = normalize(Math.atan2(direction.x, direction.z));
    const y = normalize(Math.atan2(direction.y, direction.z));
    // Ignore small sensor noise so a stationary phone can stop rendering.
    if (Math.abs(x - previousX) > 0.02 || Math.abs(y - previousY) > 0.02) {
      previousX = x; previousY = y;
      onTilt(x, y);
    }
  };
  const detach = () => {
    if (timeout) { clearTimeout(timeout); timeout = undefined; }
    window.removeEventListener('deviceorientation', receive);
    window.removeEventListener('orientationchange', recenter);
    window.screen.orientation?.removeEventListener('change', recenter);
    listening = false;
  };
  const attach = () => {
    if (disposed || paused || listening || !enabled) return;
    recenter();
    listening = true;
    status('requesting');
    window.addEventListener('deviceorientation', receive, { passive: true });
    window.addEventListener('orientationchange', recenter);
    window.screen.orientation?.addEventListener('change', recenter);
    timeout = setTimeout(() => {
      detach(); enabled = false; status('unavailable');
    }, 3500);
  };
  const enable = async () => {
    if (!supported || disposed || requesting) return;
    requesting = true;
    status('requesting');
    try {
      // Invoke synchronously from the button gesture before the first await.
      if (!permissionGranted && orientation.requestPermission) {
        const result = await orientation.requestPermission();
        if (result !== 'granted') { status('denied'); return; }
      }
      permissionGranted = true;
      if (disposed) return;
      enabled = true;
      if (paused) status('requesting');
      else attach();
    } catch {
      status('denied');
    } finally {
      requesting = false;
    }
  };
  const controls: DeviceTiltControls = {
    enable, recenter,
    setPaused(value) {
      if (disposed || value === paused) return;
      paused = value;
      if (paused) { detach(); recenter(); status(currentStatus); }
      else if (enabled) attach();
      else status(currentStatus);
    },
    dispose() { if (!disposed) { disposed = true; detach(); } }
  };
  if (!supported) status('unsupported');
  else if (permissionGranted || !orientation.requestPermission) void enable();
  else status('prompt');
  return controls;
};
