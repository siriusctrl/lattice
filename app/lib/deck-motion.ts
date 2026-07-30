export type DeckHintSide = "left" | "right";

export const DECK_SUFFIX_EXIT_DURATION_SECONDS = 0.4;
export const DECK_SUFFIX_COMMIT_DELAY_MS = 420;
export const MOBILE_DECK_HANDOFF_DURATION_SECONDS = 0.28;
export const MOBILE_DECK_HANDOFF_COMMIT_DELAY_MS = 300;

export type MobileDeckTransition = {
  fromIndex: number;
  toIndex: number;
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
    /*
     * Compact Cards are `viewportWidth - 56px` wide. Rest adjacent sheets
     * where their scaled edges meet the centered sheet instead of sending the
     * outgoing Card off-screen and pulling it back after the z-index handoff.
     * The one-pixel overlap prevents a subpixel seam while keeping the surfaces
     * visually disjoint when stacking order changes.
     */
    const compactCardWidth = Math.max(264, viewportWidth - 56);
    const centeredScale = 0.93;
    const adjacentScale = 0.86;
    const previewTravel =
      (compactCardWidth * (centeredScale + adjacentScale)) / 2 - 1;
    const getPreviewState = (focusIndex: number) => {
      const focusDistance = index - focusIndex;
      const absoluteFocusDistance = Math.abs(focusDistance);
      return {
        x:
          focusDistance === 0
            ? 0
            : Math.sign(focusDistance) *
              (previewTravel +
                Math.max(0, absoluteFocusDistance - 1) * 8),
        y:
          focusDistance === 0
            ? 9
            : 22 + Math.min(absoluteFocusDistance, 4) * 2,
        scale:
          focusDistance === 0
            ? centeredScale
            : Math.max(
                0.82,
                adjacentScale -
                  Math.max(0, absoluteFocusDistance - 1) * 0.008,
              ),
        rotate:
          focusDistance === 0
            ? 0
            : Math.sign(focusDistance) *
              Math.min(3.4, 1.7 + absoluteFocusDistance * 0.42),
        opacity: absoluteFocusDistance > 4 ? 0 : 1,
        zIndex:
          focusDistance === 0 ? 130 : 112 - absoluteFocusDistance,
      };
    };

    if (mobileTransition) {
      const originState = getPreviewState(mobileTransition.fromIndex);
      const targetState = getPreviewState(mobileTransition.toIndex);
      if (index === mobileTransition.fromIndex) {
        return {
          x: targetState.x,
          y: targetState.y,
          scale: targetState.scale,
          baseRotate: targetState.rotate,
          leftFanRotate: 0,
          rightFanRotate: 0,
          opacity: 1,
          zIndex: 140,
        };
      }

      const transitionState =
        index === mobileTransition.toIndex ? targetState : originState;
      return {
        x: transitionState.x,
        y: transitionState.y,
        scale: transitionState.scale,
        baseRotate: transitionState.rotate,
        leftFanRotate: 0,
        rightFanRotate: 0,
        opacity: transitionState.opacity,
        zIndex:
          index === mobileTransition.toIndex
            ? 124
            : Math.min(108, originState.zIndex),
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
      Math.abs(mobileSwipeDelta) /
        Math.max(132, Math.min(174, previewTravel * 0.55)),
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
        : 0;
    const previewState = isCurrent
      ? {
          x: baseState.x + mobileSwipeDelta * 0.96 + boundaryPull,
          y: baseState.y + swipeProgress * 4,
          scale: baseState.scale - swipeProgress * 0.008,
          rotate:
            baseState.rotate +
            (mobileSwipeDelta / Math.max(320, viewportWidth)) * 2.8,
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
