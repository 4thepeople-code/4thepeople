'use strict';

const crypto = require('crypto');

/**
 * Razorpay Payment Gateway Adapter
 *
 * Implements standard provider-independent payment operations for Razorpay API v1.
 * Uses native Node.js fetch and crypto. Never logs credentials, signatures, or auth headers.
 */
class RazorpayAdapter {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || 'https://api.razorpay.com/v1';
    this.httpClient = options.httpClient || fetch;
  }

  /**
   * Helper to construct Basic Authorization header from keyId and keySecret.
   */
  _getAuthHeader(credentials) {
    if (!credentials || !credentials.keyId || !credentials.keySecret) {
      throw new Error('Razorpay keyId and keySecret are required');
    }
    const token = Buffer.from(`${credentials.keyId}:${credentials.keySecret}`).toString('base64');
    return `Basic ${token}`;
  }

  /**
   * Creates an order with Razorpay.
   *
   * @param {Object} orderData
   * @param {number} orderData.amount - Amount in currency units (INR)
   * @param {string} orderData.currency - Currency code (e.g. 'INR')
   * @param {string} orderData.receipt - Unique internal transaction identifier
   * @param {Object} [orderData.notes] - Additional non-sensitive metadata
   * @param {string} [orderData.idempotencyKey] - Optional deduplication header
   * @param {Object} credentials - Decrypted gateway credentials
   * @returns {Promise<Object>} Formatted order response
   */
  async createOrder(orderData, credentials) {
    const amountInPaise = Math.round(Number(orderData.amount) * 100);
    if (isNaN(amountInPaise) || amountInPaise <= 0) {
      throw new Error('Valid positive amount is required for Razorpay order');
    }

    const payload = {
      amount: amountInPaise,
      currency: orderData.currency || 'INR',
      receipt: String(orderData.receipt || ''),
      notes: orderData.notes || {},
    };

    const headers = {
      'Content-Type': 'application/json',
      Authorization: this._getAuthHeader(credentials),
    };

    if (orderData.idempotencyKey) {
      headers['X-Razorpay-Idempotency-Key'] = String(orderData.idempotencyKey);
    }

    const res = await this.httpClient(`${this.baseUrl}/orders`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) {
      const isAuthErr = res.status === 401 || res.status === 403;
      const errMsg = isAuthErr
        ? 'Payment gateway rejected credentials. Please verify your Razorpay Key ID and Secret in College Payment Configuration.'
        : ((data && data.error && data.error.description) || `Razorpay order creation failed (status ${res.status})`);
      const err = new Error(errMsg);
      err.statusCode = isAuthErr ? 502 : res.status;
      err.isOperational = true;
      err.gatewayError = data.error;
      throw err;
    }

    return {
      gatewayOrderId: data.id,
      amount: Number(data.amount) / 100,
      currency: data.currency,
      status: data.status,
      rawResponse: data,
    };
  }

  /**
   * Verifies client-side payment completion signature (HMAC-SHA256).
   *
   * @param {Object} paymentData
   * @param {string} paymentData.orderId - Razorpay order ID (e.g. 'order_xyz')
   * @param {string} paymentData.paymentId - Razorpay payment ID (e.g. 'pay_abc')
   * @param {string} paymentData.signature - Razorpay signature hex string
   * @param {Object} credentials - Decrypted gateway credentials
   * @returns {boolean} True if signature is cryptographically valid
   */
  verifyPayment(paymentData, credentials) {
    if (!paymentData || !paymentData.orderId || !paymentData.paymentId || !paymentData.signature) {
      return false;
    }
    if (!credentials || !credentials.keySecret) {
      return false;
    }

    try {
      const expectedSignature = crypto
        .createHmac('sha256', credentials.keySecret)
        .update(`${paymentData.orderId}|${paymentData.paymentId}`)
        .digest('hex');

      const expectedBuf = Buffer.from(expectedSignature, 'utf8');
      const actualBuf = Buffer.from(paymentData.signature, 'utf8');

      if (expectedBuf.length !== actualBuf.length) {
        return false;
      }

      return crypto.timingSafeEqual(expectedBuf, actualBuf);
    } catch {
      return false;
    }
  }

  /**
   * Verifies an inbound webhook signature (HMAC-SHA256).
   *
   * @param {Object} webhookData
   * @param {Buffer|string} webhookData.rawBody - Raw unparsed webhook request payload
   * @param {string} webhookData.signature - x-razorpay-signature header
   * @param {Object} credentials - Decrypted gateway credentials (requires webhookSecret)
   * @returns {boolean} True if signature is valid
   */
  verifyWebhookSignature(webhookData, credentials) {
    if (!webhookData || !webhookData.rawBody || !webhookData.signature) {
      return false;
    }
    if (!credentials || !credentials.webhookSecret) {
      return false;
    }

    try {
      const rawBody = Buffer.isBuffer(webhookData.rawBody)
        ? webhookData.rawBody
        : Buffer.from(webhookData.rawBody, 'utf8');

      const expectedSignature = crypto
        .createHmac('sha256', credentials.webhookSecret)
        .update(rawBody)
        .digest('hex');

      const expectedBuf = Buffer.from(expectedSignature, 'utf8');
      const actualBuf = Buffer.from(webhookData.signature, 'utf8');

      if (expectedBuf.length !== actualBuf.length) {
        return false;
      }

      return crypto.timingSafeEqual(expectedBuf, actualBuf);
    } catch {
      return false;
    }
  }

  /**
   * Fetches payment details from Razorpay to verify authoritative state.
   *
   * @param {string} paymentId - Razorpay payment ID (e.g. 'pay_abc')
   * @param {Object} credentials
   * @returns {Promise<Object>}
   */
  async fetchPaymentStatus(paymentId, credentials) {
    if (!paymentId) throw new Error('paymentId is required');

    const res = await this.httpClient(`${this.baseUrl}/payments/${encodeURIComponent(paymentId)}`, {
      method: 'GET',
      headers: {
        Authorization: this._getAuthHeader(credentials),
      },
    });

    const data = await res.json();
    if (!res.ok) {
      const errMsg = (data && data.error && data.error.description) || `Failed to fetch payment status (${res.status})`;
      const err = new Error(errMsg);
      err.statusCode = res.status;
      throw err;
    }

    return {
      status: data.status, // 'captured', 'authorized', 'failed', etc.
      amount: Number(data.amount) / 100,
      currency: data.currency,
      method: data.method,
      vpa: data.vpa || null,
      captured: Boolean(data.captured),
      rawResponse: data,
    };
  }

  /**
   * Captures an authorized Razorpay payment.
   *
   * @param {string} paymentId - Razorpay payment ID (e.g. 'pay_abc')
   * @param {number} amount - Amount in currency units (INR)
   * @param {string} [currency='INR']
   * @param {Object} credentials
   * @returns {Promise<Object>}
   */
  async capturePayment(paymentId, amount, currency, credentials) {
    if (!paymentId) throw new Error('paymentId is required for capture');

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      throw new Error('Valid positive amount is required for capture');
    }

    const amountInPaise = Math.round(numAmount * 100);
    const payload = {
      amount: amountInPaise,
      currency: currency ? String(currency).toUpperCase() : 'INR',
    };

    const res = await this.httpClient(
      `${this.baseUrl}/payments/${encodeURIComponent(paymentId)}/capture`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: this._getAuthHeader(credentials),
        },
        body: JSON.stringify(payload),
      }
    );

    const data = await res.json();
    if (!res.ok) {
      const errMsg =
        (data && data.error && data.error.description) ||
        `Razorpay payment capture failed (${res.status})`;
      const err = new Error(errMsg);
      err.statusCode = res.status;
      err.gatewayError = data.error;
      throw err;
    }

    return {
      status: data.status,
      amount: Number(data.amount) / 100,
      currency: data.currency,
      captured: Boolean(data.captured),
      rawResponse: data,
    };
  }

  /**
   * Authoritatively fetches payments associated with a Razorpay order.
   *
   * @param {string} orderId - Razorpay order ID (e.g. 'order_abc')
   * @param {Object} credentials
   * @returns {Promise<Array<Object>>} List of payments for this order
   */
  async fetchOrderPayments(orderId, credentials) {
    if (!orderId) throw new Error('orderId is required');

    const res = await this.httpClient(
      `${this.baseUrl}/orders/${encodeURIComponent(orderId)}/payments`,
      {
        method: 'GET',
        headers: {
          Authorization: this._getAuthHeader(credentials),
        },
      }
    );

    const data = await res.json();
    if (!res.ok) {
      const errMsg =
        (data && data.error && data.error.description) ||
        `Failed to fetch Razorpay order payments (${res.status})`;
      const err = new Error(errMsg);
      err.statusCode = res.status;
      err.gatewayError = data.error;
      throw err;
    }

    const items = Array.isArray(data.items) ? data.items : [];
    return items.map((p) => ({
      id: p.id,
      amount: Number(p.amount) / 100,
      currency: p.currency,
      status: p.status,
      method: p.method,
      vpa: p.vpa || null,
      captured: Boolean(p.captured),
      rawResponse: p,
    }));
  }

  /**
   * Initiates a refund through Razorpay.
   *
   * @param {Object} refundData
   * @param {string} refundData.paymentId - Razorpay payment ID to refund
   * @param {number} refundData.amount - Amount in currency units (INR)
   * @param {string} [refundData.reason] - Refund note / reason
   * @param {string} [refundData.refundId] - Internal refund ID for correlation
   * @param {string} [refundData.idempotencyKey]
   * @param {Object} credentials
   * @returns {Promise<Object>}
   */
  async initiateRefund(refundData, credentials) {
    if (!refundData.paymentId) throw new Error('paymentId is required for refund');

    const amountInPaise = Math.round(Number(refundData.amount) * 100);
    if (isNaN(amountInPaise) || amountInPaise <= 0) {
      throw new Error('Valid positive amount is required for refund');
    }

    const payload = {
      amount: amountInPaise,
      speed: 'normal',
      notes: {
        reason: refundData.reason || 'Requested refund',
        refundId: refundData.refundId ? String(refundData.refundId) : undefined,
      },
    };

    const headers = {
      'Content-Type': 'application/json',
      Authorization: this._getAuthHeader(credentials),
    };

    if (refundData.idempotencyKey) {
      headers['X-Razorpay-Idempotency-Key'] = String(refundData.idempotencyKey);
    }

    const res = await this.httpClient(
      `${this.baseUrl}/payments/${encodeURIComponent(refundData.paymentId)}/refund`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      }
    );

    const data = await res.json();
    if (!res.ok) {
      const errMsg = (data && data.error && data.error.description) || `Razorpay refund failed (${res.status})`;
      const err = new Error(errMsg);
      err.statusCode = res.status;
      err.gatewayError = data.error;
      throw err;
    }

    return {
      gatewayRefundId: data.id,
      status: data.status, // 'processed', 'pending', etc.
      amount: Number(data.amount) / 100,
      currency: data.currency,
      rawResponse: data,
    };
  }

  /**
   * Fetches refund status from Razorpay.
   *
   * @param {string} refundId - Razorpay refund ID
   * @param {Object} credentials
   * @returns {Promise<Object>}
   */
  async fetchRefundStatus(refundId, credentials) {
    if (!refundId) throw new Error('refundId is required');

    const res = await this.httpClient(`${this.baseUrl}/refunds/${encodeURIComponent(refundId)}`, {
      method: 'GET',
      headers: {
        Authorization: this._getAuthHeader(credentials),
      },
    });

    const data = await res.json();
    if (!res.ok) {
      const errMsg = (data && data.error && data.error.description) || `Failed to fetch refund status (${res.status})`;
      const err = new Error(errMsg);
      err.statusCode = res.status;
      throw err;
    }

    return {
      gatewayRefundId: data.id,
      status: data.status, // 'processed', 'pending'
      amount: Number(data.amount) / 100,
      currency: data.currency,
      rawResponse: data,
    };
  }

  /**
   * Tests credentials connectivity against Razorpay API.
   *
   * @param {Object} credentials
   * @returns {Promise<{ success: boolean, message: string }>}
   */
  async testConnection(credentials) {
    try {
      const res = await this.httpClient(`${this.baseUrl}/payments?count=1`, {
        method: 'GET',
        headers: {
          Authorization: this._getAuthHeader(credentials),
        },
      });

      if (res.ok) {
        return { success: true, message: 'Razorpay connection verified successfully.' };
      }

      if (res.status === 401 || res.status === 403) {
        return { success: false, message: 'Authentication failed: Invalid Razorpay Key ID or Key Secret.' };
      }

      return { success: false, message: `Razorpay connection failed with HTTP status ${res.status}` };
    } catch (err) {
      return { success: false, message: `Razorpay connection check failed: ${err.message}` };
    }
  }
}

module.exports = RazorpayAdapter;
