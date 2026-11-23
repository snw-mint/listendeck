import { toPng } from "html-to-image";

export async function exportNodeAsPng(node, filename = "listendeck-export.png") {
  if (!node) return;
  const bg = getComputedStyle(document.body).backgroundColor || "#FFFFFF";
  const dataUrl = await toPng(node, {
    cacheBust: true,
    pixelRatio: 2,
    backgroundColor: bg,
  });
  const link = document.createElement("a");
  link.download = filename;
  link.href = dataUrl;
  link.click();
}
