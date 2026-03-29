import { useCallback, useLayoutEffect, useRef, useState } from "react";

interface BreadcrumbMeasurementsState {
  containerWidth: number;
  entryWidths: Record<string, number>;
  overflowWidths: Record<number, number>;
}

function areWidthMapsEqual(left: Record<string | number, number>, right: Record<string | number, number>) {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) {
    return false;
  }

  return leftKeys.every((key) => left[key] === right[key]);
}

function areMeasurementsEqual(left: BreadcrumbMeasurementsState, right: BreadcrumbMeasurementsState) {
  return (
    left.containerWidth === right.containerWidth &&
    areWidthMapsEqual(left.entryWidths, right.entryWidths) &&
    areWidthMapsEqual(left.overflowWidths, right.overflowWidths)
  );
}

export function useBreadcrumbMeasurements(dependencies: readonly unknown[]) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const entryNodesRef = useRef(new Map<string, HTMLElement>());
  const overflowNodesRef = useRef(new Map<number, HTMLElement>());
  const [measurements, setMeasurements] = useState<BreadcrumbMeasurementsState>({
    containerWidth: 0,
    entryWidths: {},
    overflowWidths: {},
  });

  const collectMeasurements = useCallback(() => {
    const nextMeasurements: BreadcrumbMeasurementsState = {
      containerWidth: Math.ceil(containerRef.current?.clientWidth ?? 0),
      entryWidths: {},
      overflowWidths: {},
    };

    for (const [entryKey, node] of entryNodesRef.current) {
      nextMeasurements.entryWidths[entryKey] = Math.ceil(node.getBoundingClientRect().width);
    }

    for (const [hiddenCount, node] of overflowNodesRef.current) {
      nextMeasurements.overflowWidths[hiddenCount] = Math.ceil(node.getBoundingClientRect().width);
    }

    setMeasurements((previousMeasurements) => (areMeasurementsEqual(previousMeasurements, nextMeasurements) ? previousMeasurements : nextMeasurements));
  }, []);

  const setEntryMeasureNode = useCallback((entryKey: string, node: HTMLElement | null) => {
    if (node) {
      entryNodesRef.current.set(entryKey, node);
      return;
    }

    entryNodesRef.current.delete(entryKey);
  }, []);

  const setOverflowMeasureNode = useCallback((hiddenCount: number, node: HTMLElement | null) => {
    if (node) {
      overflowNodesRef.current.set(hiddenCount, node);
      return;
    }

    overflowNodesRef.current.delete(hiddenCount);
  }, []);

  useLayoutEffect(() => {
    collectMeasurements();
    const animationFrameId = window.requestAnimationFrame(() => {
      collectMeasurements();
    });
    let cancelled = false;
    const fontsReady = document.fonts?.ready;
    fontsReady?.then(() => {
      if (!cancelled) {
        collectMeasurements();
      }
    });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(animationFrameId);
    };
  }, [collectMeasurements, ...dependencies]);

  useLayoutEffect(() => {
    if (!containerRef.current) {
      return;
    }

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", collectMeasurements);
      return () => {
        window.removeEventListener("resize", collectMeasurements);
      };
    }

    const resizeObserver = new ResizeObserver(() => {
      collectMeasurements();
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [collectMeasurements, ...dependencies]);

  return {
    containerRef,
    measurements,
    setEntryMeasureNode,
    setOverflowMeasureNode,
  };
}
