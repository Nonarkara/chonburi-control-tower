import { useEffect, useRef } from "react";

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Traps keyboard focus within the referenced container while `active` is true.
 * On activation, moves focus to the first focusable child and records the
 * previously-focused element. On deactivation, restores focus to that element.
 * Tab / Shift+Tab wraps at the boundaries.
 * Satisfies WCAG 2.1 SC 2.1.2 (No Keyboard Trap) and ARIA modal dialog pattern.
 */
export function useFocusTrap(active: boolean) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active || !ref.current) return;

    // Remember where focus was before opening so we can restore it on close
    const trigger = document.activeElement as HTMLElement | null;

    const el = ref.current;
    const focusable = () =>
      Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (n) => !n.closest("[inert]") && getComputedStyle(n).display !== "none",
      );

    // Move initial focus to the first focusable element
    focusable()[0]?.focus();

    const trap = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const nodes = focusable();
      if (!nodes.length) return;

      if (e.shiftKey && document.activeElement === nodes[0]) {
        e.preventDefault();
        nodes[nodes.length - 1].focus();
      } else if (!e.shiftKey && document.activeElement === nodes[nodes.length - 1]) {
        e.preventDefault();
        nodes[0].focus();
      }
    };

    window.addEventListener("keydown", trap);
    return () => {
      window.removeEventListener("keydown", trap);
      // Restore focus to the trigger element when modal closes
      trigger?.focus?.();
    };
  }, [active]);

  return ref;
}
