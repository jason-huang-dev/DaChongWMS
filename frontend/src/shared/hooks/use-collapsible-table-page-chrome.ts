import { type RefObject, useCallback, useEffect, useRef, useState } from "react";

import type { SxProps, Theme } from "@mui/material/styles";

import type { DataTableScrollState } from "@/shared/components/data-table";

interface UseCollapsibleTablePageChromeOptions {
  animationEase?: number;
  collapseStart?: number;
  collapseThreshold?: number;
  fadeDistance?: number;
}

interface UseCollapsibleTablePageChromeResult {
  contentRef: RefObject<HTMLDivElement | null>;
  handleTableScrollStateChange: (state: DataTableScrollState) => void;
  isCollapsed: boolean;
  wrapperRef: RefObject<HTMLDivElement | null>;
  wrapperSx: SxProps<Theme>;
}

const defaultCollapseStart = 16;
const defaultFadeDistance = 180;
const defaultAnimationEase = 0.18;
const defaultCollapseThreshold = 0.98;

/**
 * Standard scroll interaction for sticky-table page chrome.
 *
 * The page chrome waits for a small initial scroll threshold, then eases toward
 * the collapsed state on animation frames rather than scrubbing directly with
 * raw scroll events. That keeps the workspace feeling calm across dense table
 * pages while preserving immediate table-body scrolling.
 */
export function useCollapsibleTablePageChrome({
  animationEase = defaultAnimationEase,
  collapseStart = defaultCollapseStart,
  collapseThreshold = defaultCollapseThreshold,
  fadeDistance = defaultFadeDistance,
}: UseCollapsibleTablePageChromeOptions = {}): UseCollapsibleTablePageChromeResult {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [contentHeight, setContentHeight] = useState<number | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const progressRef = useRef(0);
  const targetProgressRef = useRef(0);

  const applyProgress = useCallback((progress: number) => {
    const node = wrapperRef.current;
    if (!node) {
      return;
    }

    const boundedProgress = Math.min(Math.max(progress, 0), 1);
    if (contentHeight !== null) {
      node.style.height = `${Math.max(contentHeight * (1 - boundedProgress), 0)}px`;
    } else {
      node.style.removeProperty("height");
    }
    node.style.opacity = `${Math.max(1 - boundedProgress, 0)}`;
    node.dataset.collapseProgress = boundedProgress.toFixed(2);
  }, [contentHeight]);

  useEffect(() => {
    const node = contentRef.current;
    if (!node) {
      return;
    }

    const updateHeight = (nextHeight?: number) => {
      const measuredHeight = nextHeight ?? Math.max(node.getBoundingClientRect().height, node.scrollHeight, node.clientHeight);
      if (measuredHeight <= 0) {
        return;
      }
      setContentHeight((previous) => (previous === measuredHeight ? previous : measuredHeight));
    };

    updateHeight();

    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      updateHeight(entries[0]?.contentRect.height);
    });
    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    applyProgress(progressRef.current);
  }, [applyProgress]);

  useEffect(
    () => () => {
      if (animationFrameRef.current !== null && typeof window !== "undefined") {
        window.cancelAnimationFrame(animationFrameRef.current);
      }
    },
    [],
  );

  const animateProgress = useCallback(() => {
    const currentProgress = progressRef.current;
    const targetProgress = targetProgressRef.current;
    const nextProgress =
      Math.abs(targetProgress - currentProgress) < 0.01
        ? targetProgress
        : currentProgress + (targetProgress - currentProgress) * animationEase;

    progressRef.current = nextProgress;
    applyProgress(nextProgress);

    const nextCollapsed = nextProgress >= collapseThreshold;
    setIsCollapsed((previous) => (previous === nextCollapsed ? previous : nextCollapsed));

    if (nextProgress === targetProgress) {
      animationFrameRef.current = null;
      return;
    }

    if (typeof window !== "undefined") {
      animationFrameRef.current = window.requestAnimationFrame(animateProgress);
    }
  }, [animationEase, applyProgress, collapseThreshold]);

  const handleTableScrollStateChange = useCallback(({ scrollTop }: DataTableScrollState) => {
    targetProgressRef.current = Math.min(
      Math.max((scrollTop - collapseStart) / fadeDistance, 0),
      1,
    );

    if (animationFrameRef.current === null && typeof window !== "undefined") {
      animationFrameRef.current = window.requestAnimationFrame(animateProgress);
    }
  }, [animateProgress, collapseStart, fadeDistance]);

  return {
    contentRef,
    handleTableScrollStateChange,
    isCollapsed,
    wrapperRef,
    wrapperSx: {
      overflow: "hidden",
      pointerEvents: isCollapsed ? "none" : "auto",
      willChange: "height, opacity",
    },
  };
}
