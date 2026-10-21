# TronScope Node.js SDK — TRON Energy API, Wallet & Watchlist

**Official TypeScript / Node.js client for the [TronScope Platform API](https://tronscope.io/docs).**

Use this package to:

- Rent **TRON Energy** programmatically (prepaid TRX → Energy rental orders)
- Read **TRX / USDT wallet balances** and transfer history on TRON Mainnet
- Manage a **wallet watchlist** (alerts / webhooks) from your backend
- Check **prepaid TRX balance** and deposit addresses

Works with Node.js 18+ (native `fetch` + `crypto`). Zero runtime dependencies. ESM + CommonJS.

| | |
|---|---|
| **npm** | `npm install tronscope` |
| **Docs** | https://tronscope.io/docs |
| **Developers** | https://tronscope.io/developers |
| **API base** | `https://api.tronscope.io` |
| **Auth** | HMAC-SHA256 (`X-API-Key`, `X-Timestamp`, `X-Signature`) |

---

## Why TronScope?

[tronscope.io](https://tronscope.io) is a TRON explorer and Energy marketplace. The Platform API lets exchanges, bots, payment processors, and SaaS backends:

1. **Buy TRON Energy** for USDT (TRC-20) transfers without freezing TRX
2. **Monitor wallets** for large TRX / USDT movements
3. **Analyze addresses** (balances, Energy, bandwidth, recent transfers)

This SDK signs every request the same way the HTTP docs describe — no hand-rolled HMAC.

---

## Install

```bash
npm install tronscope
# or
pnpm add tronscope
# or
yarn add tronscope
```

Create an API key in your TronScope account: [Account → API](https://tronscope.io/account) (or `/api/start`).

You get:

- `ts_live_…` — **API key** (public id)
- `ts_sec_…` — **API secret** (shown once — store it like a password)

---

## Quick start

```ts
import { TronScope, TronScopeError } from 'tronscope';

const client = new TronScope({
  apiKey: process.env.TRONSCOPE_API_KEY!,
  apiSecret: process.env.TRONSCOPE_API_SECRET!,
  // baseUrl: 'https://api.tronscope.io', // default production
});

// Prepaid TRX balance (SUN = 1e-6 TRX)
const balance = await client.balance();
console.log(balance.available, 'TRX');

// Live Energy rental quote (does not spend)
const quote = await client.energyRates({
  energyAmount: 65_000,
  duration: '1H',
});
console.log('priceSun', quote.priceSun);

// Create Energy rental for a receiver address
try {
  const order = await client.createEnergyOrder({
    receiverAddress: 'TYourReceiverAddressHere…………',
    energyAmount: 65_000,
    duration: '1H',
    externalOrderId: 'merchant-order-10041',
  });
  console.log(order.orderId, order.status);
} catch (err) {
  if (err instanceof TronScopeError) {
    console.error(err.status, err.code, err.message, err.requestId);
  }
  throw err;
}
```

CommonJS:

```js
const { TronScope } = require('tronscope');
```

---

## Authentication (HMAC)

Every request includes:

| Header | Value |
|--------|--------|
| `X-API-Key` | your `ts_live_…` key |
| `X-Timestamp` | Unix seconds |
| `X-Signature` | `HMAC-SHA256(secret, canonical)` hex |
| `X-Idempotency-Key` | required on `POST /api/v1/energy/orders` |

Canonical string (newline-separated):

```text
timestamp
METHOD
/api/v1/...
canonical_query
sha256_hex(raw_body)
```

The SDK builds this for you. Low-level helpers are also exported:

```ts
import { signRequest, signaturePayload, canonicalQuery } from 'tronscope';
```

Timestamps must be within ~5 minutes of server time. Signatures are single-use (replay protected). The SDK automatically waits for the next Unix second if two identical requests would otherwise collide in the same second.

---

## API surface

Base path: `/api/v1` on `https://api.tronscope.io`.

### Account & prepaid TRX

| Method | HTTP | Scope |
|--------|------|--------|
| `account()` | `GET /account` | `balance:read` |
| `balance()` | `GET /balance` | `balance:read` |
| `balanceTransactions(limit?)` | `GET /balance/transactions` | `balance:read` |
| `depositAddress()` | `GET /deposit-address` | `balance:read` |
| `deposits()` | `GET /deposits` | `balance:read` |
| `deposit(id)` | `GET /deposits/:id` | `balance:read` |

Deposit only **TRX** on TRON Mainnet to your deposit address. Confirmed deposits credit prepaid balance used for Energy orders.

### TRON Energy rental

| Method | HTTP | Scope |
|--------|------|--------|
| `energyConfig()` | `GET /energy/config` | (signed) |
| `energyRates({ energyAmount, duration })` | `GET /energy/rates` | `quotes:read` |
| `createEnergyOrder({ … })` | `POST /energy/orders` | `orders:write` |
| `energyOrders({ status, limit })` | `GET /energy/orders` | `orders:read` |
| `energyOrder(orderId)` | `GET /energy/orders/:id` | `orders:read` |
| `energyOrderByExternalId(id)` | `GET /energy/orders/by-external-id/:id` | `orders:read` |

Durations: `1H`, `1D`, `3D`, `30D`. Typical USDT transfer Energy amount is around **65,000**.

`createEnergyOrder` always sends `X-Idempotency-Key` (auto UUID if you omit `idempotencyKey`). Reusing the same key with a different body returns `IDEMPOTENCY_CONFLICT`.

### Watchlist (Pro / Enterprise)

| Method | HTTP | Scope |
|--------|------|--------|
| `watchlists()` | `GET /watchlists` | `watchlist:read` |
| `watchlistCategories()` | `GET /watchlists/categories` | `watchlist:read` |
| `addWatchlist({ address, … })` | `POST /watchlists` | `watchlist:write` |
| `watchlistContains(address)` | `GET /watchlists/contains/:address` | `watchlist:read` |
| `updateWatchlist(address, …)` | `PATCH /watchlists/:address` | `watchlist:write` |
| `removeWatchlist(address)` | `DELETE /watchlists/:address` | `watchlist:write` |

### Wallet analyze (Pro / Enterprise)

| Method | HTTP | Scope |
|--------|------|--------|
| `wallet(address)` | `GET /wallets/:address` | `wallets:read` |
| `walletTransactions(address, query?)` | `GET /wallets/:address/transactions` | `wallets:read` |

### Low-level

```ts
await client.get('/api/v1/balance');
await client.post('/api/v1/watchlists', { body: { address: 'T…' } });
await client.patch('/api/v1/watchlists/T…', { body: { nickname: 'Hot' } });
await client.delete('/api/v1/watchlists/T…');
await client.request('GET', '/api/v1/energy/config');
```

---

## Errors

Failed responses throw `TronScopeError`:

```ts
class TronScopeError extends Error {
  status: number;      // HTTP status (0 = network)
  code: string;        // e.g. INVALID_SIGNATURE, RATE_LIMITED
  requestId?: string;  // x-request-id
  body?: unknown;      // parsed JSON body
}
```

Common codes: `INVALID_API_KEY`, `INVALID_SIGNATURE`, `TIMESTAMP_EXPIRED`, `PERMISSION_DENIED`, `RATE_LIMITED`, `IDEMPOTENCY_CONFLICT`.

---

## Environment variables

| Variable | Description |
|----------|-------------|
| `TRONSCOPE_API_KEY` | `ts_live_…` |
| `TRONSCOPE_API_SECRET` | `ts_sec_…` |
| `TRONSCOPE_BASE_URL` | optional override (default production) |

Example:

```bash
export TRONSCOPE_API_KEY=ts_live_...
export TRONSCOPE_API_SECRET=ts_sec_...
node examples/quickstart.mjs
```

---

## TypeScript

Full typings ship in the package (`Balance`, `EnergyOrder`, `CreateEnergyOrderInput`, …).

```ts
import type { Balance, EnergyRate, EnergyOrder } from 'tronscope';
```

---

## Related links

- Product: [tronscope.io](https://tronscope.io)
- Energy marketplace: [tronscope.io/tron-energy](https://tronscope.io/tron-energy)
- Platform API docs: [tronscope.io/docs](https://tronscope.io/docs)
- AI / MCP: [tronscope.io/docs/ai](https://tronscope.io/docs/ai)
- OpenAPI: [tronscope.io/openapi.json](https://tronscope.io/openapi.json)

**Keywords:** TRON API, TRON Energy rental API, TRC20 USDT Energy, TRON wallet API, Node.js TRON SDK, HMAC API client, prepaid TRX Energy, tronscope.io

---

## Develop (this repo)

```bash
cd sdk
npm install
npm test          # unit + mock HTTP
npm run test:live # needs TRONSCOPE_API_KEY + TRONSCOPE_API_SECRET
npm run build
```

---

## License

MIT © TronScope
