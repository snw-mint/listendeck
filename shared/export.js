import { toPng } from "html-to-image";

export async function exportNodeAsPng(node, filename = "listendeck-export.png", options = {}) {
  if (!node) return;
  const dataUrl = await toPng(node, {
    cacheBust: true,
    pixelRatio: 2,
    backgroundColor: null,
    ...options,
  });
  const link = document.createElement("a");
  link.download = filename;
  link.href = dataUrl;
  link.click();
}
