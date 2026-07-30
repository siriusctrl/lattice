"use client";

import {
  Dispatch,
  PointerEvent as ReactPointerEvent,
  SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  DeckHintSide,
  MOBILE_DECK_HANDOFF_COMMIT_DELAY_MS,
  MobileDeckTransition,
} from "@/app/lib/deck-motion";

type MobileSwipeState = {
  pointerId: number;
  startX: number;
  horizontal: boolean;
};

type UseMobileDeckOptions = {
  activeIndex: number;
  compact: boolean;
  onClearSelection: () => void;
  previewIndex: number;
  reduceMotion: boolean;
  setPreviewIndex: Dispatch<SetStateAction<number>>;
  stackLength: number;
  viewportWidth: number;
};

const clamp = (value: number, minimum = 0, maximum = 1) =>
  Math.min(maximum, Math.max(minimum, value));

export function useMobileDeck({
  activeIndex,
  compact,
  onClearSelection,
  previewIndex,
  reduceMotion,
  setPreviewIndex,
  stackLength,
  viewportWidth,
}: UseMobileDeckOptions) {
  const [mobileDeckPreview, setMobileDeckPreview] = useState(false);
  const [mobileSwipeDelta, setMobileSwipeDelta] = useState(0);
  const [mobileSwiping, setMobileSwiping] = useState(false);
  const [mobileTransition, setMobileTransition] =
    useState<MobileDeckTransition | null>(null);
  const mobileSwipe = useRef<MobileSwipeState | null>(null);
  const mobilePendingSwipeDelta = useRef(0);
  const mobileSwipeFrame = useRef<number | null>(null);
  const mobileTransitionTimer = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const mobileSuppressNextClick = useRef(false);
  const mobileSuppressClickFrame = useRef<number | null>(null);

  const clearClickSuppression = useCallback(() => {
    mobileSuppressNextClick.current = false;
    if (mobileSuppressClickFrame.current !== null) {
      window.cancelAnimationFrame(mobileSuppressClickFrame.current);
      mobileSuppressClickFrame.current = null;
    }
  }, []);

  const clearSwipeFrame = useCallback(() => {
    mobilePendingSwipeDelta.current = 0;
    if (mobileSwipeFrame.current !== null) {
      window.cancelAnimationFrame(mobileSwipeFrame.current);
      mobileSwipeFrame.current = null;
    }
  }, []);

  const resetMobileDeck = useCallback(() => {
    mobileSwipe.current = null;
    clearSwipeFrame();
    if (mobileTransitionTimer.current) {
      clearTimeout(mobileTransitionTimer.current);
      mobileTransitionTimer.current = null;
    }
    setMobileSwipeDelta(0);
    setMobileSwiping(false);
    setMobileTransition(null);
    setMobileDeckPreview(false);
    clearClickSuppression();
  }, [clearClickSuppression, clearSwipeFrame]);

  const cancelDeckSwipe = useCallback(() => {
    if (mobileTransition) return;
    mobileSwipe.current = null;
    clearSwipeFrame();
    setMobileSwipeDelta(0);
    setMobileSwiping(false);
  }, [clearSwipeFrame, mobileTransition]);

  useEffect(() => {
    const compactViewport = window.matchMedia("(max-width: 720px)");
    const resetWhenWide = (event: MediaQueryListEvent) => {
      if (!event.matches) resetMobileDeck();
    };
    compactViewport.addEventListener("change", resetWhenWide);
    return () =>
      compactViewport.removeEventListener("change", resetWhenWide);
  }, [resetMobileDeck]);

  useEffect(() => {
    if (!mobileDeckPreview) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      resetMobileDeck();
      setPreviewIndex(activeIndex);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [
    activeIndex,
    mobileDeckPreview,
    resetMobileDeck,
    setPreviewIndex,
  ]);

  useEffect(
    () => () => {
      if (mobileSuppressClickFrame.current !== null) {
        window.cancelAnimationFrame(mobileSuppressClickFrame.current);
      }
      if (mobileSwipeFrame.current !== null) {
        window.cancelAnimationFrame(mobileSwipeFrame.current);
      }
      if (mobileTransitionTimer.current) {
        clearTimeout(mobileTransitionTimer.current);
      }
    },
    [],
  );

  const handleMobileDeckSelection = useCallback(
    (index: number) => {
      if (!mobileDeckPreview) return false;
      if (mobileTransition) return true;
      if (mobileSuppressNextClick.current) {
        clearClickSuppression();
        return true;
      }
      if (index !== previewIndex) {
        setPreviewIndex(index);
        setMobileSwipeDelta(0);
        return true;
      }
      return false;
    },
    [
      clearClickSuppression,
      mobileDeckPreview,
      mobileTransition,
      previewIndex,
      setPreviewIndex,
    ],
  );

  const openMobileDeckPreview = useCallback(
    (side: DeckHintSide, focusPreview = false) => {
      if (!compact || stackLength <= 1) return;
      if (side === "left" && activeIndex <= 0) return;
      if (side === "right" && activeIndex >= stackLength - 1) return;
      setPreviewIndex(activeIndex);
      clearSwipeFrame();
      setMobileSwipeDelta(0);
      setMobileSwiping(false);
      if (mobileTransitionTimer.current) {
        clearTimeout(mobileTransitionTimer.current);
        mobileTransitionTimer.current = null;
      }
      setMobileTransition(null);
      setMobileDeckPreview(true);
      onClearSelection();
      window.getSelection()?.removeAllRanges();
      if (focusPreview) {
        window.requestAnimationFrame(() => {
          document
            .querySelector<HTMLButtonElement>(
              `.deck-card-picker[data-deck-index="${activeIndex}"]`,
            )
            ?.focus({ preventScroll: true });
        });
      }
    },
    [
      activeIndex,
      clearSwipeFrame,
      compact,
      onClearSelection,
      setPreviewIndex,
      stackLength,
    ],
  );

  const beginDeckSwipe = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (
        !event.isPrimary ||
        (event.pointerType === "mouse" && event.button !== 0) ||
        !compact ||
        !mobileDeckPreview ||
        mobileTransition ||
        stackLength <= 1
      ) {
        return;
      }
      mobileSwipe.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        horizontal: false,
      };
    },
    [compact, mobileDeckPreview, mobileTransition, stackLength],
  );

  const updateDeckSwipe = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const swipe = mobileSwipe.current;
      if (!swipe || swipe.pointerId !== event.pointerId) return;
      const deltaX = event.clientX - swipe.startX;
      if (!swipe.horizontal) {
        if (Math.abs(deltaX) < 4) return;
        swipe.horizontal = true;
        event.currentTarget.setPointerCapture(event.pointerId);
        setMobileSwiping(true);
        onClearSelection();
        window.getSelection()?.removeAllRanges();
      }
      event.preventDefault();
      const movingPastStart = previewIndex === 0 && deltaX > 0;
      const movingPastEnd =
        previewIndex === stackLength - 1 && deltaX < 0;
      const resistedDelta =
        movingPastStart || movingPastEnd ? deltaX * 0.24 : deltaX;
      mobilePendingSwipeDelta.current = clamp(
        resistedDelta,
        -viewportWidth * 0.72,
        viewportWidth * 0.72,
      );
      if (mobileSwipeFrame.current === null) {
        mobileSwipeFrame.current = window.requestAnimationFrame(() => {
          setMobileSwipeDelta(mobilePendingSwipeDelta.current);
          mobileSwipeFrame.current = null;
        });
      }
    },
    [
      onClearSelection,
      previewIndex,
      stackLength,
      viewportWidth,
    ],
  );

  const finishDeckSwipe = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const swipe = mobileSwipe.current;
      if (
        !swipe ||
        swipe.pointerId !== event.pointerId ||
        !compact ||
        !mobileDeckPreview ||
        mobileTransition
      ) {
        return;
      }
      const delta = event.clientX - swipe.startX;
      mobileSwipe.current = null;
      clearSwipeFrame();
      setMobileSwipeDelta(0);
      setMobileSwiping(false);
      if (swipe.horizontal) {
        mobileSuppressNextClick.current = true;
        if (mobileSuppressClickFrame.current !== null) {
          window.cancelAnimationFrame(mobileSuppressClickFrame.current);
        }
        mobileSuppressClickFrame.current = window.requestAnimationFrame(
          () => {
            mobileSuppressNextClick.current = false;
            mobileSuppressClickFrame.current = null;
          },
        );
      }
      if (!swipe.horizontal || Math.abs(delta) < 44) return;
      const nextIndex = clamp(
        previewIndex + (delta < 0 ? 1 : -1),
        0,
        stackLength - 1,
      );
      if (nextIndex !== previewIndex) {
        if (reduceMotion) {
          setPreviewIndex(nextIndex);
          return;
        }
        setMobileTransition({
          fromIndex: previewIndex,
          toIndex: nextIndex,
        });
        mobileTransitionTimer.current = setTimeout(() => {
          setPreviewIndex(nextIndex);
          setMobileTransition(null);
          mobileTransitionTimer.current = null;
        }, MOBILE_DECK_HANDOFF_COMMIT_DELAY_MS);
      }
    },
    [
      compact,
      clearSwipeFrame,
      mobileDeckPreview,
      mobileTransition,
      previewIndex,
      reduceMotion,
      setPreviewIndex,
      stackLength,
    ],
  );

  const loseDeckPointerCapture = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.target !== event.currentTarget) return;
      cancelDeckSwipe();
    },
    [cancelDeckSwipe],
  );

  return {
    beginDeckSwipe,
    cancelDeckSwipe,
    finishDeckSwipe,
    handleMobileDeckSelection,
    loseDeckPointerCapture,
    mobileDeckPreview,
    mobileSwipeDelta,
    mobileSwiping,
    mobileTransition,
    openMobileDeckPreview,
    resetMobileDeck,
    updateDeckSwipe,
  };
}
