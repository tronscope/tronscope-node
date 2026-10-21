/**
 * Minimal runnable example (after npm run build):
 *
 *   TRONSCOPE_API_KEY=ts_live_... TRONSCOPE_API_SECRET=ts_sec_... \
 *     node examples/quickstart.mjs
 */
import { TronScope } from '../dist/index.js';

const apiKey = process.env.TRONSCOPE_API_KEY;
const apiSecret = process.env.TRONSCOPE_API_SECRET;

if (!apiKey || !apiSecret) {
  console.error('Set TRONSCOPE_API_KEY and TRONSCOPE_API_SECRET');
  process.exit(1);
}

const client = new TronScope({
  apiKey,
  apiSecret,
  baseUrl: process.env.TRONSCOPE_BASE_URL || 'https://api.tronscope.io',
});

const balance = await client.balance();
console.log('balance', balance);

const rates = await client.energyRates({ energyAmount: 65_000, duration: '1H' });
console.log('rates', rates);
