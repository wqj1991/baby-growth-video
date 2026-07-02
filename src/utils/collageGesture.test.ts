import { describe, expect, it } from 'vitest';
import {
  PRESS_MOVE_THRESHOLD_PX,
  LONG_PRESS_MS,
  SNAP_THRESHOLD_PX,
  distance,
  shouldEnterLongPress,
  shouldEnterPan,
  pickSwapCandidate,
} from './collageGesture';

describe('collageGesture thresholds', () => {
  it('uses agreed constants', () => {
    expect(PRESS_MOVE_THRESHOLD_PX).toBe(4);
    expect(LONG_PRESS_MS).toBe(300);
    expect(SNAP_THRESHOLD_PX).toBe(24);
  });

  it('allows long press only when movement <= 4px', () => {
    expect(shouldEnterLongPress(3.9, 300)).toBe(true);
    expect(shouldEnterLongPress(4, 300)).toBe(true);
    expect(shouldEnterLongPress(4.01, 300)).toBe(false);
  });

  it('enters pan when movement > 4px before long press', () => {
    expect(shouldEnterPan(4.01)).toBe(true);
    expect(shouldEnterPan(4)).toBe(false);
  });
});

describe('swap candidate picking', () => {
  it('picks nearest non-self target within 24px', () => {
    const candidate = pickSwapCandidate(
      1,
      { x: 100, y: 100 },
      [
        { regionIdx: 0, centerX: 200, centerY: 200 },
        { regionIdx: 1, centerX: 101, centerY: 101 },
        { regionIdx: 2, centerX: 110, centerY: 108 },
      ],
    );

    expect(candidate?.regionIdx).toBe(2);
  });

  it('returns null when all targets are outside threshold', () => {
    const candidate = pickSwapCandidate(
      0,
      { x: 0, y: 0 },
      [{ regionIdx: 2, centerX: 100, centerY: 100 }],
    );
    expect(candidate).toBeNull();
  });

  it('distance helper returns euclidean distance', () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });
});
