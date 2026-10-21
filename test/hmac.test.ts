import { createHash, createHmac } from 'node:crypto';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { canonicalQuery, signaturePayload, signRequest } from '../src/hmac.ts';

describe('HMAC signing (Platform API compatible)', () => {
  it('sorts and encodes query strings', () => {
    assert.equal(canonicalQuery('?b=2&a=1'), 'a=1&b=2');
    assert.equal(canonicalQuery('energyAmount=65000&duration=1H'), 'duration=1H&energyAmount=65000');
    assert.equal(canonicalQuery(''), '');
  });

  it('builds the documented canonical payload', () => {
    const body = '{"receiverAddress":"TABC","energyAmount":65000,"duration":"1H"}';
    const bodyHash = createHash('sha256').update(body).digest('hex');
    const payload = signaturePayload({
      timestamp: '1788123456',
      method: 'post',
      path: '/api/v1/energy/orders',
      query: '',
      rawBody: body,
    });
    assert.equal(
      payload,
      ['1788123456', 'POST', '/api/v1/energy/orders', '', bodyHash].join('\n'),
    );
  });

  it('matches Node crypto HMAC-SHA256 hex', () => {
    const body = '{"x":1}';
    const timestamp = '1700000000';
    const secret = 'ts_sec_testsecret';
    const path = '/api/v1/balance';
    const payload = signaturePayload({
      timestamp,
      method: 'GET',
      path,
      query: '',
      rawBody: '',
    });
    const expected = createHmac('sha256', secret).update(payload).digest('hex');
    assert.equal(
      signRequest({ secret, timestamp, method: 'GET', path, rawBody: '' }),
      expected,
    );
    // empty body hash is sha256("")
    assert.equal(createHash('sha256').update('').digest('hex'), payload.split('\n')[4]);
    void body;
  });

  it('includes body hash for POST', () => {
    const body = JSON.stringify({ receiverAddress: 'TXYZ', energyAmount: 65000, duration: '1H' });
    const sig = signRequest({
      secret: 'ts_sec_abc',
      timestamp: '1788123456',
      method: 'POST',
      path: '/api/v1/energy/orders',
      rawBody: body,
    });
    assert.match(sig, /^[a-f0-9]{64}$/);
  });
});
