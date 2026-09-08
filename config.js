// Public, non-secret configuration. Safe to commit and safe to serve.
// Secrets live only in Cloudflare environment variables, never here.

window.GATEWAY_MERCHANT_ID = '960520';

// 'TEST' until Google approves your production access request.
window.GPAY_ENV = 'TEST';

// Only needed once GPAY_ENV is 'PRODUCTION'. From the Google Pay and Wallet Console.
window.GOOGLE_MERCHANT_ID = '';
