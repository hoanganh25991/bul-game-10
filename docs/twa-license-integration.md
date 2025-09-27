TWA license & paid-app integration (app-priced, no in-app SKUs)
================================================================

Purpose
-------
This document explains how to detect and verify that a user bought your app when you distribute it as a paid Trusted Web Activity (TWA). For app-priced apps there is no in‑app SKU — entitlement comes from Play itself. The authoritative sources are:

- The TWA wrapper (native host) — can check licensing/Play Integrity and send the result to the web app.
- A server you control — validates signed tokens from Play (recommended for production).

High level options
------------------

1) Quick / pragmatic (wrapper asserts entitlement)
   - The TWA host (your Android wrapper) checks the Play account / package and posts a message into the web page indicating entitlement.
   - Pros: simple to implement and test.
   - Cons: less secure than server verification (relies on wrapper binary integrity).

2) Recommended (server-verified signed token)
   - The wrapper obtains a signed token from Play (Play Integrity or LVL) and sends it to your server; the server verifies the token with Google and returns the verified result to the web app.
   - Pros: secure, resistant to tampering and replay when you implement nonce/timestamp checks.
   - Cons: requires a small backend and Play API/service account setup.

What we added to the web app
----------------------------
- src/main.js: supports both modes. If PRODUCT_IDS is empty (app-priced) it:
  - Listens for window.postMessage with type: 'TWA_LICENSE_STATUS' and payload { entitled: boolean, licenseToken?: string }.
  - Exposes window.requestLicenseStatus() to ask the wrapper to re-check license.
  - Exposes window.restorePurchases() which calls requestLicenseStatus in app-priced mode.
- src/payments.js: added verifyLicenseOnServer({ licenseData }) helper so the page can forward a token to your backend.

How the integration works (flow)
-------------------------------
1. Native wrapper detects license status or obtains a Play-signed token.
2. Wrapper posts a message into the page (TWA) with:
   { type: 'TWA_LICENSE_STATUS', entitled: true|false, licenseToken?: '<token>' }
3. Web page (src/main.js) receives message and:
   - Sets window.__appPurchased and localStorage['app.purchased'] accordingly
   - Optionally sends licenseToken to the backend via payments.verifyLicenseOnServer for stronger verification
4. Backend validates the token with Google Play (Play Integrity API or LVL signature verification) and returns a JSON { ok: true, entitled: true }.
5. Web app honors the verified result and unlocks features.

Wrapper (Android) notes & examples
----------------------------------

Important: the wrapper must run in a signed APK you control and use Play APIs or Google Play SDKs. Below are conceptual snippets — adapt to your wrapper tooling (Bubblewrap / Android Browser Helper / custom TWA host).

A) Simplest: wrapper asserts entitlement (pseudo Kotlin)
- When your TWA starts, have the wrapper post a message to the page:

```kotlin
// PSEUDO-KOTLIN (conceptual)
val payload = JSONObject()
payload.put("type", "TWA_LICENSE_STATUS")
payload.put("entitled", true) // or false
// optional: include a token for server verification
payload.put("licenseToken", null)

// Post the message to the page (the exact API depends on how you created the CustomTabs/TrustedWebActivity session)
session?.postMessage(payload.toString(), Bundle())
```

B) Recommended: use Play Integrity SDK to obtain a token (Kotlin example)
- Add dependency (Gradle): implementation "com.google.android.play:core-integrity:2.0.0" (check latest)
- Pseudo code:

```kotlin
import com.google.android.play.core.integrity.IntegrityManagerFactory
import com.google.android.play.core.integrity.model.IntegrityTokenRequest

val integrityManager = IntegrityManagerFactory.create(context)
val nonce = /* generate short nonce (server-provided or wrapper-gen) */
val request = IntegrityTokenRequest.builder().setNonce(nonce).build()

integrityManager.requestIntegrityToken(request)
  .addOnSuccessListener { response ->
    val token = response.token() // opaque JWT-like token
    val payload = JSONObject()
      .put("type", "TWA_LICENSE_STATUS")
      .put("entitled", true) // wrapper can also inspect token before posting
      .put("licenseToken", token)
    // send to web page via Custom Tabs session postMessage / Android Browser helper APIs
    session?.postMessage(payload.toString(), Bundle())
  }
  .addOnFailureListener { e ->
    // handle failure
  }
```

Notes:
- Play Integrity SDK returns a token you can verify on server using Play Integrity API.
- The wrapper may obtain a nonce from your server first to prevent replay attacks. The server can then verify the token against that nonce.

Server verification examples
----------------------------

A) LVL (legacy license library) verification (server-side Node.js)
- If you got a Base64-encoded RSA public key from Play Console (old LVL flow), you can verify the signedData / signature pair server-side.

