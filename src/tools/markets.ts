// src/tools/markets.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getClient } from "../utils/wallet.js";
import { formatError } from "../utils/errors.js";

export function registerMarketsTool(server: McpServer): void {
  server.registerTool(
    "blockrun_markets",
    {
      description: `Prediction market + derivatives data via Predexon aggregator. Tier 1 = $0.001/call, Tier 2 = $0.005/call.

POLYMARKET (Tier 1):
- polymarket/events, polymarket/markets — list events/markets (filter, sort, paginate)
- polymarket/crypto-updown — crypto up/down markets
- polymarket/market-price/:token_id — current/historical price
- polymarket/candlesticks/:condition_id — OHLCV by market
- polymarket/candlesticks/token/:token_id — OHLCV by single outcome token
- polymarket/volume-chart/:condition_id — volume w/ YES/NO split
- polymarket/orderbooks, polymarket/trades, polymarket/activity
- polymarket/markets/:token_id/volume, polymarket/markets/:condition_id/open_interest
- polymarket/positions — user positions
- polymarket/leaderboard, polymarket/leaderboard/market/:condition_id
- polymarket/cohorts/stats, polymarket/market/:condition_id/top-holders
- polymarket/uma/markets, polymarket/uma/market/:condition_id — UMA oracle questions/timeline

POLYMARKET (Tier 2 — wallet/smart-money analytics):
- polymarket/wallet/:wallet — full smart-wallet profile
- polymarket/wallet/:wallet/markets, .../similar
- polymarket/wallet/pnl/:wallet, .../positions/:wallet, .../volume-chart/:wallet
- polymarket/wallets/profiles, polymarket/wallets/filter — batch + AND/OR filter
- polymarket/market/:condition_id/smart-money, polymarket/markets/smart-activity
- polymarket/wallet/identity, polymarket/wallet/identities-batch, polymarket/wallet/cluster

KALSHI (Tier 1): kalshi/markets, kalshi/trades, kalshi/orderbooks
LIMITLESS / OPINION / PREDICT.FUN (Tier 1): {platform}/markets, {platform}/orderbooks
DFLOW: dflow/trades (T1), dflow/wallet/positions/:wallet (T2), dflow/wallet/pnl/:wallet (T2)
BINANCE FUTURES (Tier 2): binance/candles/:symbol, binance/ticks/:symbol

CROSS-PLATFORM:
- matching-markets, matching-markets/pairs — equivalent markets across Polymarket+Kalshi (T2)
- markets/search — search across all platforms in one call (T2)

Pass query params via 'params' (GET). Use 'body' only for POST endpoints.`,
      inputSchema: {
        path: z.string().describe("Endpoint path, e.g. 'polymarket/events', 'kalshi/markets/KXBTC-25MAR14', 'polymarket/wallet/0xabc...', 'markets/search'"),
        params: z.record(z.string(), z.string()).optional().describe("Query parameters for GET requests (e.g. { limit: '20', active: 'true' })"),
        body: z.any().optional().describe("JSON body for POST queries (triggers pmQuery — most endpoints are GET)"),
      },
    },
    async ({ path, params, body }) => {
      try {
        const llm = getClient();
        const result = body
          ? await llm.pmQuery(path, body)
          : await llm.pm(path, params);

        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          structuredContent: result,
        };
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text", text: formatError(errMsg) }],
          isError: true,
        };
      }
    }
  );
}
