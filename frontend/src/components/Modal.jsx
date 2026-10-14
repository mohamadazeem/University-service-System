import { useEffect, useRef, useId } from "react";
import { createPortal } from "react-dom";
export default function Modal({ title, children, onClose, busy = false }) {
  const ref = useRef(null);
  const actions = useRef({ onClose, busy });
  const titleId = useId();
  useEffect(() => {
    actions.current = { onClose, busy };
  }, [onClose, busy]);
  useEffect(() => {
    const previous = document.activeElement;
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.focus();
    const keydown = (event) => {
      if (event.key === "Escape" && !actions.current.busy)
        actions.current.onClose();
      if (event.key === "Tab") {
        const elements = ref.current?.querySelectorAll(
          "button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href]",
        );
        if (!elements?.length) {
          event.preventDefault();
          return;
        }
        const first = elements[0],
          last = elements[elements.length - 1];
        const focusOutside = !ref.current.contains(document.activeElement);
        if (
          event.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === ref.current || focusOutside)
        ) {
          event.preventDefault();
          last.focus();
        } else if (
          !event.shiftKey &&
          (document.activeElement === last ||
            document.activeElement === ref.current || focusOutside)
        ) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", keydown);
    return () => {
      document.removeEventListener("keydown", keydown);
      document.body.style.overflow = before;
      previous?.focus();
    };
  }, []);
  return createPortal(
    <div className="modal-backdrop">
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={ref}
        tabIndex={-1}
      >
        <header className="modal-header">
          <h2 id={titleId}>{title}</h2>
          <button
            type="button"
            className="icon-button"
            aria-label="Close dialog"
            disabled={busy}
            onClick={onClose}
          >
            ×
          </button>
        </header>
        {children}
      </section>
    </div>,
    document.body,
  );
}
