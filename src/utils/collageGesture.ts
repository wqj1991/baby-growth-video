export const PRESS_MOVE_THRESHOLD_PX = 4;
export const LONG_PRESS_MS = 300;
export const SNAP_THRESHOLD_PX = 24;

export interface Point {
  x: number;
  y: number;
}

export interface RegionCenter {
  regionIdx: number;
  centerX: number;
  centerY: number;
}

export function distance(a: Point, b: Point): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function shouldEnterLongPress(moveDistance: number, elapsedMs: number): boolean {
  return moveDistance <= PRESS_MOVE_THRESHOLD_PX && elapsedMs >= LONG_PRESS_MS;
}

export function shouldEnterPan(moveDistance: number): boolean {
  return moveDistance > PRESS_MOVE_THRESHOLD_PX;
}

export function pickSwapCandidate(
  selfRegionIdx: number,
  pointer: Point,
  centers: RegionCenter[],
): { regionIdx: number; distance: number } | null {
  const candidates = centers
    .filter((c) => c.regionIdx !== selfRegionIdx)
    .map((c) => ({
      regionIdx: c.regionIdx,
      distance: distance(pointer, { x: c.centerX, y: c.centerY }),
    }))
    .sort((a, b) => (a.distance - b.distance) || (a.regionIdx - b.regionIdx));

  const nearest = candidates[0];
  if (!nearest || nearest.distance > SNAP_THRESHOLD_PX) {
    return null;
  }
  return nearest;
}
