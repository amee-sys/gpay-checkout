// Public, non-secret configuration. Safe to commit and safe to serve.
// Secrets live only in Cloudflare environment variables, never here.

window.GATEWAY_MERCHANT_ID = 'PUT_YOUR_AUTHORIZE_NET_GATEWAY_ID_HERE';

// 'TEST' until Google approves your production access request.
window.GPAY_ENV = 'TEST';

// Only needed once GPAY_ENV is 'PRODUCTION'. From the Google Pay and Wallet Console.
window.GOOGLE_MERCHANT_ID = '';
