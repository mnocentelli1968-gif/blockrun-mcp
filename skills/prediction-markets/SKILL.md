---
name: prediction-markets
description: Use when user asks about event probabilities, prediction market odds, what people are betting on, Polymarket or Kalshi prices, sports markets, wallet identity / clustering, or wants to find markets on a specific topic (elections, crypto, sports, macro events). Predexon v2 endpoints (canonical cross-venue markets, sports, wallet identity, keyset pagination) live in production as of 2026-05.
triggers:
  - "polymarket"
  - "kalshi"
  - "dflow"
  - "prediction market"
  - "event probability"
  - "betting odds"
  - "what are people betting on"
  - "election odds"
  - "crypto market odds"
  - "binance futures"
  - "yes/no market"
  - "implied probability"
  - "sports markets"
  - "wallet identity"
  - "wallet cluster"
  - "cross-venue markets"
  - "predexon"
---

# Prediction Markets

Real-time prediction market data via BlockRun (powered by Predexon v2). Covers canonical cross-venue markets, Polymarket, Kalshi, Limitless, Opinion, Predict.Fun, dFlow, sports, and Binance Futures.

## Quick Decision Table

| User wants... | Method | Path | Cost |
|--------------|--------|------|------|
| **Canonical cross-venue markets** | `client.pm(path)` | `"markets"` | $0.001 |
| **Venue-native flattened listings** | `client.pm(path)` | `"markets/listings"` | $0.001 |
| **Resolve canonical outcome ID** | `client.pm(path)` | `"outcomes/{predexon_id}"` | $0.001 |
| **Search across all venues** | `client.pm(path, q=...)` | `"markets/search"` | $0.005 |
| Active Polymarket events | `client.pm(path)` | `"polymarket/events"` | $0.001 |
| Polymarket events (keyset paginated) | `client.pm(path, pagination_key=...)` | `"polymarket/events/keyset"` | $0.001 |
| Polymarket markets (keyset paginated) | `client.pm(path, pagination_key=...)` | `"polymarket/markets/keyset"` | $0.001 |
| Specific Kalshi market | `client.pm(path)` | `"kalshi/markets/TICKER"` | $0.001 |
| **Sports categories** | `client.pm(path)` | `"sports/categories"` | $0.001 |
| **Sports markets (by league/sport)** | `client.pm(path, league=...)` | `"sports/markets"` | $0.001 |
| **Wallet identity (single)** | `client.pm(path)` | `"polymarket/wallet/identity/{wallet}"` | $0.005 |
| **Wallet identity (bulk, up to 200)** | `client.pm_query(path, body)` | `"polymarket/wallet/identities"` | $0.005 |
| **Wallet on-chain cluster** | `client.pm(path)` | `"polymarket/wallet/{address}/cluster"` | $0.005 |
| dFlow markets | `client.pm(path)` | `"dflow/..."` | $0.001-$0.005 |
| Binance Futures | `client.pm(path)` | `"binance/..."` | $0.005 |

## Instructions

### 1. Initialize

```python
import os
from pathlib import Path

chain_file = Path.home() / ".blockrun" / ".chain"
chain = chain_file.read_text().strip() if chain_file.exists() else "base"

if chain == "solana":
    from blockrun_llm import setup_agent_solana_wallet
    client = setup_agent_solana_wallet()
else:
    from blockrun_llm import setup_agent_wallet
    client = setup_agent_wallet()
```

### 2. List Active Events

```python
# All active Polymarket events
events = client.pm("polymarket/events")
for event in events.get("data", events if isinstance(events, list) else [])[:10]:
    print(f"{event.get('title', '?')} — {event.get('slug', '')}")
```

### 3. Search by Topic

```python
# Search Polymarket for a topic
results = client.pm("polymarket/search", q="bitcoin ETF")
for market in results.get("data", results if isinstance(results, list) else [])[:10]:
    title = market.get("title", "?")
    # Outcome prices are in the market object
    print(f"{title}")
    for outcome in market.get("outcomes", []):
        print(f"  {outcome.get('title', '?')}: {outcome.get('price', '?')}")
```

### 4. Specific Kalshi Market

```python
# Get a specific Kalshi market by ticker
market = client.pm("kalshi/markets/KXBTC-25MAR14")
print(f"Market: {market.get('title', market.get('ticker', '?'))}")
yes_price = market.get("yes_bid", market.get("yes_price", "?"))
no_price = market.get("no_bid", market.get("no_price", "?"))
print(f"YES: {yes_price} | NO: {no_price}")
```

### 5. Structured Query (POST)

Use for complex filtering — active markets only, sorted by volume, with pagination.

```python
# Polymarket: active markets sorted by volume, limit 20
data = client.pm_query("polymarket/query", {
    "filter": "active",
    "limit": 20,
    "order": "volume",
})

# Kalshi: all markets in a specific series
data = client.pm_query("kalshi/query", {
    "series_ticker": "KXBTC",
    "limit": 50,
})
```

### 6. Canonical Cross-Venue Markets (v2)

Predexon v2 unifies markets across Polymarket, Kalshi, Limitless, Opinion, Predict.Fun behind canonical IDs. One call returns the same question regardless of venue.

