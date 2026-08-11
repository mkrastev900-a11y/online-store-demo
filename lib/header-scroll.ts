export type HeaderScrollDirection = "up" | "down" | null;

export type HeaderScrollState = {
  compact: boolean;
  lastY: number;
  direction: HeaderScrollDirection;
  directionStartY: number;
  lastToggleAt: number;
};

const MIN_SCROLL_DELTA = 2;
const HIDE_AFTER_Y = 180;
const HIDE_TRAVEL = 30;
const SHOW_NEAR_TOP_Y = 72;
const SHOW_TRAVEL = 52;
const LAYOUT_JUMP = 64;
const TOGGLE_SETTLE_MS = 380;

export function createHeaderScrollState(scrollY = 0): HeaderScrollState {
  const y = Math.max(0, scrollY);
  return { compact: false, lastY: y, direction: null, directionStartY: y, lastToggleAt: 0 };
}

export function nextHeaderScrollState(
  state: HeaderScrollState,
  scrollY: number,
  desktop: boolean,
  now: number,
): HeaderScrollState {
  const y = Math.max(0, scrollY);

  if (!desktop) {
    return { compact: false, lastY: y, direction: null, directionStartY: y, lastToggleAt: state.lastToggleAt };
  }

  const delta = y - state.lastY;
  if (Math.abs(delta) < MIN_SCROLL_DELTA) return { ...state, lastY: y };

  const settling = now - state.lastToggleAt < TOGGLE_SETTLE_MS;
  const layoutMovedAgainstState = Math.abs(delta) >= LAYOUT_JUMP
    && ((state.compact && delta < 0) || (!state.compact && delta > 0));

  if (state.lastToggleAt > 0 && settling && layoutMovedAgainstState) {
    return { ...state, lastY: y, direction: null, directionStartY: y };
  }

  const direction: HeaderScrollDirection = delta > 0 ? "down" : "up";
  const directionStartY = state.direction === direction ? state.directionStartY : state.lastY;
  const travel = direction === "down" ? y - directionStartY : directionStartY - y;
  let compact = state.compact;
  let lastToggleAt = state.lastToggleAt;

  if (!compact && direction === "down" && y >= HIDE_AFTER_Y && travel >= HIDE_TRAVEL) {
    compact = true;
    lastToggleAt = now;
  } else if (compact && (y <= SHOW_NEAR_TOP_Y || (direction === "up" && travel >= SHOW_TRAVEL))) {
    compact = false;
    lastToggleAt = now;
  }

  return { compact, lastY: y, direction, directionStartY, lastToggleAt };
}
