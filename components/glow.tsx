"use client";

import { useEffect } from "react";

/**
 * Cursor-following glow for any element marked `data-glow` (or `data-glow="light"` on
 * gradient buttons). One delegated, rAF-throttled pointer listener for the whole app
 * writes the cursor position into CSS custom properties (--gx/--gy) on the hovered
 * element; the visual lives entirely in CSS (see globals.css). No React re-renders.
 *
 * Ignored for touch input and when the user prefers reduced motion.
 */
export function GlowTracker() {
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    let active: HTMLElement | null = null;
    let frame = 0;
    let x = 0;
    let y = 0;

    const deactivate = () => {
      active?.removeAttribute("data-glow-active");
      active = null;
    };

    const paint = () => {
      frame = 0;
      if (!active) return;
      const r = active.getBoundingClientRect();
      active.style.setProperty("--gx", `${x - r.left}px`);
      active.style.setProperty("--gy", `${y - r.top}px`);
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch" || reduce.matches) return;
      const target = (e.target as Element | null)?.closest<HTMLElement>("[data-glow]") ?? null;
      if (target !== active) {
        deactivate();
        if (target && !target.matches(":disabled,[aria-disabled='true']")) {
          active = target;
          active.setAttribute("data-glow-active", "");
        }
      }
      x = e.clientX;
      y = e.clientY;
      if (active && !frame) frame = requestAnimationFrame(paint);
    };

    const onLeaveWindow = (e: PointerEvent) => {
      if (!e.relatedTarget) deactivate();
    };

    document.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerout", onLeaveWindow, { passive: true });
    window.addEventListener("blur", deactivate);
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerout", onLeaveWindow);
      window.removeEventListener("blur", deactivate);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);
  return null;
}
