# Jackpot Distributor APK

Separate Android app for **distributors + their staff** who login on `/distributor`.

- Player APK (`android/`, Jackpot Royals) — unchanged
- Portal APK (`android-portal/`, Jackpot Portal) — unchanged (super admin + HQ staff)
- This app: `android-distributor/`, package `com.jackpotroyals.distributor`, name **Jackpot Distributor**
- Opens: `https://jackpotroyals.com/distributor`
- Lock-screen alerts for **that distributor’s** players: deposits, withdrawals, remainder, account requests, support messages

## 1) Firebase — add third Android app (required for push)

You already have:

| App | Package |
|---|---|
| Player | `com.jackpotroyals.app` |
| Portal | `com.jackpotroyals.portal` |

Add Distributor:

1. https://console.firebase.google.com → project **jackpot-royals**
2. Project settings → Your apps → **Add app** → Android
3. Android package name: `com.jackpotroyals.distributor`
4. App nickname: `Jackpot Distributor`
5. Download **google-services.json**
6. Replace file:
   ```
   android-distributor/app/google-services.json
   ```
   (Must contain `"package_name": "com.jackpotroyals.distributor"`)

Without this step, the APK installs but lock-screen push will not register correctly.

## 2) Build the APK (Mac)

```bash
cd /Users/apple/Desktop/Jackpot
npm run distributor:release
```

Output:
```
public/downloads/jackpot-distributor.apk
```

Debug build:
```bash
npm run distributor:debug
```

## 3) Install on distributor phones

1. Send `jackpot-distributor.apk` privately (WhatsApp / Drive) — **do not** put on the public player Get App button
2. Install → open **Jackpot Distributor**
3. Login with the same distributor / distributor-staff email + password as `/distributor`
4. Allow notifications when prompted
5. New player requests under that distributor → lock-screen notification

## 4) Deploy website code

Distributor push hooks live in the Next.js API (`notifyStaffAndDistributorAsync`). Redeploy the site so live requests actually send FCM to Distributor devices.

## Notes

| | Player APK | Portal APK | Distributor APK |
|---|---|---|---|
| Package | `com.jackpotroyals.app` | `com.jackpotroyals.portal` | `com.jackpotroyals.distributor` |
| Name | Jackpot Royals | Jackpot Portal | Jackpot Distributor |
| URL | site home / lobby | `/admin` | `/distributor` |
| Push channel | `jackpot_promotions` | `jackpot_portal_alerts` | `jackpot_distributor_alerts` |
| Audience | player promos | HQ staff alerts | that distributor’s requests only |

All three apps can be installed on the same phone side by side.
