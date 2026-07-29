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

export type DeckTransitionState = {
  removingFromIndex: number;
};

export type BeginDeckTransitionInput = {
  nextStack: string[];
  nextActiveIndex: number;
  removingFromIndex: number;
  activeIndexDuringExit: number;
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

  useEffect(
    () => () => {
      if (transitionTimer.current) {
        clearTimeout(transitionTimer.current);
      }
    },
    [],
  );

  const beginDeckTransition = useCallback(
    ({
      removingFromIndex,
      nextStack,
      nextActiveIndex,
      activeIndexDuringExit,
      focusComposerAfter = false,
    }: BeginDeckTransitionInput) => {
      if (deckTransition) return;

      const finish = () => {
        setStack(nextStack);
        collapseDeckTo(nextActiveIndex);
        setDeckTransition(null);
        transitionTimer.current = null;

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

      setDeckTransition({ removingFromIndex });
      collapseDeckTo(activeIndexDuringExit);
      transitionTimer.current = setTimeout(
        finish,
        DECK_SUFFIX_COMMIT_DELAY_MS,
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

  return { beginDeckTransition, deckTransition };
}
