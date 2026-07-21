# Jackpot Royals — iOS (TestFlight) Setup Guide

Goal: **native iPhone app**, **not publicly listed** on the App Store search. Users get a **link** → TestFlight → Install.

Android APK / Chrome are unchanged. Do not touch them.

Project coding for iOS is already done (`ios/` folder, push wiring, admin field for TestFlight URL). Follow this file **in order**.

---

## Exact values to copy (use these everywhere)

| Field | Exact value |
|---|---|
| App name | `Jackpot Royals` |
| Bundle ID | `com.jackpotroyals.app` |
| SKU | `jackpot-royals-ios` |
| Primary language | English (U.S.) |
| Platform | iOS |
| Website | `https://jackpotroyals.com` |
| Privacy Policy URL | `https://jackpotroyals.com/privacy` |
| Support email | `support@jackpotroyals.com` |
| Marketing URL (optional) | `https://jackpotroyals.com` |

---

## PART A — Apple Developer + App Store Connect (browser)

### A1. Open App Store Connect
1. Go to: https://appstoreconnect.apple.com  
2. Sign in with the same Apple ID used for the Developer Program.  
3. Accept any pending agreements if shown.

### A2. Register the Bundle ID (Identifiers)
1. Go to: https://developer.apple.com/account/resources/identifiers/list  
2. Click **+**  
3. Select **App IDs** → Continue  
4. Select **App** → Continue  
5. Fill:
   - **Description:** `Jackpot Royals`
   - **Bundle ID:** Explicit → `com.jackpotroyals.app`
6. Capabilities checklist — turn **ON**:
   - **Push Notifications**
   - (optional later) Associated Domains — skip for now
7. Click **Continue** → **Register**

### A3. Create the app in App Store Connect
1. App Store Connect → **Apps** → **+** → **New App**
2. Fill:
   - **Platforms:** iOS ✅
   - **Name:** `Jackpot Royals`
   - **Primary Language:** English (U.S.)
   - **Bundle ID:** select `com.jackpotroyals.app`
   - **SKU:** `jackpot-royals-ios`
   - **User Access:** Full Access
3. Click **Create**

### A4. Create APNs key (for lock-screen push)
1. Go to: https://developer.apple.com/account/resources/authkeys/list  
2. Click **+**  
3. **Key Name:** `Jackpot Royals APNs`  
4. Check **Apple Push Notifications service (APNs)**  
5. Continue → Register  
6. **Download** the `.p8` file **once** (save it safely — Apple will not show it again)  
7. Note these three values (write them down):
   - **Key ID** (e.g. `AB12CD34EF`)
   - **Team ID** (top-right of developer.apple.com/account — 10 characters)
   - **Bundle ID:** `com.jackpotroyals.app`

---

## PART B — Firebase (browser)

Your Android app already uses Firebase. Add **iOS** to the **same** project.

### B1. Add iOS app in Firebase
1. Go to: https://console.firebase.google.com  
2. Open the same project used for Android  
3. Project settings (gear) → **Your apps** → **Add app** → **iOS**  
4. Fill:
   - **Apple bundle ID:** `com.jackpotroyals.app`  ← must match exactly  
   - **App nickname:** `Jackpot Royals iOS`  
   - **App Store ID:** leave blank for now  
5. Register app  
6. Download **`GoogleService-Info.plist`**

### B2. Put the plist into the Xcode project
1. Copy the downloaded file to:
   ```
   /Users/apple/Desktop/Jackpot/ios/App/App/GoogleService-Info.plist
   ```
2. You will also drag it into Xcode in Part C (so it is in the app target).

### B3. Upload APNs key to Firebase
1. Firebase → Project settings → **Cloud Messaging** tab  
2. Under **Apple app configuration** → **APNs Authentication Key** → Upload  
3. Upload the `.p8` file  
4. Enter:
   - **Key ID:** (from A4)
   - **Team ID:** (from A4)
5. Save

Without this step, iPhone lock-screen push will fail.

---

## PART C — Xcode (on your MacBook)

### C1. Open the project
In Terminal:

```bash
cd /Users/apple/Desktop/Jackpot
npm run ios:sync
npm run ios:open
```

Xcode opens `ios/App/App.xcodeproj` (or the App workspace).

### C2. Signing (Team)
1. Left sidebar → click blue **App** project  
2. Target **App** selected  
3. Tab **Signing & Capabilities**  
4. Check **Automatically manage signing**  
5. **Team:** select your paid Apple Developer team  
6. **Bundle Identifier:** must stay `com.jackpotroyals.app`  
7. If Xcode shows errors, click **Try Again** / allow keychain access

### C3. Add Push Notifications capability
1. Still on **Signing & Capabilities**  
2. Click **+ Capability**  
3. Add **Push Notifications**  
4. Click **+ Capability** again → add **Background Modes**  
5. Under Background Modes, check **Remote notifications**

(Info.plist already has `remote-notification` — Xcode capability still required.)

### C4. Add GoogleService-Info.plist in Xcode
1. In Finder, locate `ios/App/App/GoogleService-Info.plist`  
2. Drag it into Xcode under the **App** group (yellow folder)  
3. Dialog:
   - ✅ Copy items if needed  
   - ✅ Add to targets: **App**  
4. Finish

