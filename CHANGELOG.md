# Changelog

All notable changes to BlockRun MCP will be documented in this file.

## 0.9.0

- **New `blockrun_price` tool** — Pyth-backed realtime quotes and OHLC history across crypto, FX, commodities and 12 global stock markets (us/hk/jp/kr/gb/de/fr/nl/ie/lu/cn/ca). Crypto / FX / commodity are fully free; stocks charge $0.001 per call. Actions: `price`, `history`, `list`.
- **New `blockrun_x` tool** — structured X/Twitter access via the AttentionVC `/v1/x/*` endpoint family. Replaces the earlier Grok-chat prototype with 11 actions: `user_lookup`, `user_info`, `followers`, `followings`, `verified_followers`, `user_tweets`, `user_mentions`, `tweet_lookup`, `tweet_replies`, `tweet_thread`, `search`.
- Upgrade `@blockrun/llm` to `^1.8.0` for `PriceClient` + extended type metadata.

## 0.8.0

- **New `blockrun_video` tool** — generate short AI videos via `xai/grok-imagine-video` ($0.05/sec, 8s default). Text or image-to-video. Blocks until the clip is ready (~30-120s).
- `blockrun_image` now supports `xai/grok-imagine-image` ($0.02) and `xai/grok-imagine-image-pro` ($0.07).
- Tool responses surface the gateway-hosted permanent URL; source URLs and `backed_up` flag included when the asset was mirrored.

## 0.6.8

- Latest stable release
- Real-time data tools: markets, research, X/Twitter, crypto
- x402 micropayments via USDC
- MCP protocol compatible with Claude Code
