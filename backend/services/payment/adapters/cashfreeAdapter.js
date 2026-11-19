'use strict';

const crypto = require('crypto');

/**
 * Cashfree Payment Gateway Adapter (PG API v2023-08-01)
 *
 * Implements standard provider-independent payment operations for Cashfree.
 * Uses native Node.js fetch and crypto. Never logs credentials, signatures, or auth headers.
 */
class CashfreeAdapter {
  constructor(options = {}) {
    this.sandboxBaseUrl = options.sandboxBaseUrl || 'https://sandbox.cashfree.com/pg';
    this.productionBaseUrl = options.productionBaseUrl || 'https://api.cashfree.com/pg';
    this.apiVersion = options.apiVersion || '2023-08-01';
    this.httpClient = options.httpClient || fetch;
    this.maxWebhookTimestampDriftSec = options.maxWebhookTimestampDriftSec || 300; // 5 minutes
  }

  /**
   * Resolves the base URL based on environment mode.
   */
  _getBaseUrl(credentials) {
    const isTest = credentials && credentials.isTestMode !== false;
    return isTest ? this.sandboxBaseUrl : this.productionBaseUrl;
  }

  /**
   * Constructs request headers for Cashfree API requests.
   */
  _getHeaders(credentials) {
    if (!credentials || !credentials.keyId || !credentials.keySecret) {
      throw new Error('Cashfree App ID (keyId) and Secret Key (keySecret) are required');
    }

    return {
      'Content-Type': 'application/json',
      'x-client-id': String(credentials.keyId),
      'x-client-secret': String(credentials.keySecret),
      'x-api-version': this.apiVersion,
    };
  }

