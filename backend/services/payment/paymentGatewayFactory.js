'use strict';

const RazorpayAdapter = require('./adapters/razorpayAdapter');
const CashfreeAdapter = require('./adapters/cashfreeAdapter');

/**
 * Payment Gateway Factory
 *
 * Resolves the appropriate provider adapter instance.
 * Supports dependency injection for testing.
 */
class PaymentGatewayFactory {
  constructor(options = {}) {
    this.razorpayAdapter = options.razorpayAdapter || new RazorpayAdapter();
    this.cashfreeAdapter = options.cashfreeAdapter || new CashfreeAdapter();
  }

  /**
   * Retrieves the adapter corresponding to the specified provider.
   *
   * @param {string} provider - 'RAZORPAY' or 'CASHFREE'
   * @returns {Object} Adapter instance
   */
  getAdapter(provider) {
    if (!provider || typeof provider !== 'string') {
      throw new Error('A valid payment gateway provider is required');
    }

    const normalized = provider.toUpperCase().trim();
    switch (normalized) {
      case 'RAZORPAY':
        return this.razorpayAdapter;
      case 'CASHFREE':
        return this.cashfreeAdapter;
      default:
        throw new Error(`Unsupported payment gateway provider: ${provider}`);
    }
  }
}

// Default singleton instance
const defaultFactory = new PaymentGatewayFactory();

module.exports = {
  PaymentGatewayFactory,
  getAdapter: (provider) => defaultFactory.getAdapter(provider),
  defaultFactory,
};
