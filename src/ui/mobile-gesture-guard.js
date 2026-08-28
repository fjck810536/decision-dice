const TAP_WINDOW_MS = 360;
const TAP_RADIUS_PX = 38;
const MOVE_TOLERANCE_PX = 14;

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function actionableFrom(target) {
  if (!(target instanceof Element)) return null;
  return target.closest('button, summary, [role="button"], input[type="button"], input[type="submit"]');
}

function canActivate(element) {
  if (!element) return false;
  if ('disabled' in element && element.disabled) return false;
  return element.getAttribute('aria-disabled') !== 'true';
}

/**
 * iOS Safari can still perform double-tap zoom even when touch-action:
 * manipulation is applied broadly. This guard handles the browser gesture at
 * the touch-event layer while preserving ordinary scroll and multi-touch
 * pinch zoom.
 *
 * On the second rapid single-finger tap we prevent Safari's native default.
 * If the tap landed on an actionable control, we synthesize exactly the
 * second activation so fast repeat tapping still behaves like two taps.
 */
export function installDoubleTapZoomGuard() {
  let start = null;
  let multiTouch = false;
  let lastTap = null;

  const resetTap = () => {
    lastTap = null;
  };

  document.addEventListener('touchstart', (event) => {
    if (event.touches.length !== 1) {
      multiTouch = true;
      start = null;
      resetTap();
      return;
    }

    if (multiTouch) return;
    const touch = event.touches[0];
    start = {
      x: touch.clientX,
      y: touch.clientY,
      target: event.target,
      moved: false,
    };
  }, { passive: true, capture: true });

  document.addEventListener('touchmove', (event) => {
    if (event.touches.length > 1) {
      multiTouch = true;
      start = null;
      resetTap();
      return;
    }
    if (!start || event.touches.length !== 1) return;
    const touch = event.touches[0];
    if (distance(start, { x: touch.clientX, y: touch.clientY }) > MOVE_TOLERANCE_PX) {
      start.moved = true;
    }
  }, { passive: true, capture: true });

  document.addEventListener('touchend', (event) => {
    if (multiTouch) {
      if (event.touches.length === 0) multiTouch = false;
      start = null;
      resetTap();
      return;
    }

    if (!start || start.moved || event.changedTouches.length !== 1) {
      start = null;
      return;
    }

    const touch = event.changedTouches[0];
    const tap = {
      time: performance.now(),
      x: touch.clientX,
      y: touch.clientY,
      target: event.target,
    };

    const isSecondTap = Boolean(
      lastTap
      && tap.time - lastTap.time <= TAP_WINDOW_MS
      && distance(tap, lastTap) <= TAP_RADIUS_PX
    );

    if (!isSecondTap) {
      lastTap = tap;
      start = null;
      return;
    }

    // This is the part that actually blocks Safari's double-tap zoom.
    event.preventDefault();

    // Do not leave the second tap "dead" on controls: the first tap gets its
    // normal native click; the prevented second tap is recreated once here.
    const actionable = actionableFrom(tap.target);
    if (canActivate(actionable)) actionable.click();

    resetTap();
    start = null;
  }, { passive: false, capture: true });

  document.addEventListener('touchcancel', () => {
    start = null;
    multiTouch = false;
    resetTap();
  }, { passive: true, capture: true });
}
