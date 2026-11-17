'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

const RazorpayAdapter = require('../services/payment/adapters/razorpayAdapter');
const CashfreeAdapter = require('../services/payment/adapters/cashfreeAdapter');
const { getAdapter, PaymentGatewayFactory } = require('../services/payment/paymentGatewayFactory');

test('RazorpayAdapter: Signature and Webhook Verification', async (t) => {
  const adapter = new RazorpayAdapter();
  const credentials = {
    keyId: 'rzp_test_key123',
    keySecret: 'secret_key_456',
    webhookSecret: 'whsec_test_789',
  };

  await t.test('verifies valid client payment signature', () => {
    const orderId = 'order_test_123';
    const paymentId = 'pay_test_456';
    const validSignature = crypto
      .createHmac('sha256', credentials.keySecret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    const isValid = adapter.verifyPayment(
      { orderId, paymentId, signature: validSignature },
      credentials
    );
    assert.strictEqual(isValid, true);
  });

  await t.test('rejects forged client payment signature', () => {
    const orderId = 'order_test_123';
    const paymentId = 'pay_test_456';
    const forgedSignature = '00'.repeat(32);

    const isValid = adapter.verifyPayment(
      { orderId, paymentId, signature: forgedSignature },
      credentials
    );
    assert.strictEqual(isValid, false);
  });

  await t.test('verifies valid webhook signature on raw body', () => {
    const rawBody = Buffer.from(JSON.stringify({ event: 'payment.captured', id: 'evt_1' }));
    const validSignature = crypto
      .createHmac('sha256', credentials.webhookSecret)
      .update(rawBody)
      .digest('hex');

    const isValid = adapter.verifyWebhookSignature(
      { rawBody, signature: validSignature },
      credentials
    );
    assert.strictEqual(isValid, true);
  });

  await t.test('rejects invalid webhook signature', () => {
    const rawBody = Buffer.from(JSON.stringify({ event: 'payment.captured' }));
    const invalidSignature = 'ab'.repeat(32);

    const isValid = adapter.verifyWebhookSignature(
      { rawBody, signature: invalidSignature },
      credentials
    );
    assert.strictEqual(isValid, false);
  });
});

test('RazorpayAdapter: Order creation and connection check with mock HTTP', async (t) => {
  const credentials = {
    keyId: 'rzp_test_key123',
    keySecret: 'secret_key_456',
  };

  await t.test('creates order successfully', async () => {
    let capturedUrl = null;
    let capturedOptions = null;

    const mockHttpClient = async (url, options) => {
      capturedUrl = url;
      capturedOptions = options;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          id: 'order_rzp_mock_123',
          amount: 50000,
          currency: 'INR',
          status: 'created',
        }),
      };
    };

    const adapter = new RazorpayAdapter({ httpClient: mockHttpClient });
    const result = await adapter.createOrder(
      { amount: 500, currency: 'INR', receipt: 'txn_123', idempotencyKey: 'idemp_abc' },
      credentials
    );

    assert.strictEqual(result.gatewayOrderId, 'order_rzp_mock_123');
    assert.strictEqual(result.amount, 500);
    assert.strictEqual(capturedUrl, 'https://api.razorpay.com/v1/orders');
    assert.strictEqual(capturedOptions.headers['X-Razorpay-Idempotency-Key'], 'idemp_abc');
    assert.ok(capturedOptions.headers.Authorization.startsWith('Basic '));
  });

  await t.test('testConnection returns success on 200', async () => {
    const mockHttpClient = async () => ({
      ok: true,
      status: 200,
      json: async () => ({ items: [] }),
    });

    const adapter = new RazorpayAdapter({ httpClient: mockHttpClient });
    const res = await adapter.testConnection(credentials);
    assert.strictEqual(res.success, true);
  });

  await t.test('testConnection returns failure on 401', async () => {
    const mockHttpClient = async () => ({
      ok: false,
      status: 401,
      json: async () => ({ error: { description: 'Invalid key' } }),
    });

    const adapter = new RazorpayAdapter({ httpClient: mockHttpClient });
    const res = await adapter.testConnection(credentials);
    assert.strictEqual(res.success, false);
    assert.match(res.message, /Authentication failed/);
  });
});

test('CashfreeAdapter: Webhook verification and order creation', async (t) => {
  const credentials = {
    keyId: 'CF_APP_123',
    keySecret: 'CF_SEC_456',
    webhookSecret: 'cf_wh_sec_789',
    isTestMode: true,
  };

  const adapter = new CashfreeAdapter();

  await t.test('verifies valid webhook signature with fresh timestamp', () => {
    const timestamp = Math.floor(Date.now() / 1000);
    const rawBody = JSON.stringify({ type: 'PAYMENT_SUCCESS_WEBHOOK', order_id: 'ord_1' });
    const signaturePayload = `${timestamp}${rawBody}`;
    const validSignature = crypto
      .createHmac('sha256', credentials.webhookSecret)
      .update(signaturePayload, 'utf8')
      .digest('base64');

    const isValid = adapter.verifyWebhookSignature(
      { rawBody, timestamp, signature: validSignature },
      credentials
    );
    assert.strictEqual(isValid, true);
  });

  await t.test('rejects webhook with expired timestamp (drift > 300s)', () => {
    const expiredTimestamp = Math.floor(Date.now() / 1000) - 600; // 10 minutes ago
    const rawBody = JSON.stringify({ type: 'PAYMENT_SUCCESS_WEBHOOK' });
    const signaturePayload = `${expiredTimestamp}${rawBody}`;
    const signature = crypto
      .createHmac('sha256', credentials.webhookSecret)
      .update(signaturePayload, 'utf8')
      .digest('base64');

    const isValid = adapter.verifyWebhookSignature(
      { rawBody, timestamp: expiredTimestamp, signature },
      credentials
    );
    assert.strictEqual(isValid, false);
  });

  await t.test('creates Cashfree order in sandbox environment', async () => {
    let capturedUrl = null;
    let capturedHeaders = null;

    const mockHttpClient = async (url, options) => {
      capturedUrl = url;
      capturedHeaders = options.headers;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          order_id: 'ord_cf_123',
          payment_session_id: 'session_cf_456',
          order_amount: 250.0,
          order_currency: 'INR',
          order_status: 'ACTIVE',
        }),
      };
    };

    const cfAdapter = new CashfreeAdapter({ httpClient: mockHttpClient });
    const result = await cfAdapter.createOrder(
      {
        orderId: 'ord_cf_123',
        amount: 250,
        currency: 'INR',
        customerDetails: { customerEmail: 'student@college.edu', customerName: 'Student One' },
      },
      credentials
    );

    assert.strictEqual(result.gatewayOrderId, 'ord_cf_123');
    assert.strictEqual(result.paymentSessionId, 'session_cf_456');
    assert.strictEqual(capturedUrl, 'https://sandbox.cashfree.com/pg/orders');
    assert.strictEqual(capturedHeaders['x-client-id'], 'CF_APP_123');
    assert.strictEqual(capturedHeaders['x-api-version'], '2023-08-01');
  });
});

test('PaymentGatewayFactory: Provider Resolution', () => {
  const rzp = getAdapter('RAZORPAY');
  assert.ok(rzp instanceof RazorpayAdapter);

  const cf = getAdapter('CASHFREE');
  assert.ok(cf instanceof CashfreeAdapter);

  assert.throws(() => getAdapter('STRIPE'), /Unsupported payment gateway provider/);
  assert.throws(() => getAdapter(''), /valid payment gateway provider is required/);
});
