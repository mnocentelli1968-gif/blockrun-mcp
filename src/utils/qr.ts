// src/utils/qr.ts
import QRCode from "qrcode";
import { Jimp } from "jimp";
import open from "open";
import * as fs from "fs";
import { WALLET_DIR, QR_FILE, USDC_ADDRESS, BASE_CHAIN_ID } from "./constants.js";

export function getEip681Uri(address: string, amountUsdc: number = 1.0): string {
  const amountWei = Math.floor(amountUsdc * 1_000_000);
  return `ethereum:${USDC_ADDRESS}@${BASE_CHAIN_ID}/transfer?address=${address}&uint256=${amountWei}`;
}

export async function generateQrPng(address: string): Promise<string> {
  const eip681Uri = getEip681Uri(address);

  const qrBuffer = await QRCode.toBuffer(eip681Uri, {
    type: "png",
    width: 400,
    margin: 2,
    errorCorrectionLevel: "H",
    color: { dark: "#000000", light: "#FFFFFF" },
  });

  const qrImage = await Jimp.read(qrBuffer);

  try {
    const logoUrl = "https://avatars.githubusercontent.com/u/108554348?s=200&v=4";
    const logo = await Jimp.read(logoUrl);
    const logoSize = Math.floor(qrImage.width * 0.2);
    logo.resize({ w: logoSize, h: logoSize });
    const x = Math.floor((qrImage.width - logoSize) / 2);
    const y = Math.floor((qrImage.height - logoSize) / 2);
    qrImage.composite(logo, x, y);
  } catch {
    // Continue without logo if fetch fails
  }

  if (!fs.existsSync(WALLET_DIR)) {
    fs.mkdirSync(WALLET_DIR, { recursive: true, mode: 0o700 });
  }

  await qrImage.write(QR_FILE as `${string}.${string}`);
  return QR_FILE;
}

export async function openQrInViewer(qrPath: string): Promise<void> {
  try {
    await open(qrPath);
  } catch {
    // Silently fail
  }
}
