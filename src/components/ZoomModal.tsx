import { useEffect, useRef, useState, type ReactNode } from "react";
import { copyNodeAsImage } from "../utils/copyImage";

interface Props {
  title: string;
  children: ReactNode;
  onClose: () => void;
}

export function ZoomModal({ title, children, onClose }: Props) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    // Lock background scroll while the modal is open.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  async function handleCopy() {
    if (!bodyRef.current) return;
    setToast("copying…");
    const status = await copyNodeAsImage(bodyRef.current);
    setToast(status);
    setTimeout(() => setToast(null), 1500);
  }

  return (
    <div className="zoom-modal-backdrop" onClick={onClose}>
      <div className="zoom-modal" onClick={(e) => e.stopPropagation()}>
        <div className="zoom-modal-header">
          <span className="zoom-modal-title">{title}</span>
          <div className="graph-card-actions">
            {toast && <span className="graph-card-toast">{toast}</span>}
            <button
              type="button"
              className="icon-btn"
              onClick={handleCopy}
              title="Copy image to clipboard"
              aria-label="Copy image to clipboard"
            >
              <CopyIcon />
            </button>
            <button
              type="button"
              className="icon-btn"
              onClick={onClose}
              title="Close"
              aria-label="Close"
            >
              <CloseIcon />
            </button>
          </div>
        </div>
        <div className="zoom-modal-body" ref={bodyRef}>
          {children}
        </div>
      </div>
    </div>
  );
}

function CopyIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
