// payments.js
// Digital Goods + Payment Request helper for TWA (Google Play Billing)
//
// Usage:
//  import * as payments from './payments.js';
//  await payments.initDigitalGoods(); // optional: harmless if unsupported
//  const owned = await payments.checkOwned(['com.example.app.productId']);
//  if (owned.length) { /* unlock feature */ }
//  await payments.purchaseItem('com.example.app.productId'); // opens PaymentRequest (Play Billing)
//
// NOTE: Replace backend verification URL below with your server endpoint that calls
// the Google Play Developer API to verify/acknowledge purchase tokens.
// Server should call:
//  GET https://androidpublisher.googleapis.com/androidpublisher/v3/applications/{packageName}/purchases/products/{productId}/tokens/{token}
// and optionally purchases.products.acknowledge to acknowledge unacked purchases.

const DEFAULT_SERVICE_URL = 'https://play.google.com/billing';

let _service = null;

/**
 * Feature-detect and obtain a DigitalGoodsService instance.
 * Returns the service or null if unsupported/unavailable.
 */
export async function initDigitalGoods(serviceProvider = DEFAULT_SERVICE_URL) {
  if (typeof window === 'undefined') return null;
  if (!('getDigitalGoodsService' in window)) {
    // Not supported in this UA/context (e.g., desktop browsers)
    return null;
  }
  try {
    _service = await window.getDigitalGoodsService(serviceProvider);
    return _service;
  } catch (err) {
    // serviceProvider not available in this context
    _service = null;
    return null;
  }
}

/**
 * Return the initialized service, or try to init if not already done.
 */
export async function getService() {
  if (_service) return _service;
  return await initDigitalGoods();
}

/**
 * List current owned purchases via the Digital Goods API.
 * Returns an array of PurchaseDetails { itemId, purchaseToken } or [].
 */
export async function listPurchases() {
  const svc = await getService();
  if (!svc || typeof svc.listPurchases !== 'function') return [];
  try {
    const purchases = await svc.listPurchases();
    return Array.isArray(purchases) ? purchases : [];
  } catch (e) {
    console.warn('[payments] listPurchases failed', e);
    return [];
  }
}

/**
 * Convenience: check whether any of the given productIds are owned.
 * productIds: array of string product ids (SKUs)
 * Returns array of PurchaseDetails matching owned items (possibly empty)
 */
export async function checkOwned(productIds = []) {
  if (!Array.isArray(productIds) || productIds.length === 0) return [];
  const purchases = await listPurchases();
  if (!purchases || purchases.length === 0) return [];
  // map for quick lookup
  const set = new Set(productIds);
  return purchases.filter((p) => p && set.has(p.itemId));
}

/**
 * Trigger a purchase flow for the given itemId via Payment Request API (delegated to Play Billing).
 * After purchase completes, call listPurchases() to retrieve tokens and return newly owned items.
 *
 * This function:
 *  - builds a PaymentRequest with the Play Billing method id
 *  - shows it and waits for user interaction
 *  - calls complete('success') on the PaymentResponse when finished
 *  - refreshes purchases (via Digital Goods API) and returns listPurchases()
 *
 * Note: the exact PaymentResponse.details shape is provider-specific and not relied upon here.
 */
export async function purchaseItem(itemId) {
  if (typeof itemId !== 'string' || !itemId) throw new Error('itemId is required');

  // Preferred: getDigitalGoodsService first; if not available, still attempt PaymentRequest
  const svc = await getService();

  // Create PaymentRequest using the Play Billing method identifier with data containing itemId
  // The user agent / Play Billing provider expects the itemId in method data (provider-specific).
  const methodData = [{
    supportedMethods: DEFAULT_SERVICE_URL,
    data: { itemId }
  }];

  // Minimal details: total amount is not used by provider but PaymentRequest requires details object
  const details = {
    total: { label: 'Total', amount: { currency: 'USD', value: '0.00' } }
  };

  let pr;
  try {
    pr = new PaymentRequest(methodData, details);
  } catch (e) {
    // If PaymentRequest construction fails, fallback to attempting provider's UI via DigitalGoods (if available)
    console.warn('[payments] PaymentRequest failed to construct', e);
    if (!svc) throw e;
  }

  if (pr) {
    try {
      const resp = await pr.show();
      // Best practice: wait for provider to finalize, then call complete
      try {
        await resp.complete('success');
      } catch (_) {
        // ignore completion errors
      }
      // After purchase, refresh purchases via Digital Goods API
      const purchases = await listPurchases();
      return purchases;
    } catch (err) {
      // Payment cancelled or failed
      console.warn('[payments] purchase canceled/failed', err);
      throw err;
    }
  } else {
    // If PaymentRequest not available but we have digital goods service, we can't directly open UI;
    // recommend server-side or display instructions to user.
    throw new Error('PaymentRequest not available and no service UI could be invoked.');
  }
}

/**
 * Send purchase token(s) to your backend for verification.
 * The backend must exchange these tokens with Google Play Developer API and verify:
 *  - purchaseState === 0 (purchased)
 *  - optionally acknowledgementState === 1 (acknowledged). If not acknowledged, call purchases.products.acknowledge.
 *
 * Example POST body:
 * {
 *   packageName: 'com.example.app',
 *   productId: 'com.example.app.productId',
 *   purchaseToken: '...'
 * }
 *
 * Adjust the URL below to point to your server verification endpoint.
 */
export async function verifyOnServer({ packageName, productId, purchaseToken, endpoint = '/api/verify-purchase' } = {}) {
  if (!packageName || !productId || !purchaseToken) {
    throw new Error('packageName, productId and purchaseToken are required for server verification');
  }
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ packageName, productId, purchaseToken })
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`Server verification failed: ${res.status} ${txt}`);
    }
    const json = await res.json();
    return json;
  } catch (e) {
    console.warn('[payments] verifyOnServer error', e);
    throw e;
  }
}

/**
 * Helper to consume a purchase token (for consumable items). For Play Billing non-consumable (one-time upgrade)
 * you should not consume; instead acknowledge via server API if needed.
 */
export async function consumePurchase(purchaseToken) {
  const svc = await getService();
  if (!svc || typeof svc.consume !== 'function') throw new Error('Digital Goods consume() not available');
  return svc.consume(purchaseToken);
}

/**
 * Verify a Play Licensing (LVL) response or other license object on server.
 * The backend should implement '/api/verify-license' (or configured endpoint) that:
 *  - verifies the signed LVL response or Play Integrity token
 *  - returns { ok: true, entitled: true } on success
 *
 * This helper sends whatever object is provided as 'licenseData' to the server.
 */
export async function verifyLicenseOnServer({ licenseData, endpoint = '/api/verify-license' } = {}) {
  if (!licenseData) throw new Error('licenseData is required for license verification');
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ licenseData })
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`Server license verification failed: ${res.status} ${txt}`);
    }
    const json = await res.json();
    return json;
  } catch (e) {
    console.warn('[payments] verifyLicenseOnServer error', e);
    throw e;
  }
}

export default {
  initDigitalGoods,
  getService,
  listPurchases,
  checkOwned,
  purchaseItem,
  verifyOnServer,
  verifyLicenseOnServer,
  consumePurchase
};
