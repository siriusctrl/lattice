export type DeckHintSide = "left" | "right";

export const DECK_SUFFIX_EXIT_DURATION_SECONDS = 0.4;
export const DECK_SUFFIX_COMMIT_DELAY_MS = 420;
export const MOBILE_DECK_HANDOFF_DURATION_SECONDS = 0.34;
export const MOBILE_DECK_HANDOFF_COMMIT_DELAY_MS = 360;

export type MobileDeckTransition = {
  fromIndex: number;
  toIndex: number;
  direction: -1 | 1;
};

export type DeckMotionContext = {
  activeIndex: number;
  stackLength: number;
  compact: boolean;
  mobilePreview: boolean;
  mobileSwipeDelta: number;
  mobileTransition: MobileDeckTransition | null;
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
    mobileTransition,
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
    const previewTravel = Math.max(196, viewportWidth * 0.54);
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
            ? 9
            : 19 + absoluteFocusDistance * 5,
        scale:
          focusDistance === 0
            ? 0.93
            : Math.max(0.78, 0.878 - absoluteFocusDistance * 0.018),
        rotate:
          focusDistance === 0
            ? 0
            : Math.sign(focusDistance) *
              Math.min(4.4, 1.8 + absoluteFocusDistance * 0.56),
        opacity: absoluteFocusDistance > 4 ? 0 : 1,
        zIndex:
          focusDistance === 0 ? 130 : 112 - absoluteFocusDistance,
      };
    };

    if (mobileTransition) {
      const targetState = getPreviewState(mobileTransition.toIndex);
      if (index === mobileTransition.fromIndex) {
        return {
          x: mobileTransition.direction * viewportWidth * 1.08,
          y: 18,
          scale: 0.94,
          baseRotate: mobileTransition.direction * 4.2,
          leftFanRotate: 0,
          rightFanRotate: 0,
          opacity: 1,
          zIndex: 140,
        };
      }

      return {
        x: targetState.x,
        y: targetState.y,
        scale: targetState.scale,
        baseRotate: targetState.rotate,
        leftFanRotate: 0,
        rightFanRotate: 0,
        opacity: targetState.opacity,
        zIndex:
          index === mobileTransition.toIndex
            ? 124
            : Math.min(108, targetState.zIndex),
      };
    }

    const baseState = getPreviewState(previewIndex);
    const swipeDirection =
      mobileSwipeDelta === 0 ? 0 : mobileSwipeDelta < 0 ? 1 : -1;
    const targetIndex = Math.min(
      stackLength - 1,
      Math.max(0, previewIndex + swipeDirection),
    );
    const swipeProgress = Math.min(
      1,
      Math.abs(mobileSwipeDelta) / Math.max(112, viewportWidth * 0.34),
    );
    const targetState = getPreviewState(targetIndex);
    const boundaryPull =
      targetIndex === previewIndex ? mobileSwipeDelta * 0.42 : 0;
    const isCurrent = index === previewIndex;
    const isTarget =
      targetIndex !== previewIndex && index === targetIndex;
    const interpolation = isTarget
      ? swipeProgress
      : isCurrent
        ? 0
        : swipeProgress * 0.14;
    const previewState = isCurrent
      ? {
          x: baseState.x + mobileSwipeDelta * 0.92 + boundaryPull,
          y: baseState.y + swipeProgress * 7,
          scale: baseState.scale - swipeProgress * 0.014,
          rotate:
            baseState.rotate +
            (mobileSwipeDelta / Math.max(320, viewportWidth)) * 4.6,
          opacity: 1,
          zIndex: 140,
        }
      : {
          x: mix(baseState.x, targetState.x, interpolation),
          y: mix(baseState.y, targetState.y, interpolation),
          scale: mix(baseState.scale, targetState.scale, interpolation),
          rotate: mix(baseState.rotate, targetState.rotate, interpolation),
          opacity: mix(
            baseState.opacity,
            targetState.opacity,
            interpolation,
          ),
          zIndex: isTarget ? 124 : Math.min(108, baseState.zIndex),
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
