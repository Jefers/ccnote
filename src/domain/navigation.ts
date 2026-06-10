export type CardDirection = 'up' | 'down';

export function getSmartCardTargetIndex(cardTops: readonly number[], scrollY: number, direction: CardDirection): number | null {
  if (cardTops.length === 0) return null;

  const threshold = scrollY + 12;

  if (direction === 'down') {
    const nextIndex = cardTops.findIndex((top) => top > threshold);
    return nextIndex === -1 ? cardTops.length - 1 : nextIndex;
  }

  for (let index = cardTops.length - 1; index >= 0; index -= 1) {
    if (cardTops[index] < scrollY - 12) return index;
  }

  return 0;
}
