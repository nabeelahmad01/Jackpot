# Jackpot Royals — Google Play (Player App) Upload Guide

Package: `com.jackpotroyals.app`  
App name: **Jackpot Royals**  
Upload file: `public/downloads/jackpot-royals.aab` (Android App Bundle)  
Version in this build: **1.2** (`versionCode` 3)

> Portal APK (`com.jackpotroyals.portal`) is separate — do **not** upload that to this Play listing.

---

## Will “Install anyway” go away?

**Yes — for testers who install from Play Store.**

| Install method | Warning |
|---|---|
| APK from website / WhatsApp / Files | “Install unknown apps” / **Install anyway** / Play Protect |
| Play Console **Internal / Closed / Open testing** or Production | Normal Play install — **no Install anyway** |

Testers open your Play testing link → Install from Play → done.

---

## Before you start (checklist)

1. Google Play Console account **verified** (you said this is done).
2. File ready: `jackpot-royals.aab`
3. Keep `android/app/jackpot-release.keystore` + `android/keystore.properties` safe forever (updates must use the same upload key).
4. Privacy policy live: https://jackpotroyals.com/privacy
5. Support email: `support@jackpotroyals.com`
6. Phone screenshots (at least 2): take from a real device or emulator (phone, portrait).
7. App icon: Play pulls from the AAB; also prepare a **512×512** PNG if asked separately.
8. Feature graphic: **1024×500** PNG/JPG (required for store listing).

---

## Step-by-step: create the app + first upload

### 1) Create the app
1. Open https://play.google.com/console
2. **Create app**
3. Fill:
   - **App name:** `Jackpot Royals`
   - **Default language:** English (United States) — or English (UK)
   - **App or game:** App *(or Game if you prefer Game category)*
   - **Free or paid:** Free
4. Accept declarations → **Create app**

### 2) Dashboard → set up your app
Complete the tasks Play shows. Use the copy/paste text below.

### 3) Upload the AAB (Internal testing — recommended first)
1. Left menu → **Test and release** → **Testing** → **Internal testing**
2. **Create new release**
3. If asked about **Play App Signing** → **Continue** / enroll (recommended). Keep your keystore backup.
4. Upload: `jackpot-royals.aab`
5. **Release name:** `1.2 (3)`
6. **Release notes** (en-US):

```
First Play testing build of Jackpot Royals.
Play games, manage your wallet, and get promotions in the official player app.
```

7. **Next** → **Save** → **Review release** → **Start rollout to Internal testing**

### 4) Add testers
1. Internal testing → **Testers** tab
2. Create email list (e.g. `Staff testers`) → add Gmail addresses
3. Copy the **join link** and send to testers
4. Each tester: open link → **Accept invite** → **Download on Google Play** → Install

---

## Store listing — copy/paste text

### App name
```
Jackpot Royals
```

### Short description (max 80 characters)
```
Play Jackpot Royals — games, wallet, bonuses & rewards in one app.
```

### Full description
```
Jackpot Royals is the official player app for Jackpot Royals.

Sign in to your account, browse games, manage deposits and withdrawals, track your balance, and receive promotions and updates — all in a fast, secure mobile experience.

Features:
• Secure login to your Jackpot Royals account
• Access your favorite games from your phone
• Wallet overview for deposits and withdrawals
• Promotions, freeplay offers, and account alerts
• Push notifications for important updates

This app is intended for adult users only. Please play responsibly.

Need help? Contact support@jackpotroyals.com
Website: https://jackpotroyals.com
```

### App category
- Primary: **Entertainment** (or **Casino** / **Game** if shown and accurate for your product)
- Tags: casino, games, rewards (only if available)

### Contact details
- **Email:** `support@jackpotroyals.com`
- **Website:** `https://jackpotroyals.com`
- **Phone:** (optional — your business phone if you have one)

### Privacy policy URL (required)
```
https://jackpotroyals.com/privacy
```

---

## Graphics you must upload

| Asset | Size | Notes |
|---|---|---|
| App icon | 512×512 | High-res icon (no transparency for Play high-res icon) |
| Feature graphic | 1024×500 | Banner at top of store listing |
| Phone screenshots | min 2 | Portrait; show lobby / login / games (no misleading claims) |

Optional: 7" / 10" tablet screenshots if you support tablets.

---

## App content / declarations (what to answer)

Exact UI changes over time — use these intents:

### Privacy policy
- URL: `https://jackpotroyals.com/privacy`

### Ads
- **No** — unless you show third-party ads in the app

### In-app purchases / Play Billing
- If money deposits happen **outside** Google Play (your own payment methods on the website/WebView): usually declare accordingly — often **not** using Play Billing for those
- Do **not** claim “no digital goods” if users buy credits/wallet funds in-app

### Target audience
- **18+** / adults only (not for children)
- Attractive to children: **No**

### News app
- **No**

### COVID-19
- **No** (unless relevant)

### Data safety (typical for this app)
Collects / shares roughly:
- **Account info:** name, email
- **Financial info:** purchase/transaction history (deposits/withdrawals) — as applicable
- **App activity:** in-app actions / support messages
- **Device / push IDs:** for notifications (Firebase)

Purposes: app functionality, account management, fraud prevention, communications.
Encryption in transit: **Yes** (HTTPS).
Users can request deletion: **Yes** (via support / account deletion flow if you offer it).

### Content rating (IARC questionnaire)
Answer honestly. For a casino / real-money / sweeps style product, expect **high maturity** / gambling-related rating.  
If you take real-money wagers, complete any **Gambling** declarations and country restrictions Play asks for.

> Important: Google Play has strict rules for **real-money gambling**. If your product involves real-money casino play, you may need licenses and geo limits. If Play rejects for gambling policy, that is a policy issue — not an AAB build issue.

### Government apps
- **No**

### Financial features
- If wallet/deposits: declare as asked (gambling / banking / etc. as applicable)

---

## Countries / testing track tips

- **Internal testing:** up to 100 testers, fastest, usually no full review delay (still may have checks).
- **Closed testing:** needed before production in many cases; add more testers.
- **Production:** public on Play Store after review.

For first go-live, start with **Internal testing**, then **Closed testing**, then **Production**.

---

## After upload — tester instructions (send this)

```
1) Open the Play Console invite link I sent you
2) Accept the invite with the same Google account
3) Tap Download / Install on Google Play
4) Open “Jackpot Royals” and log in with your player account

You should NOT see “Install anyway” — install comes from Play Store.
```

---

## Rebuild commands (later updates)

```bash
# Play Store file (.aab)
npm run android:aab
# Output: public/downloads/jackpot-royals.aab

# Sideload APK (website download) — still shows Install anyway
npm run android:release
```

Every new Play upload needs a **higher `versionCode`** in `android/app/build.gradle`.

---

## Files & package reminder

| Item | Value |
|---|---|
| Application ID | `com.jackpotroyals.app` |
| AAB path | `public/downloads/jackpot-royals.aab` |
| Version name | `1.2` |
| Version code | `3` |
| Keystore | `android/app/jackpot-release.keystore` |
| Privacy | https://jackpotroyals.com/privacy |
| Support | support@jackpotroyals.com |

**Never lose the keystore.** Without it you cannot update the same Play listing.
