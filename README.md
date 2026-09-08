# Harbor Lane Coffee

A working demonstration storefront that mirrors how Kevin will build Emily's
checkout: a real product page, a real Google Pay button, and a real server side
call to Authorize.net with credentials that never reach the browser.

Deployed free on Cloudflare Pages. No credit card, no node, no brew.

```
index.html              storefront and checkout, all client side
config.js               public settings, safe to commit
functions/api/charge.js serverless backend that talks to Authorize.net
```

## Why this shape

Kevin's site will have a backend. A static host cannot hold the API Login ID
and Transaction Key, so anything without a server leaves out the half where
most real problems live. `functions/api/charge.js` is that half.

The flow, which is the same one any real store uses:

1. Browser asks Google for a payment token.
2. Browser posts the token to `/api/charge`. No credentials involved.
3. The function Base64 encodes the token, adds the credentials, and calls
   Authorize.net.
4. The function returns an approved or declined result to the page.

## Deploy it

**1. Put it on GitHub.**

```
cd ~/Claude/Projects/gpay-checkout
git init
git add .
git commit -m "Google Pay checkout demo"
```

Create an empty repo on github.com, then follow the two commands it shows you
for pushing an existing repository.

**2. Connect Cloudflare Pages.**

Sign up free at https://dash.cloudflare.com. Go to Workers and Pages, create a
Pages project, connect to Git, and pick the repo. Leave the build command empty
and the output directory as `/`. There is no build step.

You get a permanent URL like `https://your-project.pages.dev`, on HTTPS, which
is what Google requires.

**3. Add the credentials.**

In the Pages project, Settings, Environment variables, add:

| Name | Value |
|---|---|
| `ANET_LOGIN_ID` | your API Login ID |
| `ANET_TRANSACTION_KEY` | your Transaction Key |
| `ANET_ENV` | `sandbox` while testing |

Redeploy after adding them. These live only in Cloudflare and are never in the
repo or the page.

**4. Set your gateway ID.**

Edit `config.js`, put your Authorize.net payment gateway ID in
`GATEWAY_MERCHANT_ID`, commit and push. Cloudflare redeploys automatically.

That value is not a secret. It identifies your gateway to Google and is meant
to be visible in the page.

## Going from TEST to PRODUCTION

While `GPAY_ENV` is `TEST`, Google returns test tokens and Authorize.net will
not approve them. That is expected and is not a bug in your setup.

To go live you need Google's approval:

1. Deploy, with the button working in the checkout.
2. In the Google Pay and Wallet Console, Google Pay API, Request Production
   Access. Provide this site's URL plus screenshots or video of the checkout.
3. Once approved, set `GOOGLE_MERCHANT_ID` in `config.js`, change `GPAY_ENV`
   to `PRODUCTION`, and set `ANET_ENV` to `production`.

Step 2 cannot be done earlier. Google wants a reachable URL and evidence of a
working button, so the request comes after deployment, not in parallel with it.

## Apple Pay is not the same

Google Pay works on any HTTPS origin with no domain registration. Apple Pay
requires registering and verifying every merchant domain with Apple and hosting
a file Apple crawls. Do not assume the Google experience predicts the Apple one.

## Reading a failure

The Technical detail section on the page shows the raw gateway response.

- **responseCode 1** approved.
- **responseCode 2** declined by the issuer. Your integration is fine.
- **responseCode 3** error. Decryption failures land here.
- **transId 0** the account is in Test Mode. Turn it off at Settings, Test Mode.
- **Code 13** credentials do not match the endpoint you called.

## The rule that breaks integrations

The token is passed to the server and Base64 encoded without being touched.
Authorize.net verifies Google's signature over the exact bytes, so parsing the
token and re-serialising it, or unescaping its `=` sequences, produces
something that still looks like valid JSON but will not decrypt.
