import { describe, expect, it } from 'vitest';
import { getSmartCardTargetIndex } from '../src/domain/navigation';

describe('smart card navigation', () => {
  it('moves down to the next card after the current scroll position', () => {
    expect(getSmartCardTargetIndex([120, 440, 760], 130, 'down')).toBe(1);
  });

  it('moves down to the first card when the viewport is above every card', () => {
    expect(getSmartCardTargetIndex([120, 440, 760], 0, 'down')).toBe(0);
  });

  it('stays on the last card when moving down at the end', () => {
    expect(getSmartCardTargetIndex([120, 440, 760], 900, 'down')).toBe(2);
  });

  it('moves up to the previous card before the current scroll position', () => {
    expect(getSmartCardTargetIndex([120, 440, 760], 740, 'up')).toBe(1);
  });

  it('stays on the first card when moving up at the top', () => {
    expect(getSmartCardTargetIndex([120, 440, 760], 100, 'up')).toBe(0);
  });

  it('returns null when there are no cards', () => {
    expect(getSmartCardTargetIndex([], 400, 'down')).toBeNull();
  });
});