  /**
   * Creates an order with Cashfree.
   *
   * @param {Object} orderData
   * @param {string} orderData.orderId - Internal unique order identifier
   * @param {number} orderData.amount - Amount in currency units (INR)
   * @param {string} [orderData.currency='INR']
   * @param {Object} [orderData.customerDetails]
   * @param {string} [orderData.returnUrl]
   * @param {Object} credentials - Decrypted gateway credentials
   * @returns {Promise<Object>} Formatted order response
   */
  async createOrder(orderData, credentials) {
    const amount = Number(orderData.amount);
    if (isNaN(amount) || amount <= 0) {
      throw new Error('Valid positive amount is required for Cashfree order');
    }

    const customer = orderData.customerDetails || {};
    const payload = {
      order_id: String(orderData.orderId),
      order_amount: Number(amount.toFixed(2)),
      order_currency: orderData.currency || 'INR',
      customer_details: {
        customer_id: String(customer.customerId || 'cust_' + crypto.randomBytes(4).toString('hex')),
        customer_email: String(customer.customerEmail || 'support@4thepeople.in'),
        customer_phone: String(customer.customerPhone || '9999999999'),
        customer_name: String(customer.customerName || 'Participant'),
      },
      order_meta: {
        return_url: orderData.returnUrl || 'https://4thepeople.in/payments/verify',
      },
    };

    const baseUrl = this._getBaseUrl(credentials);
    const res = await this.httpClient(`${baseUrl}/orders`, {
      method: 'POST',
      headers: this._getHeaders(credentials),
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) {
      const isAuthErr = res.status === 401 || res.status === 403;
      const errMsg = isAuthErr
        ? 'Payment gateway rejected credentials. Please verify your Cashfree App ID and Secret in College Payment Configuration.'
        : ((data && data.message) || `Cashfree order creation failed (status ${res.status})`);
      const err = new Error(errMsg);
      err.statusCode = isAuthErr ? 502 : res.status;
      err.isOperational = true;
      err.gatewayError = data;
      throw err;
    }

    return {
      gatewayOrderId: data.order_id,
      paymentSessionId: data.payment_session_id,
      amount: Number(data.order_amount),
      currency: data.order_currency,
      status: data.order_status, // 'ACTIVE', 'PAID', etc.
      rawResponse: data,
    };
  }

  /**
   * Verifies client-side payment completion by querying Cashfree API.
   * Cashfree does not rely on a client-submitted HMAC signature; payment verification
   * requires authoritative query to Cashfree order payments.
   *
   * @param {Object} paymentData
   * @param {string} paymentData.orderId - Cashfree order ID
   * @param {Object} credentials - Decrypted gateway credentials
   * @returns {Promise<Object>}
   */
  async verifyPayment(paymentData, credentials) {
    if (!paymentData || !paymentData.orderId) {
      return { isValid: false, reason: 'orderId is required' };
    }

    try {
      const baseUrl = this._getBaseUrl(credentials);
      const res = await this.httpClient(
        `${baseUrl}/orders/${encodeURIComponent(paymentData.orderId)}/payments`,
        {
          method: 'GET',
          headers: this._getHeaders(credentials),
        }
      );

      const payments = await res.json();
      if (!res.ok || !Array.isArray(payments)) {
        return { isValid: false, reason: 'Failed to retrieve order payments' };
      }

      // Locate successful payment
      const successfulPayment = payments.find(
        (p) => p.payment_status === 'SUCCESS'
      );

      if (!successfulPayment) {
        return { isValid: false, reason: 'No successful payment found for order' };
      }

      return {
        isValid: true,
        gatewayPaymentId: String(successfulPayment.cf_payment_id),
        amount: Number(successfulPayment.payment_amount),
        currency: successfulPayment.payment_currency,
        paymentMethod: successfulPayment.payment_group,
        vpa:
          (successfulPayment.payment_method &&
            successfulPayment.payment_method.upi &&
            successfulPayment.payment_method.upi.upi_id) ||
          null,
        rawResponse: successfulPayment,
      };
    } catch (err) {
      return { isValid: false, reason: err.message };
    }
  }

  /**
   * Verifies Cashfree inbound webhook signature.
   *
   * Algorithm:
   * 1. Validate timestamp freshness within tolerance window.
   * 2. HMAC-SHA256 over `${timestamp}${rawBody}` using credentials.webhookSecret.
   * 3. Digest in base64 format.
   * 4. Constant-time comparison with header signature.
   *
   * @param {Object} webhookData
   * @param {Buffer|string} webhookData.rawBody - Raw unparsed webhook request payload
   * @param {string} webhookData.signature - x-webhook-signature header
   * @param {string|number} webhookData.timestamp - x-webhook-timestamp header
   * @param {Object} credentials - Decrypted gateway credentials
   * @returns {boolean} True if signature is valid
   */
  verifyWebhookSignature(webhookData, credentials) {
    if (!webhookData || !webhookData.rawBody || !webhookData.signature || !webhookData.timestamp) {
      return false;
    }
    if (!credentials || !credentials.webhookSecret) {
      return false;
    }

    try {
      // 1. Check timestamp freshness
      const ts = Number(webhookData.timestamp);
      if (isNaN(ts)) return false;

      // Handle timestamp in seconds vs milliseconds
      const nowMs = Date.now();
      const webhookTimeMs = ts > 10000000000 ? ts : ts * 1000;
      const driftSeconds = Math.abs(nowMs - webhookTimeMs) / 1000;

      if (driftSeconds > this.maxWebhookTimestampDriftSec) {
        return false;
      }

      // 2. Prepare payload string for HMAC
      const rawBodyString = Buffer.isBuffer(webhookData.rawBody)
        ? webhookData.rawBody.toString('utf8')
        : String(webhookData.rawBody);

      const signaturePayload = `${webhookData.timestamp}${rawBodyString}`;

      const expectedSignature = crypto
        .createHmac('sha256', credentials.webhookSecret)
        .update(signaturePayload, 'utf8')
        .digest('base64');

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
   * Fetches order status directly from Cashfree.
   *
   * @param {string} orderId
   * @param {Object} credentials
   * @returns {Promise<Object>}
   */
  async fetchPaymentStatus(orderId, credentials) {
    if (!orderId) throw new Error('orderId is required');

    const baseUrl = this._getBaseUrl(credentials);
    const res = await this.httpClient(`${baseUrl}/orders/${encodeURIComponent(orderId)}`, {
      method: 'GET',
      headers: this._getHeaders(credentials),
    });

    const data = await res.json();
    if (!res.ok) {
      const errMsg = (data && data.message) || `Failed to fetch Cashfree order (${res.status})`;
      const err = new Error(errMsg);
      err.statusCode = res.status;
      throw err;
    }

    return {
      status: data.order_status, // 'PAID', 'ACTIVE', 'EXPIRED'
      amount: Number(data.order_amount),
      currency: data.order_currency,
      rawResponse: data,
    };
  }

  /**
   * Initiates a refund through Cashfree.
   *
   * @param {Object} refundData
   * @param {string} refundData.orderId - Cashfree order ID
   * @param {string} refundData.refundId - Unique refund ID (internal)
   * @param {number} refundData.amount - Amount in currency units (INR)
   * @param {string} [refundData.reason] - Refund note
   * @param {Object} credentials
   * @returns {Promise<Object>}
   */
  async initiateRefund(refundData, credentials) {
    if (!refundData.orderId) throw new Error('orderId is required for Cashfree refund');
    if (!refundData.refundId) throw new Error('refundId is required for Cashfree refund');

    const amount = Number(refundData.amount);
    if (isNaN(amount) || amount <= 0) {
      throw new Error('Valid positive amount is required for Cashfree refund');
    }

    const payload = {
      refund_id: String(refundData.refundId),
      refund_amount: Number(amount.toFixed(2)),
      refund_note: refundData.reason || 'Requested refund',
    };

    const headers = this._getHeaders(credentials);
    if (refundData.idempotencyKey) {
      headers['x-idempotency-key'] = String(refundData.idempotencyKey);
    }

    const baseUrl = this._getBaseUrl(credentials);
    const res = await this.httpClient(
      `${baseUrl}/orders/${encodeURIComponent(refundData.orderId)}/refunds`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      }
    );

    const data = await res.json();
    if (!res.ok) {
      // Return existing refund details if Cashfree reports existing refund under this refund_id
      if (data && data.cf_refund_id) {
        return {
          gatewayRefundId: String(data.cf_refund_id),
          refundId: data.refund_id,
          status: data.refund_status,
          amount: Number(data.refund_amount),
          rawResponse: data,
        };
      }
      const errMsg = (data && data.message) || `Cashfree refund failed (${res.status})`;
      const err = new Error(errMsg);
      err.statusCode = res.status;
      err.gatewayError = data;
      throw err;
    }

    return {
      gatewayRefundId: String(data.cf_refund_id),
      refundId: data.refund_id,
      status: data.refund_status, // 'SUCCESS', 'PENDING'
      amount: Number(data.refund_amount),
      rawResponse: data,
    };
  }

  /**
   * Fetches refund status from Cashfree.
   *
   * @param {string} orderId
   * @param {string} refundId
   * @param {Object} credentials
   * @returns {Promise<Object>}
   */
  async fetchRefundStatus(orderId, refundId, credentials) {
    if (!orderId || !refundId) throw new Error('orderId and refundId are required');

    const baseUrl = this._getBaseUrl(credentials);
    const res = await this.httpClient(
      `${baseUrl}/orders/${encodeURIComponent(orderId)}/refunds/${encodeURIComponent(refundId)}`,
      {
        method: 'GET',
        headers: this._getHeaders(credentials),
      }
    );

    const data = await res.json();
    if (!res.ok) {
      const errMsg = (data && data.message) || `Failed to fetch Cashfree refund (${res.status})`;
      const err = new Error(errMsg);
      err.statusCode = res.status;
      throw err;
    }

    return {
      gatewayRefundId: String(data.cf_refund_id),
      status: data.refund_status, // 'SUCCESS', 'PENDING', 'FAILED'
      amount: Number(data.refund_amount),
      rawResponse: data,
    };
  }

  /**
   * Tests credentials connectivity against Cashfree API.
   *
   * @param {Object} credentials
   * @returns {Promise<{ success: boolean, message: string }>}
   */
  async testConnection(credentials) {
    try {
      const baseUrl = this._getBaseUrl(credentials);
      const res = await this.httpClient(`${baseUrl}/orders?limit=1`, {
        method: 'GET',
        headers: this._getHeaders(credentials),
      });

      if (res.ok) {
        return { success: true, message: 'Cashfree connection verified successfully.' };
      }

      if (res.status === 401 || res.status === 403) {
        return { success: false, message: 'Authentication failed: Invalid Cashfree App ID or Secret Key.' };
      }

      return { success: false, message: `Cashfree connection failed with HTTP status ${res.status}` };
    } catch (err) {
      return { success: false, message: `Cashfree connection check failed: ${err.message}` };
    }
  }
}

module.exports = CashfreeAdapter;
