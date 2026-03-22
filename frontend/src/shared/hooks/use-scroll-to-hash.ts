import { useEffect } from "react";

import { useLocation } from "react-router-dom";

export function useScrollToHash() {
  const { hash, pathname, search } = useLocation();

  useEffect(() => {
    if (!hash) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      const element = document.getElementById(hash.slice(1));
      if (!element) {
        return;
      }

      element.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [hash, pathname, search]);
}
