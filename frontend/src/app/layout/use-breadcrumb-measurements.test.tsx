import { render, screen, waitFor } from "@testing-library/react";
import { expect, test, vi } from "vitest";

import { useBreadcrumbMeasurements } from "@/app/layout/use-breadcrumb-measurements";

interface MeasurementProbeProps {
  containerWidth: number;
  entryWidths: Array<readonly [string, number]>;
  measurementKey: string;
  overflowWidths?: Array<readonly [number, number]>;
}

function MeasurementProbe({ containerWidth, entryWidths, measurementKey, overflowWidths = [] }: MeasurementProbeProps) {
  const { containerRef, measurements, setEntryMeasureNode, setOverflowMeasureNode } = useBreadcrumbMeasurements([measurementKey]);

  return (
    <div>
      <div data-client-width={containerWidth} ref={containerRef} />
      {entryWidths.map(([entryKey, width]) => (
        <div data-width={width} key={entryKey} ref={(node) => setEntryMeasureNode(entryKey, node)}>
          measure
        </div>
      ))}
      {overflowWidths.map(([hiddenCount, width]) => (
        <button data-width={width} key={hiddenCount} ref={(node) => setOverflowMeasureNode(hiddenCount, node)} type="button">
          overflow
        </button>
      ))}
      <output data-testid="measurements">{JSON.stringify(measurements)}</output>
    </div>
  );
}

function installMeasurementDomMocks() {
  const clientWidthDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientWidth");
  const rectSpy = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    const width = Number(this.getAttribute("data-width") ?? 0);

    return {
      bottom: 24,
      height: 24,
      left: 0,
      right: width,
      top: 0,
      width,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect;
  });

  Object.defineProperty(HTMLElement.prototype, "clientWidth", {
    configurable: true,
    get() {
      return Number(this.getAttribute("data-client-width") ?? 0);
    },
  });

  return () => {
    rectSpy.mockRestore();
    if (clientWidthDescriptor) {
      Object.defineProperty(HTMLElement.prototype, "clientWidth", clientWidthDescriptor);
      return;
    }
    Reflect.deleteProperty(HTMLElement.prototype, "clientWidth");
  };
}

function readMeasurements() {
  return JSON.parse(screen.getByTestId("measurements").textContent ?? "{}") as {
    containerWidth: number;
    entryWidths: Record<string, number>;
    overflowWidths: Record<string, number>;
  };
}

test("drops stale entry widths when the mounted measurement nodes change", async () => {
  const restoreMeasurementDomMocks = installMeasurementDomMocks();

  try {
    const { rerender } = render(
      <MeasurementProbe
        containerWidth={480}
        entryWidths={[
          ["alpha", 100],
          ["beta", 180],
        ]}
        measurementKey="alpha-beta"
        overflowWidths={[[1, 60]]}
      />,
    );

    await waitFor(() => {
      expect(readMeasurements()).toEqual({
        containerWidth: 480,
        entryWidths: {
          alpha: 100,
          beta: 180,
        },
        overflowWidths: {
          1: 60,
        },
      });
    });

    rerender(
      <MeasurementProbe
        containerWidth={480}
        entryWidths={[["alpha", 100]]}
        measurementKey="alpha-only"
        overflowWidths={[[1, 60]]}
      />,
    );

    await waitFor(() => {
      expect(readMeasurements()).toEqual({
        containerWidth: 480,
        entryWidths: {
          alpha: 100,
        },
        overflowWidths: {
          1: 60,
        },
      });
    });
  } finally {
    restoreMeasurementDomMocks();
  }
});

test("remeasures when document fonts finish loading", async () => {
  const restoreMeasurementDomMocks = installMeasurementDomMocks();
  const fontsDescriptor = Object.getOwnPropertyDescriptor(document, "fonts");
  const requestAnimationFrameSpy = vi.spyOn(window, "requestAnimationFrame").mockImplementation(() => 1);
  const cancelAnimationFrameSpy = vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
  let resolveFontsReady!: () => void;
  const fontsReady = new Promise<void>((resolve) => {
    resolveFontsReady = resolve;
  });

  Object.defineProperty(document, "fonts", {
    configurable: true,
    value: {
      ready: fontsReady,
    },
  });

  try {
    const { rerender } = render(
      <MeasurementProbe
        containerWidth={480}
        entryWidths={[["alpha", 100]]}
        measurementKey="stable-width"
      />,
    );

    await waitFor(() => {
      expect(readMeasurements().entryWidths).toEqual({ alpha: 100 });
    });

    rerender(
      <MeasurementProbe
        containerWidth={480}
        entryWidths={[["alpha", 160]]}
        measurementKey="stable-width"
      />,
    );

    expect(readMeasurements().entryWidths).toEqual({ alpha: 100 });

    resolveFontsReady();

    await waitFor(() => {
      expect(readMeasurements().entryWidths).toEqual({ alpha: 160 });
    });
  } finally {
    requestAnimationFrameSpy.mockRestore();
    cancelAnimationFrameSpy.mockRestore();
    restoreMeasurementDomMocks();
    if (fontsDescriptor) {
      Object.defineProperty(document, "fonts", fontsDescriptor);
    } else {
      Reflect.deleteProperty(document, "fonts");
    }
  }
});
