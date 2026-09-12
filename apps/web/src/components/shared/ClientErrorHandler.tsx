"use client";

import { useEffect } from "react";

/**
 * ClientErrorHandler
 *
 * Attaches a global error listener on the client to safely handle benign
 * browser-extension or profiler runtime errors (such as "reading 'startTime'")
 * without rendering SSR head tags or causing hydration mismatches.
 */
export function ClientErrorHandler() {
  useEffect(() => {
    const handleError = (e: ErrorEvent) => {
      if (e.message && e.message.includes("reading 'startTime'")) {
        e.stopImmediatePropagation();
        e.preventDefault();
        return true;
      }
    };

    window.addEventListener("error", handleError, true);
    return () => {
      window.removeEventListener("error", handleError, true);
    };
  }, []);

  return null;
}
