# Jackpot Portal APK (Admin + Staff)

Separate Android app for **super admin + staff** who login on the same `/admin` form.

- Player APK (`android/`, Jackpot Royals) is **unchanged**
- This app: `android-portal/`, package `com.jackpotroyals.portal`, name **Jackpot Portal**
- Opens: `https://jackpotroyals.com/admin`
- Lock-screen alerts for: deposits, withdrawals, freeplay, remainder, account requests, support messages, campaign requests

## 1) Firebase — add second Android app (required for push)

Player app already uses package `com.jackpotroyals.app`. Portal needs its own:

1. https://console.firebase.google.com → project **jackpot-royals**
2. Project settings → Your apps → **Add app** → Android
3. Android package name: `com.jackpotroyals.portal`
4. App nickname: `Jackpot Portal`
5. Download **google-services.json**
6. Replace file:
   ```
   android-portal/app/google-services.json
   ```
   (Must contain `package_name": "com.jackpotroyals.portal"`)

Without this step, Portal APK installs but lock-screen push will not register.

## 2) Build the APK (Mac)

```bash
cd /Users/apple/Desktop/Jackpot
npm run portal:release
```

Output:
```
public/downloads/jackpot-portal.apk
```

Debug build:
```bash
npm run portal:debug
```

## 3) Install on staff phones

1. Send `jackpot-portal.apk` privately (WhatsApp / Drive) — **do not** put it on the public Get App button for players
2. Staff: Install → open **Jackpot Portal**
3. Login with same admin/staff email + password as `/admin`
4. Allow notifications when prompted
5. New requests → lock-screen notification

## 4) Deploy website code

Staff push hooks live in the Next.js API. Redeploy the site (Hostinger) so live requests actually send FCM to Portal devices.

## Notes

| | Player APK | Portal APK |
|---|---|---|
| Package | `com.jackpotroyals.app` | `com.jackpotroyals.portal` |
| Name | Jackpot Royals | Jackpot Portal |
| URL | site home / lobby | `/admin` |
| Push channel | `jackpot_promotions` | `jackpot_portal_alerts` |
| Audience | player promos | staff request alerts |

Both apps can be installed on the same phone side by side.

See also: [DISTRIBUTOR_SETUP.md](./DISTRIBUTOR_SETUP.md) for the separate **Jackpot Distributor** APK (`/distributor` + lock-screen alerts per distributor).
