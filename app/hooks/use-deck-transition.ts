"use client";

import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { DECK_SUFFIX_COMMIT_DELAY_MS } from "@/app/lib/deck-motion";

export type DeckExitOrigin = {
  x: number;
  y: number;
};

export type DeckTransitionState = {
  exitOrigin: DeckExitOrigin | null;
  removingFromIndex: number;
};

export type BeginDeckTransitionInput = {
  nextStack: string[];
  nextActiveIndex: number;
  removingFromIndex: number;
  activeIndexDuringExit: number;
  exitOrigin?: DeckExitOrigin | null;
  focusComposerAfter?: boolean;
};

type UseDeckTransitionInput = {
  collapseDeckTo: (index: number) => void;
  reduceMotion: boolean;
  setStack: Dispatch<SetStateAction<string[]>>;
  stackLength: number;
};

export function useDeckTransition({
  collapseDeckTo,
  reduceMotion,
  setStack,
  stackLength,
}: UseDeckTransitionInput) {
  const [deckTransition, setDeckTransition] =
    useState<DeckTransitionState | null>(null);
  const transitionTimer = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const transitionFinish = useRef<(() => void) | null>(null);
  const exitAnimationComplete = useRef(false);
  const exitPaintFrames = useRef(0);
  const exitFrame = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (transitionTimer.current) {
        clearTimeout(transitionTimer.current);
      }
      if (exitFrame.current !== null) {
        cancelAnimationFrame(exitFrame.current);
      }
    },
    [],
  );

  const finishDeckTransition = useCallback(() => {
    transitionFinish.current?.();
  }, []);

  const observeExitFrame = useCallback(function observeExitFrame() {
    exitPaintFrames.current += 1;
    if (
      exitPaintFrames.current >= 2 &&
      exitAnimationComplete.current
    ) {
      finishDeckTransition();
      return;
    }
    exitFrame.current = requestAnimationFrame(observeExitFrame);
  }, [finishDeckTransition]);

  const markDeckExitStarted = useCallback(() => {
    if (!transitionFinish.current || exitFrame.current !== null) return;
    exitFrame.current = requestAnimationFrame(observeExitFrame);
  }, [observeExitFrame]);

  const markDeckExitComplete = useCallback(() => {
    if (!transitionFinish.current) return;
    exitAnimationComplete.current = true;
    if (exitPaintFrames.current >= 2) finishDeckTransition();
  }, [finishDeckTransition]);

  const beginDeckTransition = useCallback(
    ({
      removingFromIndex,
      nextStack,
      nextActiveIndex,
      activeIndexDuringExit,
      exitOrigin = null,
      focusComposerAfter = false,
    }: BeginDeckTransitionInput) => {
      if (deckTransition) return;

      let committed = false;
      const finish = () => {
        if (committed) return;
        committed = true;
        transitionFinish.current = null;
        exitAnimationComplete.current = false;
        exitPaintFrames.current = 0;
        if (exitFrame.current !== null) {
          cancelAnimationFrame(exitFrame.current);
          exitFrame.current = null;
        }
        if (transitionTimer.current) {
          clearTimeout(transitionTimer.current);
          transitionTimer.current = null;
        }
        setStack(nextStack);
        collapseDeckTo(nextActiveIndex);
        setDeckTransition(null);

        if (focusComposerAfter) {
          window.requestAnimationFrame(() => {
            document
              .querySelector<HTMLInputElement>(
                `[data-deck-index="${nextActiveIndex}"] .card-composer input`,
              )
              ?.focus();
          });
        }
      };

      if (reduceMotion || removingFromIndex >= stackLength) {
        finish();
        return;
      }

      transitionFinish.current = finish;
      exitAnimationComplete.current = false;
      exitPaintFrames.current = 0;
      setDeckTransition({ exitOrigin, removingFromIndex });
      collapseDeckTo(activeIndexDuringExit);
      // The Card's animation-complete callback owns the normal commit. This
      // watchdog only recovers if the animation lifecycle is interrupted.
      transitionTimer.current = setTimeout(
        finish,
        DECK_SUFFIX_COMMIT_DELAY_MS * 4,
      );
    },
    [
      collapseDeckTo,
      deckTransition,
      reduceMotion,
      setStack,
      stackLength,
    ],
  );

  return {
    beginDeckTransition,
    deckTransition,
    markDeckExitComplete,
    markDeckExitStarted,
  };
}
