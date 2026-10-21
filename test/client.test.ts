import assert from 'node:assert/strict';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { createHash, createHmac } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { TronScope } from '../src/client.ts';
import { TronScopeError } from '../src/errors.ts';
import { canonicalQuery } from '../src/hmac.ts';

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function verifyHmac(req: IncomingMessage, rawBody: string, secret: string) {
  const key = String(req.headers['x-api-key'] || '');
  const timestamp = String(req.headers['x-timestamp'] || '');
  const signature = String(req.headers['x-signature'] || '');
  const url = new URL(req.url || '/', 'http://127.0.0.1');
  const payload = [
    timestamp,
    String(req.method || 'GET').toUpperCase(),
    url.pathname,
    canonicalQuery(url.search),
    createHash('sha256').update(rawBody || '').digest('hex'),
  ].join('\n');
  const expected = createHmac('sha256', secret).update(payload).digest('hex');
  return { ok: key && signature.toLowerCase() === expected, payload, expected, signature };
}

describe('TronScope client against mock Platform API', () => {
  const apiKey = 'ts_live_mockkey';
  const apiSecret = 'ts_sec_mocksecret';
  let baseUrl = '';
  let server: ReturnType<typeof createServer>;

  before(async () => {
    server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
      const rawBody = await readBody(req);
      const url = new URL(req.url || '/', 'http://127.0.0.1');
      const check = verifyHmac(req, rawBody, apiSecret);

      res.setHeader('content-type', 'application/json');
      res.setHeader('x-request-id', 'req_test_1');

      if (!check.ok) {
        res.statusCode = 401;
        res.end(JSON.stringify({ code: 'INVALID_SIGNATURE', message: 'Request signature is invalid.' }));
        return;
      }

      if (url.pathname === '/api/v1/balance' && req.method === 'GET') {
        res.end(JSON.stringify({ asset: 'TRX', availableSun: '25000000', available: '25' }));
        return;
      }
      if (url.pathname === '/api/v1/energy/rates' && req.method === 'GET') {
        res.end(
          JSON.stringify({
            energyAmount: Number(url.searchParams.get('energyAmount') || 65000),
            duration: url.searchParams.get('duration') || '1H',
            sunPerUnit: 100,
            priceSun: '6500000',
            balanceSun: '25000000',
          }),
        );
        return;
      }
      if (url.pathname === '/api/v1/energy/orders' && req.method === 'POST') {
        if (!req.headers['x-idempotency-key']) {
          res.statusCode = 400;
          res.end(JSON.stringify({ code: 'IDEMPOTENCY_CONFLICT', message: 'X-Idempotency-Key required' }));
          return;
        }
        const body = JSON.parse(rawBody || '{}');
        res.statusCode = 201;
        res.end(
          JSON.stringify({
            orderId: 'en_mock',
            status: 'created',
            energyAmount: body.energyAmount,
            feeSun: 6500000,
            balanceSun: 18500000,
          }),
        );
        return;
      }
      if (url.pathname === '/api/v1/boom') {
        res.statusCode = 429;
        res.end(JSON.stringify({ error: { code: 'RATE_LIMITED', message: 'Too many requests' } }));
        return;
      }

      res.statusCode = 404;
      res.end(JSON.stringify({ code: 'NOT_FOUND', message: 'missing' }));
    });

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve());
    });
    const addr = server.address();
    if (!addr || typeof addr === 'string') throw new Error('no port');
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  after(async () => {
    await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  });

  it('GET balance with valid HMAC', async () => {
    const client = new TronScope({ apiKey, apiSecret, baseUrl });
    const balance = await client.balance();
    assert.equal(balance.asset, 'TRX');
    assert.equal(balance.available, '25');
  });

  it('GET energy rates with query', async () => {
    const client = new TronScope({ apiKey, apiSecret, baseUrl });
    const rates = await client.energyRates({ energyAmount: 65000, duration: '1H' });
    assert.equal(rates.energyAmount, 65000);
    assert.equal(rates.duration, '1H');
  });

  it('POST energy order with idempotency key', async () => {
    const client = new TronScope({ apiKey, apiSecret, baseUrl });
    const order = await client.createEnergyOrder({
      receiverAddress: 'TXYZabc123ExampleReceiverAddress',
      energyAmount: 65000,
      duration: '1H',
      externalOrderId: 'merchant-order-10041',
      idempotencyKey: 'order-10041',
    });
    assert.equal(order.orderId, 'en_mock');
    assert.equal(order.energyAmount, 65000);
  });

  it('rejects wrong secret', async () => {
    const client = new TronScope({ apiKey, apiSecret: 'ts_sec_wrong', baseUrl });
    await assert.rejects(() => client.balance(), (err: unknown) => {
      assert.ok(err instanceof TronScopeError);
      assert.equal(err.status, 401);
      assert.equal(err.code, 'INVALID_SIGNATURE');
      return true;
    });
  });

  it('maps API errors to TronScopeError', async () => {
    const client = new TronScope({ apiKey, apiSecret, baseUrl });
    await assert.rejects(() => client.get('/api/v1/boom'), (err: unknown) => {
      assert.ok(err instanceof TronScopeError);
      assert.equal(err.status, 429);
      assert.equal(err.code, 'RATE_LIMITED');
      assert.equal(err.requestId, 'req_test_1');
      return true;
    });
  });
});
