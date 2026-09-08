/**
 * Cloudflare Pages Function: POST /api/charge
 *
 * Receives a Google Pay token from the checkout page, Base64 encodes it, and
 * submits it to Authorize.net. This is the piece that cannot live in the
 * browser, because it holds the API Login ID and Transaction Key.
 *
 * Set these as environment variables in the Cloudflare Pages dashboard under
 * Settings > Environment variables. Never commit them.
 *
 *   ANET_LOGIN_ID          your API Login ID
 *   ANET_TRANSACTION_KEY   your Transaction Key
 *   ANET_ENV               "sandbox" (default) or "production"
 */

const ENDPOINTS = {
  sandbox: "https://apitest.authorize.net/xml/v1/request.api",
  production: "https://api.authorize.net/xml/v1/request.api",
};

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export async function onRequestPost({ request, env }) {
  if (!env.ANET_LOGIN_ID || !env.ANET_TRANSACTION_KEY) {
    return json({ approved: false, message: "Gateway credentials are not configured." }, 500);
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ approved: false, message: "Malformed request." }, 400);
  }

  const { token, amount } = payload;

  if (typeof token !== "string" || !token) {
    return json({ approved: false, message: "Missing payment token." }, 400);
  }

  // Validate the amount server side. Never trust a price sent by the browser
  // in real code; recompute it from the cart. Kept simple here, but bounded.
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0 || value > 1000) {
    return json({ approved: false, message: "Invalid amount." }, 400);
  }

  // Base64 the token exactly as received. Do not parse and re-serialise it:
  // Authorize.net verifies Google's signature over these precise bytes, and
  // any reformatting silently breaks decryption.
  const dataValue = btoa(token);

  const body = {
    createTransactionRequest: {
      merchantAuthentication: {
        name: env.ANET_LOGIN_ID,
        transactionKey: env.ANET_TRANSACTION_KEY,
      },
      transactionRequest: {
        transactionType: "authCaptureTransaction",
        amount: value.toFixed(2),
        payment: {
          opaqueData: {
            dataDescriptor: "COMMON.GOOGLE.INAPP.PAYMENT",
            dataValue,
          },
        },
        retail: { marketType: "0" },
      },
    },
  };

  const endpoint = ENDPOINTS[env.ANET_ENV === "production" ? "production" : "sandbox"];

  let raw;
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    raw = await res.text();
  } catch (e) {
    return json({ approved: false, message: "Could not reach the gateway." }, 502);
  }

  // Authorize.net prefixes its JSON with a UTF-8 byte order mark, which makes
  // JSON.parse fail on the first character with a misleading error.
  let parsed;
  try {
    parsed = JSON.parse(raw.replace(/^﻿/, ""));
  } catch {
    return json({ approved: false, message: "Gateway returned an unreadable response." }, 502);
  }

  const tr = parsed.transactionResponse || {};
  const apiMessage = (parsed.messages && parsed.messages.message && parsed.messages.message[0]) || {};
  const approved = String(tr.responseCode) === "1";

  // Surface the gateway's own wording rather than inventing our own, so the
  // failure reason is diagnosable. Errors here include decryption failures.
  let message = "";
  if (!approved) {
    if (tr.errors && tr.errors.length) {
      message = `${tr.errors[0].errorCode}: ${tr.errors[0].errorText}`;
    } else if (apiMessage.text) {
      message = `${apiMessage.code || ""} ${apiMessage.text}`.trim();
    } else {
      message = "The payment was not approved.";
    }
  }

  if (String(tr.transId) === "0") {
    message += " Transaction ID is 0, which means the account is in Test Mode.";
  }

  return json({
    approved,
    transactionId: tr.transId || null,
    authCode: tr.authCode || null,
    responseCode: tr.responseCode || null,
    accountNumber: tr.accountNumber || null,
    message,
    resultCode: parsed.messages ? parsed.messages.resultCode : null,
  });
}
