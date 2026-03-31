// src/tools/analyze.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getClient } from "../utils/wallet.js";
import { formatError } from "../utils/errors.js";

export function registerAnalyzeTool(server: McpServer): void {
  server.registerTool(
    "blockrun_analyze",
    {
      description: `Comprehensive trading analysis combining multiple data sources.

Analyzes:
- DEX data (price, volume, liquidity) via DexScreener
- Twitter/X sentiment via Grok
- Whale movements (if BigQuery configured)
- AI synthesis of all data

Example: blockrun_analyze({ token: "SOL", question: "Should I buy?" })`,
      inputSchema: {
        token: z.string().describe("Token symbol or address to analyze"),
        question: z.string().optional().describe("Specific question (default: general analysis)"),
        include_twitter: z.boolean().optional().default(true).describe("Include Twitter sentiment"),
        include_whale: z.boolean().optional().default(false).describe("Include whale tracking"),
      },
    },
    async ({ token, question, include_twitter, include_whale }) => {
      const llm = getClient();
      const analysisPrompt = question || `Provide comprehensive trading analysis for ${token}`;
      let contextData = "";

      // 1. Get DEX data
      try {
        const dexUrl = `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(token)}`;
        const dexResponse = await fetch(dexUrl);
        const dexData = await dexResponse.json() as {
          pairs?: Array<{
            chainId: string;
            baseToken: { symbol: string; name: string };
            priceUsd: string;
            priceChange: { h24: number; h6: number; h1: number };
            volume: { h24: number };
            liquidity: { usd: number };
            fdv: number;
          }>;
        };

        if (dexData.pairs && dexData.pairs.length > 0) {
          const topPair = dexData.pairs[0];
          contextData += `\n## DEX Data (DexScreener)\n`;
          contextData += `- Token: ${topPair.baseToken.name} (${topPair.baseToken.symbol})\n`;
          contextData += `- Price: $${parseFloat(topPair.priceUsd).toFixed(6)}\n`;
          contextData += `- 24h Change: ${topPair.priceChange?.h24?.toFixed(2) || "N/A"}%\n`;
          contextData += `- 24h Volume: $${((topPair.volume?.h24 || 0) / 1000000).toFixed(2)}M\n`;
          contextData += `- Liquidity: $${((topPair.liquidity?.usd || 0) / 1000000).toFixed(2)}M\n`;
          contextData += `- FDV: $${((topPair.fdv || 0) / 1000000000).toFixed(2)}B\n`;
          contextData += `- Chain: ${topPair.chainId}\n`;
        }
      } catch (err) {
        contextData += `\n## DEX Data: Error fetching\n`;
      }

      // 2. Get Twitter sentiment (if requested)
      if (include_twitter) {
        try {
          const twitterResponse = await llm.chat("xai/grok-3", `What are people saying about ${token} on Twitter/X right now? Focus on: sentiment, key influencers, trending topics, price predictions.`, {
            system: "Real-time X/Twitter search. Provide factual summary of recent posts.",
            search: true,
          } as Parameters<typeof llm.chat>[2] & { search?: boolean });
          contextData += `\n## Twitter/X Sentiment (via Grok)\n${twitterResponse}\n`;
        } catch {
          contextData += `\n## Twitter: Unable to fetch\n`;
        }
      }

      // 3. Whale movements (demo data if not configured)
      if (include_whale) {
        contextData += `\n## Whale Movements\n`;
        contextData += `Note: BigQuery not configured. In production, this would show:\n`;
        contextData += `- Large transfers to/from exchanges\n`;
        contextData += `- Smart money wallet movements\n`;
        contextData += `- Exchange inflow/outflow trends\n`;
      }

      // 4. AI Synthesis
      const synthesisPrompt = `You are a crypto trading analyst. Based on the following data, answer: "${analysisPrompt}"

${contextData}

Provide:
1. Key findings (bullet points)
2. Risk assessment (Low/Medium/High)
3. Trading suggestion (if asked)
4. What to watch for

Be factual and balanced. Don't give financial advice, but provide analysis based on the data.`;

      try {
        const analysis = await llm.chat("openai/gpt-4o", synthesisPrompt, {
          system: "Expert crypto trading analyst. Provide data-driven analysis.",
          maxTokens: 1500,
        });

        return {
          content: [{
            type: "text",
            text: `[BlockRun Trading Analysis: ${token}]\n\n${analysis}\n\n---\nData sources: DexScreener${include_twitter ? ", Twitter/X (Grok)" : ""}${include_whale ? ", Whale Tracker" : ""}`,
          }],
          structuredContent: { token, question: analysisPrompt, analysis },
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text", text: formatError(errorMessage) }],
          isError: true,
        };
      }
    }
  );
}
