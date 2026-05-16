// src/utils/qr.ts
import QRCode from "qrcode";
import open from "open";
import * as fs from "fs";
import { WALLET_DIR, QR_FILE, USDC_ADDRESS, BASE_CHAIN_ID } from "./constants.js";

// USDC mint address on Solana mainnet
const SOLANA_USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

export function getEip681Uri(address: string, amountUsdc: number = 1.0): string {
  const amountWei = Math.floor(amountUsdc * 1_000_000);
  return `ethereum:${USDC_ADDRESS}@${BASE_CHAIN_ID}/transfer?address=${address}&uint256=${amountWei}`;
}

export function getSolanaPayUri(address: string, amountUsdc: number = 1.0): string {
  return `solana:${address}?spl-token=${SOLANA_USDC_MINT}&amount=${amountUsdc}&label=BlockRun`;
}

export async function generateQrPng(address: string, chain: "base" | "solana" = "base"): Promise<string> {
  const uri = chain === "solana" ? getSolanaPayUri(address) : getEip681Uri(address);

  if (!fs.existsSync(WALLET_DIR)) {
    fs.mkdirSync(WALLET_DIR, { recursive: true, mode: 0o700 });
  }

  await QRCode.toFile(QR_FILE, uri, {
    type: "png",
    width: 400,
    margin: 2,
    errorCorrectionLevel: "H",
    color: { dark: "#000000", light: "#FFFFFF" },
  });

  return QR_FILE;
}

export async function openQrInViewer(qrPath: string): Promise<void> {
  try {
    await open(qrPath);
  } catch {
    // Silently fail
  }
}
