// ============================================================================
//  Turn a DOM node into a PNG — download, or copy to clipboard.
//  Uses html-to-image (client-side, no server). All colours in the captured
//  node are explicit hex (not CSS variables) so the image renders correctly.
//
//  skipFonts: our sheets use only system/fallback fonts, so we skip web-font
//  embedding — that step fetches every stylesheet and can hang behind proxies.
//  Every call is wrapped in a timeout so the UI can never get stuck "working".
// ============================================================================
import { toPng, toBlob } from "html-to-image";

const OPTS = { pixelRatio: 2, backgroundColor: "#ffffff", skipFonts: true };

function withTimeout(promise, ms = 15000) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("Image render timed out")), ms)),
  ]);
}

export async function downloadNodePng(node, filename) {
  const opts = {
    ...OPTS,
    width: node.scrollWidth,
    height: node.scrollHeight,
    style: { transform: "none", margin: 0 }
  };
  const dataUrl = await withTimeout(toPng(node, opts));
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename.endsWith(".png") ? filename : filename + ".png";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// Returns true if copied to clipboard, false if the browser blocked it.
export async function copyNodePng(node) {
  try {
    const opts = {
      ...OPTS,
      width: node.scrollWidth,
      height: node.scrollHeight,
      style: { transform: "none", margin: 0 }
    };
    const blob = await withTimeout(toBlob(node, opts));
    if (!blob) return false;
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    return true;
  } catch {
    return false;
  }
}