Example server endpoint (Node.js / Express):

```js
// server/verify-lvl.js (example)
const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto');

const app = express();
app.use(bodyParser.json());

// Set this in your environment (do NOT commit it)
const PLAY_PUBLIC_KEY_BASE64 = process.env.PLAY_PUBLIC_KEY_BASE64 || '<YOUR_BASE64_RSA_KEY>';

function makePem(pubBase64) {
  // wrap to PEM format
  return '-----BEGIN PUBLIC KEY-----\n' + pubBase64.match(/.{1,64}/g).join('\n') + '\n-----END PUBLIC KEY-----\n';
}

app.post('/api/verify-lvl', async (req, res) => {
  const { signedData, signature } = req.body;
  if (!signedData || !signature) {
    return res.status(400).json({ ok: false, error: 'signedData and signature required' });
  }
  try {
    const pubPem = makePem(PLAY_PUBLIC_KEY_BASE64);
    // LVL uses SHA1withRSA historically; verify with RSA-SHA1
    const verifier = crypto.createVerify('RSA-SHA1');
    verifier.update(signedData, 'utf8');
    const valid = verifier.verify(pubPem, signature, 'base64');
    if (!valid) return res.json({ ok: false, entitled: false });

    // parse signedData (it's JSON)
    const data = JSON.parse(signedData);
    // sample: check packageName & timestamp & purchase state if present
    // Use play docs to inspect fields and make your own checks (timestamp freshness, userId, etc)
    const fresh = (Date.now() - (parseInt(data.timestampMillis || 0, 10))) < (1000 * 60 * 60 * 24); // 24h freshness
    if (!fresh) return res.json({ ok: false, entitled: false, reason: 'stale' });

    // If checks pass:
    return res.json({ ok: true, entitled: true, data });
  } catch (e) {
    console.error('lvl verify err', e);
    return res.status(500).json({ ok: false, error: String(e) });
  }
});

app.listen(3000, () => console.log('LVL verify server listening on 3000'));
```

B) Play Integrity verification (recommended)
- The Play Integrity API is the modern approach. Typical flow:
  1. Wrapper requests an integrity token (Play Integrity SDK).
  2. Wrapper forwards the token to your server.
  3. Server calls the Play Integrity API to decode/validate the token and inspects attestation for app & account info.

- Server-side you will use a Google service account (OAuth2) to call the Play Integrity REST API. See Play Integrity docs:
  https://developer.android.com/google/play/integrity

Notes about implementing Play Integrity:
- You must configure a Google Cloud project and enable the Play Integrity API.
- Use a service account with correct permissions; do not store the service account key in the client.
- The server verifies token signature, checks nonce, timestamp, and packageName.

Testing & debugging
-------------------
- During development you can accept wrapper assertions (step 1) as a way to iterate quickly.
- For Play Integrity / LVL, test tokens signed by Play will be valid only when issued in real environment (test tracks / internal testing). Use license tester accounts in Play Console.
- Use window.requestLicenseStatus() from the browser console to ask the wrapper to re-check while debugging.
- Check console logs on the web page for incoming TWA_LICENSE_STATUS messages.

What to change in your web app (you probably already did this)
--------------------------------------------------------------
- PRODUCT_IDS = [] in src/main.js (app-priced mode)
- Listening for the wrapper-posted message (src/main.js already added)
- payments.verifyLicenseOnServer helper to forward tokens to your server (we added this)
- Optional: add a "Restore purchases" button (we added in index.html) that calls window.restorePurchases().

Security recommendations
------------------------
- Always verify tokens server-side when possible (Play Integrity is preferred).
- Use nonces (server-generated) to guard against replay attacks.
- Do not persist "entitled" flags as the single source of truth — persist entitlement in your backend associated with the user or device ID.
- If you must use the quick wrapper-assert method, treat it as a convenience for UI only and plan to migrate to server verification for production.

Next steps I can take for you
-----------------------------
Pick one and I'll implement it in the repo:
- [ ] Add a server example file (Node.js) that verifies LVL signatures (using your Base64 RSA public key) and returns {ok,entitled}.
- [ ] Add a server example for Play Integrity verification (Node.js + google-auth) — more involved, but I can scaffold it.
- [ ] Add a README in the repo root that documents the wrapper→web postMessage contract (I can create docs/twa-license-integration.md — done).
- [x] I created this docs file in docs/twa-license-integration.md with guidance and examples.

If you want me to add a runnable server example in this repository, tell me which verification method you prefer (LVL signature verification using the Base64 RSA public key you already have, or Play Integrity token verification). I will add the corresponding server example file and basic README, and wire verify endpoints to match payments.verifyLicenseOnServer().
