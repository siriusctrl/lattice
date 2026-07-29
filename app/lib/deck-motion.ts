export type DeckHintSide = "left" | "right";

export const DECK_SUFFIX_EXIT_DURATION_SECONDS = 0.42;
export const DECK_SUFFIX_COMMIT_DELAY_MS = 440;

export type DeckMotionContext = {
  activeIndex: number;
  stackLength: number;
  compact: boolean;
  mobilePreview: boolean;
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
    mobilePreview,
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
    x:
      directionFromActive *
      Math.min(
        24,
        distanceFromActive === 0
          ? 0
          : 12 + (distanceFromActive - 1) * 4,
      ),
    y: Math.min(distanceFromActive, 5) * 7,
    scale: 1 - Math.min(distanceFromActive, 5) * 0.01,
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
  const dormantFanAngle = Math.min(3.8, distanceFromActive * 0.84);
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

  if (compact && mobilePreview) {
    const previewTravel = Math.max(188, viewportWidth * 0.61);
    const getPreviewState = (focusIndex: number) => {
      const focusDistance = index - focusIndex;
      const absoluteFocusDistance = Math.abs(focusDistance);
      return {
        x:
          focusDistance === 0
            ? 0
            : Math.sign(focusDistance) *
              (previewTravel +
                Math.max(0, absoluteFocusDistance - 1) * 34),
        y:
          focusDistance === 0
            ? 11
            : 23 + absoluteFocusDistance * 5,
        scale:
          focusDistance === 0
            ? 0.9
            : Math.max(0.78, 0.85 - absoluteFocusDistance * 0.016),
        rotate:
          focusDistance === 0
            ? 0
            : Math.sign(focusDistance) *
              Math.min(4.6, 2.15 + absoluteFocusDistance * 0.62),
        opacity: absoluteFocusDistance > 4 ? 0 : 1,
        zIndex:
          absoluteFocusDistance === 1
            ? 114
            : focusDistance === 0
              ? 110
              : 101 - absoluteFocusDistance,
      };
    };
    const baseState = getPreviewState(previewIndex);
    const swipeDirection =
      mobileSwipeDelta === 0 ? 0 : mobileSwipeDelta < 0 ? 1 : -1;
    const targetIndex = Math.min(
      stackLength - 1,
      Math.max(0, previewIndex + swipeDirection),
    );
    const swipeProgress = Math.min(
      1,
      Math.abs(mobileSwipeDelta) / Math.max(86, viewportWidth * 0.24),
    );
    const targetState = getPreviewState(targetIndex);
    const movingCard =
      index === previewIndex || index === targetIndex;
    const interpolation = movingCard
      ? swipeProgress
      : swipeProgress * 0.16;
    const boundaryPull =
      targetIndex === previewIndex ? mobileSwipeDelta * 0.34 : 0;
    const previewState = {
      x: mix(baseState.x, targetState.x, interpolation) + boundaryPull,
      y: mix(baseState.y, targetState.y, interpolation),
      scale: mix(baseState.scale, targetState.scale, interpolation),
      rotate: mix(baseState.rotate, targetState.rotate, interpolation),
      opacity: mix(baseState.opacity, targetState.opacity, interpolation),
      zIndex:
        movingCard && swipeProgress >= 0.46
          ? targetState.zIndex
          : baseState.zIndex,
    };

    return {
      x: previewState.x,
      y: previewState.y,
      scale: previewState.scale,
      baseRotate: previewState.rotate,
      leftFanRotate: 0,
      rightFanRotate: 0,
      opacity: previewState.opacity,
      zIndex: previewState.zIndex,
    };
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
