export type DeckHintSide = "left" | "right";

export type DeckMotionContext = {
  activeIndex: number;
  stackLength: number;
  compact: boolean;
  mobileSwiping: boolean;
  mobileSwipeDelta: number;
  viewportWidth: number;
  hintSide: DeckHintSide | null;
  previewFocused: boolean;
  previewIndex: number;
  hoverIndex: number | null;
  desktopGap: number;
  progress: number;
  spread: boolean;
};

export type CardMotionState = {
  x: number;
  y: number;
  scale: number;
  baseRotate: number;
  leftFanRotate: number;
  rightFanRotate: number;
  opacity: number;
  zIndex: number;
};

const clamp = (value: number, minimum = 0, maximum = 1) =>
  Math.min(maximum, Math.max(minimum, value));

const mix = (from: number, to: number, progress: number) =>
  from + (to - from) * progress;

export function getCardMotionState(
  index: number,
  context: DeckMotionContext,
): CardMotionState {
  const {
    activeIndex,
    stackLength,
    compact,
    mobileSwiping,
    mobileSwipeDelta,
    viewportWidth,
    hintSide,
    previewFocused,
    previewIndex,
    hoverIndex,
    desktopGap,
    progress,
    spread: deckSpread,
  } = context;
  const distanceFromActive = Math.abs(index - activeIndex);
  const directionFromActive = Math.sign(index - activeIndex);
  const compactCollapsed = {
    x: directionFromActive * Math.min(distanceFromActive, 5) * 18,
    y: Math.min(distanceFromActive, 5) * 7,
    scale: 1 - Math.min(distanceFromActive, 5) * 0.014,
    rotate: directionFromActive * Math.min(distanceFromActive, 5) * 0.7,
    opacity: distanceFromActive > 4 ? 0 : 1,
    zIndex: 80 - distanceFromActive,
  };
  const desktopCollapsed = {
    x: 0,
    y: 0,
    scale: 1,
    rotate: 0,
    opacity: distanceFromActive > 6 ? 0 : 1,
    zIndex: 80 - distanceFromActive,
  };
  const collapsed = compact ? compactCollapsed : desktopCollapsed;
  const fanAngle = Math.min(
    7.2,
    1.65 + Math.max(0, distanceFromActive - 1) * 1.75,
  );
  const dormantFanAngle = Math.min(1.1, distanceFromActive * 0.22);
  const leftFanRotate =
    !compact && index < activeIndex
      ? hintSide === "left"
        ? -fanAngle
        : -dormantFanAngle
      : 0;
  const rightFanRotate =
    !compact && index > activeIndex
      ? hintSide === "right"
        ? fanAngle
        : dormantFanAngle
      : 0;

  if (compact && mobileSwiping) {
    const swipeProgress = clamp(
      Math.abs(mobileSwipeDelta) / (viewportWidth * 0.55),
    );
    const targetIndex = activeIndex + (mobileSwipeDelta < 0 ? 1 : -1);
    if (index === activeIndex) {
      collapsed.x = mobileSwipeDelta * 0.88;
      collapsed.y = 0;
      collapsed.scale = 1 - swipeProgress * 0.045;
      collapsed.rotate = mobileSwipeDelta / 92;
      collapsed.opacity = 1 - swipeProgress * 0.18;
    } else if (index === targetIndex) {
      collapsed.x = mix(collapsed.x, 0, swipeProgress);
      collapsed.y = mix(collapsed.y, 0, swipeProgress);
      collapsed.scale = mix(collapsed.scale, 1, swipeProgress);
      collapsed.rotate = mix(collapsed.rotate, 0, swipeProgress);
      collapsed.opacity = 1;
    }
  }

  const center = (stackLength - 1) / 2;
  const centerDistance = index - center;
  const focusDistance = index - previewIndex;
  const absoluteFocusDistance = Math.abs(focusDistance);
  const spreadState = previewFocused
    ? {
        x:
          focusDistance === 0
            ? 0
            : Math.sign(focusDistance) *
              (94 + (absoluteFocusDistance - 1) * 54),
        y:
          focusDistance === 0
            ? 7
            : 25 + absoluteFocusDistance * 6,
        scale:
          focusDistance === 0
            ? 0.978
            : Math.max(0.86, 0.925 - absoluteFocusDistance * 0.012),
        rotate:
          focusDistance === 0
            ? 0
            : Math.sign(focusDistance) *
              (0.85 + absoluteFocusDistance * 0.34),
        opacity: absoluteFocusDistance > 6 ? 0 : 1,
        zIndex: focusDistance === 0 ? 110 : 88 - absoluteFocusDistance,
      }
    : {
        x: centerDistance * desktopGap,
        y: 13 + Math.abs(centerDistance) * 2.4,
        scale: index === (hoverIndex ?? previewIndex) ? 0.965 : 0.945,
        rotate: centerDistance * 0.52,
        opacity: 1,
        zIndex:
          index === activeIndex
            ? 100
            : 80 - distanceFromActive,
      };

  return {
    x: mix(collapsed.x, spreadState.x, progress),
    y: mix(collapsed.y, spreadState.y, progress),
    scale: mix(collapsed.scale, spreadState.scale, progress),
    baseRotate: mix(collapsed.rotate, spreadState.rotate, progress),
    leftFanRotate: mix(leftFanRotate, 0, progress),
    rightFanRotate: mix(rightFanRotate, 0, progress),
    opacity: mix(collapsed.opacity, spreadState.opacity, progress),
    zIndex: deckSpread ? spreadState.zIndex : collapsed.zIndex,
  };
}
