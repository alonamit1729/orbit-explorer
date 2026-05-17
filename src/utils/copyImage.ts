import { toBlob, toSvg } from "html-to-image";

/**
 * Try to copy the given DOM node's rendering as a PNG image to the clipboard.
 *
 * Falls back to copying its SVG XML as text/plain when the browser refuses
 * the image clipboard call (Safari quirks, missing permissions, etc.).
 *
 * Returns a short status string the caller can surface as a toast.
 */
export async function copyNodeAsImage(node: HTMLElement): Promise<string> {
  // 1. Try PNG first — best paste target for docs, slides, chat apps.
  try {
    const blob = await toBlob(node, {
      backgroundColor: "#ffffff",
      pixelRatio: 2,
      cacheBust: true,
    });
    if (blob && typeof ClipboardItem !== "undefined") {
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);
      return "copied";
    }
  } catch (err) {
    console.warn("PNG clipboard failed, falling back to SVG text", err);
  }

  // 2. Fallback — copy the SVG XML as text. The user can paste into a vector
  //    editor or save as .svg.
  try {
    const svgDataUrl = await toSvg(node, { cacheBust: true });
    const svgText = decodeURIComponent(
      svgDataUrl.replace(/^data:image\/svg\+xml;charset=utf-8,/, ""),
    );
    await navigator.clipboard.writeText(svgText);
    return "copied as SVG text";
  } catch (err) {
    console.error("SVG text clipboard failed", err);
    return "copy failed";
  }
}
