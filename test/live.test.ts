/**
 * Live smoke against a real TronScope API (local or production).
 *
 * Env:
 *   TRONSCOPE_API_KEY
 *   TRONSCOPE_API_SECRET
 *   TRONSCOPE_BASE_URL   (default http://127.0.0.1:4000)
 *
 * Skip automatically when credentials are missing:
 *   npm test
 *
 * Force run:
 *   TRONSCOPE_API_KEY=... TRONSCOPE_API_SECRET=... npm run test:live
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { TronScope } from '../src/client.ts';
import { TronScopeError } from '../src/errors.ts';

const apiKey = process.env.TRONSCOPE_API_KEY?.trim() || '';
const apiSecret = process.env.TRONSCOPE_API_SECRET?.trim() || '';
const baseUrl = (process.env.TRONSCOPE_BASE_URL || 'http://127.0.0.1:4000').replace(/\/+$/, '');
const hasCreds = Boolean(apiKey && apiSecret);
const runLive = hasCreds && (process.env.TRONSCOPE_LIVE === '1' || process.env.npm_lifecycle_event === 'test:live' || process.argv.includes('--live'));

describe('live Platform API', { concurrency: 1, skip: !runLive ? 'set TRONSCOPE_API_KEY + TRONSCOPE_API_SECRET (and use npm run test:live)' : false }, () => {
  const client = new TronScope({ apiKey, apiSecret, baseUrl });

  it('GET /api/v1/energy/config', async () => {
    const config = await client.energyConfig();
    assert.ok(config.minEnergy >= 1000);
    assert.ok(Array.isArray(config.durations));
    assert.ok(config.durations.includes('1H'));
  });

  it('GET /api/v1/balance', async () => {
    const balance = await client.balance();
    assert.equal(balance.asset, 'TRX');
    assert.ok(typeof balance.availableSun === 'string' || typeof balance.availableSun === 'number');
  });

  it('GET /api/v1/account', async () => {
    const account = await client.account();
    assert.ok(account.id);
  });

  it('GET /api/v1/deposit-address', async () => {
    try {
      const deposit = await client.depositAddress();
      assert.equal(deposit.network, 'TRON');
      assert.match(deposit.address, /^T/);
    } catch (err) {
      // Local/dev may not have the customer deposit signer configured.
      assert.ok(err instanceof TronScopeError);
      assert.ok(
        err.code === 'DEPOSIT_SIGNER_NOT_CONFIGURED' || err.status >= 500,
        `unexpected deposit error: ${err.code} ${err.message}`,
      );
    }
  });

  it('GET /api/v1/energy/rates', async () => {
    const rates = await client.energyRates({ energyAmount: 65_000, duration: '1H' });
    assert.equal(rates.energyAmount, 65_000);
    assert.ok(Number(rates.priceSun) > 0 || Number(rates.sunPerUnit) > 0);
  });

  it('GET /api/v1/energy/orders', async () => {
    const orders = await client.energyOrders({ limit: 5 });
    assert.ok(orders != null);
  });

  it('invalid signature returns TronScopeError', async () => {
    const bad = new TronScope({ apiKey, apiSecret: 'ts_sec_definitely_wrong', baseUrl });
    await assert.rejects(() => bad.balance(), (err: unknown) => {
      assert.ok(err instanceof TronScopeError);
      assert.equal(err.status, 401);
      return true;
    });
  });
});
