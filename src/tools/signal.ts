// src/tools/signal.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { calculateEMA, calculateRSI, calculateMACD } from "../utils/indicators.js";

export function registerSignalTool(server: McpServer): void {
  server.registerTool(
    "blockrun_signal",
    {
      description: `Generate trading signals using RSI + MACD + EMA strategy.

Strategy (from freqtrade-strategies):
- BUY when: RSI < 40 (oversold) + MACD > Signal + Price > EMA200
- SELL when: RSI > 70 (overbought) or take profit/stop loss

Returns: BUY / SELL / HOLD signal with confidence level.

Example: blockrun_signal({ symbol: "BTCUSDT" })`,
      inputSchema: {
        symbol: z.string().describe("Trading pair (e.g., BTCUSDT, ETHUSDT, SOLUSDT)"),
        timeframe: z.enum(["5m", "15m", "1h", "4h"]).optional().default("1h").describe("Candle timeframe"),
      },
    },
    async ({ symbol, timeframe }) => {
      try {
        // Fetch candles from Binance public API (no auth needed)
        const url = `https://api.binance.com/api/v3/klines?symbol=${symbol.toUpperCase()}&interval=${timeframe}&limit=250`;
        const response = await fetch(url);

        if (!response.ok) {
          throw new Error(`Binance API error: ${response.status}`);
        }

        const candles = await response.json() as Array<[number, string, string, string, string, string]>;
        const closes = candles.map(c => parseFloat(c[4])); // Close prices
        const currentPrice = closes[closes.length - 1];

        // Calculate indicators
        const rsi = calculateRSI(closes);
        const { macd, signal, histogram } = calculateMACD(closes);
        const ema200 = calculateEMA(closes, 200);
        const currentEMA200 = ema200[ema200.length - 1];
        const ema50 = calculateEMA(closes, 50);
        const currentEMA50 = ema50[ema50.length - 1];

        // Generate signal based on strategy
        let signalType: "BUY" | "SELL" | "HOLD" = "HOLD";
        let confidence = 0;
        let reasons: string[] = [];

        // BUY conditions
        const rsiOversold = rsi < 40;
        const macdBullish = macd > signal;
        const aboveEMA200 = currentPrice > currentEMA200;
        const aboveEMA50 = currentPrice > currentEMA50;

        // SELL conditions
        const rsiOverbought = rsi > 70;
        const macdBearish = macd < signal;
        const belowEMA200 = currentPrice < currentEMA200;

        if (rsiOversold && macdBullish && aboveEMA200) {
          signalType = "BUY";
          confidence = 80;
          reasons.push("RSI oversold (<40)");
          reasons.push("MACD bullish crossover");
          reasons.push("Price above EMA200 (uptrend)");
          if (aboveEMA50) {
            confidence += 10;
            reasons.push("Price above EMA50 (strong)");
          }
        } else if (rsiOverbought || (macdBearish && belowEMA200)) {
          signalType = "SELL";
          confidence = rsiOverbought ? 75 : 60;
          if (rsiOverbought) reasons.push("RSI overbought (>70)");
          if (macdBearish) reasons.push("MACD bearish");
          if (belowEMA200) reasons.push("Price below EMA200 (downtrend)");
        } else {
          signalType = "HOLD";
          confidence = 50;
          reasons.push("No clear signal");
          if (rsi < 50 && macdBullish) reasons.push("Slight bullish bias");
          if (rsi > 50 && macdBearish) reasons.push("Slight bearish bias");
        }

        // Calculate suggested stop loss and take profit
        const stopLoss = signalType === "BUY" ? currentPrice * 0.9 : null;
        const takeProfit = signalType === "BUY" ? currentPrice * 1.2 : null;

        const result = `[Trading Signal: ${symbol}]

Signal: ${signalType} (${confidence}% confidence)
Price: $${currentPrice.toFixed(2)}

Indicators:
- RSI (14): ${rsi.toFixed(1)} ${rsi < 30 ? "🟢 Oversold" : rsi > 70 ? "🔴 Overbought" : "⚪ Neutral"}
- MACD: ${macd.toFixed(4)} | Signal: ${signal.toFixed(4)} | ${histogram > 0 ? "🟢 Bullish" : "🔴 Bearish"}
- EMA 50: $${currentEMA50.toFixed(2)} ${currentPrice > currentEMA50 ? "🟢 Above" : "🔴 Below"}
- EMA 200: $${currentEMA200.toFixed(2)} ${currentPrice > currentEMA200 ? "🟢 Above" : "🔴 Below"}

Reasons:
${reasons.map(r => `• ${r}`).join("\n")}
${signalType === "BUY" ? `
Suggested:
• Stop Loss: $${stopLoss?.toFixed(2)} (-10%)
• Take Profit: $${takeProfit?.toFixed(2)} (+20%)` : ""}

Strategy: RSI + MACD + EMA (freqtrade-strategies)
Timeframe: ${timeframe}`;

        return {
          content: [{ type: "text", text: result }],
          structuredContent: {
            symbol,
            signal: signalType,
            confidence,
            price: currentPrice,
            indicators: { rsi, macd, signal, ema50: currentEMA50, ema200: currentEMA200 },
            stopLoss,
            takeProfit,
            reasons,
          },
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text", text: `Signal error: ${errorMessage}` }],
          isError: true,
        };
      }
    }
  );
}
