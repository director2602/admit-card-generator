import QRCode from "qrcode";
import bwipjs from "bwip-js/node";

/** Generate a QR code or Code128 barcode as inline SVG markup. */
export async function codeSvg(kind: "qr" | "barcode", data: string, color = "#000000"): Promise<string | null> {
  const text = data.trim().slice(0, 500);
  if (!text) return null;
  if (kind === "qr") {
    return QRCode.toString(text, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: color, light: "#ffffff00" } });
  }
  try {
    return bwipjs.toSVG({ bcid: "code128", text, scale: 2, height: 10, includetext: true, textxalign: "center", textsize: 8 });
  } catch {
    return null;
  }
}
