---
name: prediction-markets
description: Use when user asks about event probabilities, prediction market odds, what people are betting on, Polymarket or Kalshi prices, or wants to find markets on a specific topic (elections, crypto, sports, macro events).
---

# Prediction Markets

Real-time prediction market data via BlockRun (powered by Predexon). Covers Polymarket, Kalshi, dFlow, and Binance Futures.

## Quick Decision Table

| User wants... | Method | Path | Cost |
|--------------|--------|------|------|
| Active Polymarket events | `client.pm(path)` | `"polymarket/events"` | $0.001 |
| Search Polymarket by topic | `client.pm(path, q=...)` | `"polymarket/search"` | $0.001 |
| Specific Kalshi market | `client.pm(path)` | `"kalshi/markets/TICKER"` | $0.001 |
| Complex/filtered query | `client.pm_query(path, body)` | `"polymarket/query"` | $0.005 |
| dFlow markets | `client.pm(path)` | `"dflow/..."` | $0.001 |
| Binance Futures | `client.pm(path)` | `"binance/..."` | $0.001 |

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

## Common Workflows

**"What are people betting on in crypto right now?"**
```python
events = client.pm("polymarket/search", q="crypto bitcoin ethereum")
for e in events.get("data", [])[:5]:
    print(e.get("title", "?"))
    for o in e.get("outcomes", []):
        print(f"  {o.get('title')}: {o.get('price')} (implies {round(float(o.get('price', 0))*100)}%)")
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
