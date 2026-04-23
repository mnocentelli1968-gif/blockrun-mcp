# Changelog

All notable changes to BlockRun MCP will be documented in this file.

## 0.9.2

- **`MODEL_TIERS` now matches the post-refresh NVIDIA free tier.** The 0.9.1 note claimed "no code change was required" — that was wrong for `blockrun_chat` with `mode: "free"` or `mode: "coding"`, which picks the primary model from the hardcoded tier list rather than the live catalogue. The stale list still put retired models at positions 2–3 (`nvidia/nemotron-ultra-253b`, `nvidia/nemotron-super-49b`) and kept `nvidia/devstral-2-123b` in `coding`. The backend redirected, so requests didn't fail, but the two new fast models (`nvidia/qwen3-next-80b-a3b-thinking`, `nvidia/mistral-small-4-119b`) were never primary picks.
- `mode: "free"` now leads with `nvidia/qwen3-next-80b-a3b-thinking` → `nvidia/mistral-small-4-119b`, then the 6 other visible free models.
- `mode: "coding"` drops the retired `nvidia/devstral-2-123b`.
- Provider-summary comment block refreshed: Anthropic section lists the current flagships (opus-4.7 / opus-4.6 / sonnet-4.6 / haiku-4.5), NVIDIA section describes the 8 visible models + which retired IDs the backend still aliases.

## 0.9.1

- **Install command:** `claude mcp add blockrun -s user -- npx -y @blockrun/mcp@latest` (the `-s user` scope fixes a per-project install pitfall the previous command caused).
- NVIDIA free-tier refresh on the backend (2026-04-21): retired `nvidia/nemotron-*`, `nvidia/mistral-large-3-675b`, `nvidia/devstral-2-123b`, `nvidia/qwen3.5-397b-a17b`, and paid `nvidia/kimi-k2.5`. Two new models callable via `blockrun_chat`: `nvidia/qwen3-next-80b-a3b-thinking` (free reasoning flagship) and `nvidia/mistral-small-4-119b` (fastest free chat). `blockrun_models` returns the current catalogue live, so no code change was required.

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