### C5. Set version numbers
1. Target **App** → **General**  
2. **Display Name:** `Jackpot Royals`  
3. **Version:** `1.0` (MARKETING_VERSION)  
4. **Build:** `1` (CURRENT_PROJECT_VERSION)  
   - Every new TestFlight upload needs a **higher Build** number (2, 3, 4…)

### C6. App icon (recommended)
1. Prepare a **1024×1024** PNG (no transparency for App Store)  
2. Xcode → `Assets.xcassets` → `AppIcon` → drop the 1024 image into the App Store slot  
3. Or use online tool to fill all sizes from one 1024 image

### C7. Run on your iPhone (optional test before TestFlight)
1. Connect iPhone with cable  
2. Trust computer on phone  
3. Xcode top bar → select your iPhone  
4. Press **Play ▶**  
5. On phone: Settings → General → VPN & Device Management → Trust your developer certificate if asked  
6. Open app → login → allow notifications when prompted

---

## PART D — Upload to TestFlight (not public App Store)

### D1. Archive
1. Xcode top bar device selector → choose **Any iOS Device (arm64)** (not a simulator)  
2. Menu: **Product** → **Archive**  
3. Wait until Organizer opens

### D2. Distribute
1. Organizer → select the archive → **Distribute App**  
2. Choose **App Store Connect** → Next  
3. **Upload** → Next  
4. Options: leave defaults (include bitcode off if shown) → Next  
5. Automatically manage signing → Upload  
6. Wait for success

### D3. App Store Connect → TestFlight setup
1. https://appstoreconnect.apple.com → your app → **TestFlight**  
2. Wait until the build shows **Processing** → then **Ready to Test** (can take 5–30 min)  
3. Fill **Export Compliance** if asked:
   - “Does your app use encryption?” → for a normal HTTPS website app, usually:
     - **Yes** (HTTPS uses encryption)
     - Then: “Is it exempt?” → **Yes** (standard HTTPS only) — pick the option that matches Apple’s current form for HTTPS-only apps  
4. **Missing Compliance** must be cleared before testers can install

### D4. External testing + Public Link (what you want)
1. TestFlight tab → **External Testing** → **+** create a group  
   - Group name: `Jackpot Public Testers`  
2. Add the build to that group  
3. First external build may need a short **Beta App Review** (Apple, usually 24–48h)  
4. After approved: enable **Public Link**  
5. Copy link — looks like:
   ```
   https://testflight.apple.com/join/XXXXXXXX
   ```

### D5. Put the link into your admin panel
1. Super Admin → Frontend Settings → **Mobile App Download**  
2. **iOS Install URL (TestFlight public link):** paste the link  
3. Save  
4. Ensure **Show Get App button** is ON  

Now: Lobby → Get App → iPhone → opens TestFlight install.

### D6. User install flow (what to tell players)
1. Open the link (or Get App → iPhone)  
2. Install **TestFlight** from App Store if asked  
3. Tap **Accept** / **Install** for Jackpot Royals  
4. Open Jackpot Royals from Home Screen  
5. Login → Allow notifications → lock-screen promos work  

App Store search me **public listing nahi** dikhegi — sirf link se.

---

## PART E — Every time you update the iOS app later

```bash
cd /Users/apple/Desktop/Jackpot
npm run ios:sync
npm run ios:open
```

1. Xcode → bump **Build** number (+1)  
2. Product → Archive → Upload  
3. TestFlight → add new build to the same group  
4. Public link same rehta hai (users update via TestFlight)

Note: TestFlight builds expire after ~**90 days** — upload a new build before that.

---

## What coding already did (you don’t need to redo)

- `ios/` Capacitor native project (Bundle ID `com.jackpotroyals.app`)  
- Live site load: `https://jackpotroyals.com/` (same OTA style as Android)  
- Push token forwarding in `AppDelegate.swift`  
- Background remote-notification in `Info.plist`  
- Admin setting `iosAppUrl` + Get App modal opens TestFlight when set  
- Scripts: `npm run ios:sync` / `npm run ios:open`  

---

## Checklist (tick as you go)

- [ ] A2 Bundle ID `com.jackpotroyals.app` + Push ON  
- [ ] A3 App created in App Store Connect  
- [ ] A4 APNs `.p8` downloaded + Key ID + Team ID saved  
- [ ] B1 Firebase iOS app added  
- [ ] B2 `GoogleService-Info.plist` in `ios/App/App/`  
- [ ] B3 APNs key uploaded to Firebase  
- [ ] C2 Xcode Team signing OK  
- [ ] C3 Push Notifications + Background Modes  
- [ ] C4 plist added to App target  
- [ ] D1–D2 Archive uploaded  
- [ ] D4 Public TestFlight link created  
- [ ] D5 Link pasted in admin `iosAppUrl`  

---

## If something fails

| Problem | Fix |
|---|---|
| Signing error in Xcode | Team select, Automatically manage signing, Bundle ID exact match |
| No push on iPhone | Firebase APNs key + GoogleService-Info.plist + Allow notifications in app |
| Build stuck Processing | Wait; check email from Apple for issues |
| External testing blocked | Complete Export Compliance + Beta App Review |
| Get App still shows Home Screen steps | `iosAppUrl` empty — paste TestFlight link in admin |

When all checklist items are done, your iOS app is ready the way you want: **link → install → native app + lock-screen notifications**, without a public App Store listing.