```python
# All canonical markets (filter by venue, status, category, league, event_id)
markets = client.pm("markets", venue="polymarket", status="active")
for m in markets.get("markets", [])[:10]:
    print(f"{m.get('predexon_id')} — {m.get('title')}")

# Flattened venue-native listings (each row = a tradable listing on one venue)
listings = client.pm("markets/listings", category="elections")

# Resolve a canonical outcome ID across venues
detail = client.pm("outcomes/PXM-12345")
print(detail.get("title"), detail.get("venue_listings"))
```

### 7. Sports Markets (v2)

```python
# List sports categories (NBA, NFL, MLB, soccer leagues, …)
categories = client.pm("sports/categories")

# Sports markets grouped by game — filter by league or venue
nba = client.pm("sports/markets", league="NBA", status="open")
for game in nba.get("markets", [])[:10]:
    print(f"{game.get('title')} @ {game.get('start_time')}")
    for venue in game.get("venue_listings", []):
        print(f"  {venue.get('venue')}: {venue.get('price')}")
```

### 8. Keyset Pagination (v2)

For large Polymarket result sets, prefer keyset pagination over offset. It is stable across writes and faster on big tables.

```python
# First page
page = client.pm("polymarket/markets/keyset", limit="100")
markets = page.get("markets", [])
next_key = page.get("pagination", {}).get("next_key")

# Subsequent pages
while next_key:
    page = client.pm("polymarket/markets/keyset", limit="100", pagination_key=next_key)
    markets.extend(page.get("markets", []))
    next_key = page.get("pagination", {}).get("next_key")
```

### 9. Wallet Identity & On-Chain Clustering (v2, Tier 2)

Cross-context wallet labels (ENS, Twitter, Discord, portfolio metrics) plus on-chain relationship graph data — exposed as three endpoints. **All Tier 2 ($0.005/call).**

```python
# Single wallet identity
ident = client.pm("polymarket/wallet/identity/0xabc...")
print(ident.get("ens_name"), ident.get("twitter"), ident.get("portfolio_value"))

# Bulk identity lookup (POST, up to 200 wallets per call)
batch = client.pm_query("polymarket/wallet/identities", {
    "addresses": ["0xabc...", "0xdef...", "0x123..."],
})
for row in batch.get("results", []):
    print(row.get("wallet"), row.get("label"))

# Cluster — discover wallets connected via on-chain transfers + identity proofs
cluster = client.pm("polymarket/wallet/0xabc.../cluster")
for related in cluster.get("cluster", []):
    print(related.get("wallet"), related.get("relationship_type"), related.get("confidence_score"))
```

## Common Workflows

**"What are people betting on in crypto right now?"**
```python
events = client.pm("polymarket/search", q="crypto bitcoin ethereum")
for e in events.get("data", [])[:5]:
    print(e.get("title", "?"))
    for o in e.get("outcomes", []):
        print(f"  {o.get('title')}: {o.get('price')} (implies {round(float(o.get('price', 0))*100)}%)")
```

**"Track a smart wallet's identity + cluster"**
```python
seed = "0xabc..."
ident = client.pm(f"polymarket/wallet/identity/{seed}")
cluster = client.pm(f"polymarket/wallet/{seed}/cluster")
print(f"{ident.get('label')} (ENS {ident.get('ens_name')})")
print(f"  Cluster size: {len(cluster.get('cluster', []))} wallets")
```

**"What's the probability of X event?"**
```python
# 1. Search for the event
results = client.pm("polymarket/search", q="US election 2026")

# 2. Get specific market details
if results.get("data"):
    market_id = results["data"][0].get("id", results["data"][0].get("slug"))
    detail = client.pm(f"polymarket/events/{market_id}")
    print(detail)
```

**"Show me all active Kalshi markets"**
```python
data = client.pm_query("kalshi/query", {"limit": 50, "status": "open"})
markets = data.get("markets", data.get("data", []))
for m in markets[:10]:
    print(f"{m.get('ticker')} — {m.get('title')}: YES={m.get('yes_bid')} NO={m.get('no_bid')}")
```

## Data Case Study: Sentiment Signal from Markets

Prediction markets are often better probability estimates than polls or pundit takes. Pattern:

```python
import json

# 1. Find relevant markets
crypto_markets = client.pm("polymarket/search", q="bitcoin price end of year")

# 2. Extract implied probabilities
for market in crypto_markets.get("data", [])[:3]:
    print(f"\n{market.get('title', '?')}")
    for outcome in market.get("outcomes", []):
        p = float(outcome.get("price", 0)) * 100
        print(f"  {outcome.get('title')}: {p:.0f}% implied probability")

# 3. Save for later analysis
with open(os.path.expanduser("~/.blockrun/data/markets_snapshot.json"), "w") as f:
    json.dump(crypto_markets, f, indent=2, default=str)
```

## Notes on Response Shape

Predexon returns raw API responses. Structure varies by exchange:
- **Polymarket**: usually `{ "data": [...] }` or `{ "events": [...] }`
- **Kalshi**: usually `{ "markets": [...] }` with `ticker`, `yes_bid`, `no_bid` fields
- **Print raw response first** when exploring a new path: `print(json.dumps(result, indent=2)[:1000])`

## Requirements

- BlockRun SDK: `pip install blockrun-llm`
- USDC wallet funded (`client.get_balance()`)
- Kalshi tickers: format is `KXBTC-25MAR14` (series + expiry date)
