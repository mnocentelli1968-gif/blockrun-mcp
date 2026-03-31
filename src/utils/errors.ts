export function formatError(message: string): string {
  const msgLower = message.toLowerCase();

  const isPaymentError = msgLower.includes("402") ||
    msgLower.includes("balance") ||
    msgLower.includes("insufficient") ||
    (msgLower.includes("payment") && !msgLower.includes("500"));

  const isServerError = msgLower.includes("500") ||
    msgLower.includes("api error after payment");

  let errorText = `Error: ${message}`;

  if (isServerError) {
    errorText += `\n\nThis is a temporary API issue. The xAI/Grok API may be experiencing problems.` +
      `\nTry again in a few minutes, or use a different model (e.g., openai/gpt-4o).`;
  } else if (isPaymentError) {
    errorText += `\n\nThis error usually means your wallet needs funding.\n` +
      `Run blockrun_wallet with action: "setup" to get funding instructions.\n\n` +
      `Quick fix: Send USDC to your wallet on Base network.`;
  }

  return errorText;
}
