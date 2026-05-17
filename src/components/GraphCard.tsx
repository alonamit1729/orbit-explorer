import { useRef, useState, type ReactNode } from "react";
import { copyNodeAsImage } from "../utils/copyImage";
import { ZoomModal } from "./ZoomModal";

interface Props {
  /** Title shown above the graph; e.g. "cycle graph" or "on the real line". */
  title: string;
  /** The graph itself (an SVG). */
  children: ReactNode;
  /** A larger rendering of the same graph for the zoom modal. May be the
   * same React tree at a larger logical size — the modal also widens the
   * viewport. If omitted, the inline `children` is reused. */
  zoomed?: ReactNode;
}

export function GraphCard({ title, children, zoomed }: Props) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  async function handleCopy() {
    if (!bodyRef.current) return;
    setToast("copying…");
    const status = await copyNodeAsImage(bodyRef.current);
    setToast(status);
    setTimeout(() => setToast(null), 1500);
  }

  return (
    <div className="graph-card">
      <div className="graph-card-header">
        <span className="cycle-meta">{title}</span>
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
            onClick={() => setZoomOpen(true)}
            title="Open in zoomed view"
            aria-label="Open in zoomed view"
          >
            <ZoomIcon />
          </button>
        </div>
      </div>
      <div className="graph-card-body" ref={bodyRef}>
        {children}
      </div>
      {zoomOpen && (
        <ZoomModal title={title} onClose={() => setZoomOpen(false)}>
          {zoomed ?? children}
        </ZoomModal>
      )}
    </div>
  );
}

function CopyIcon() {
  return (
    <svg
      width="14"
      height="14"
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

function ZoomIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 7V3h4" />
      <path d="M17 3h4v4" />
      <path d="M21 17v4h-4" />
      <path d="M7 21H3v-4" />
    </svg>
  );
}
