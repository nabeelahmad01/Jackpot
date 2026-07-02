# Jackpot Entry - Next.js (React) SPA + PWA & Capacitor (APK)

A modern, highly responsive, dark-themed casino and sweepstakes landing page, player lobby, and admin panel. This application is structured as a Next.js App Router (React) Single Page Application (SPA), complete with Progressive Web App (PWA) triggers and Capacitor.js integration to support compile-ready Android builds.

---

## ⚙️ Tech Stack & Key Features

* **Framework**: Next.js App Router (React.js) with client-side state synchronization.
* **Styling**: Vanilla CSS (modular variable system inside `src/app/globals.css`).
* **Database**: Local database simulating actual records (`localStorage`) with tables:
  - `jackpot_users`: Accounts table.
  - `jackpot_games`: Casino catalog table.
  - `jackpot_account_requests`: Lobby requests table.
  - `jackpot_game_accounts`: Approved logins table.
  - `jackpot_transactions`: Invoicing ledgers (contains Base64 screenshot proof attachments).
  - `jackpot_payment_gateways`: Dynamic configurations for custom gateways (contains Base64 payment QR images).
* **Installable PWA**: Contains a web manifest (`manifest.json`) and a Service Worker (`sw.js`) so mobile users can install the application directly from Chrome or Safari with a native app icon.
* **APK Ready**: Pre-configured with **Capacitor.js** to package the build and export it as an Android application via Android Studio.

---

## 🔑 Environment Configuration & SMTP Settings

To send real OTP emails and enable Google Sign-In, define the following variables inside your **`.env.local`** file:

```env
# Secure Admin Portal Credentials
NEXT_PUBLIC_ADMIN_EMAIL=admin@jackpot.com
NEXT_PUBLIC_ADMIN_PASSWORD=admin123

# SMTP Server Configurations (GMAIL / SMTP Relay)
SMTP_USER=sender@gmail.com
SMTP_PASS=gmail_app_password

# Google Sign-In OAuth Configuration
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_client_id_here
```

### 1. OTP Mail Flow
* The application sends a POST fetch request to `/api/send-otp`.
* If SMTP parameters are missing, the system runs in **Simulator Mode**, logging verification codes to the console and displaying an info alert box for local testing.
* If credentials are set, Gmail dispatches a templated verification email to the user.

### 2. Google OAuth Authentication Flow
* When the user clicks the "Continue with Google" button:
  - If they are inside Facebook/Messenger in-app browser, it shows a friendly browser limitations guide prompting them to open in Chrome or Safari.
  - If they are in a normal browser (Chrome, Safari, etc.) and a Google Client ID is configured, it launches the Google Sign-In popup, retrieves their profile (Name, Email), registers new players automatically, and logs them in.
  - If no Google Client ID is configured yet, it runs in **OAuth Simulator Mode**, showing a preview prompt and automatically logging them in with a test Google profile (`google-player@test.com`) for seamless test drives.

---

## 🔑 Secure Admin & Test Credentials

The administrator and player accounts are pre-configured:

### 1. Player View (Landing page & Lobby)
* **URL**: `http://localhost:3000/`
* **Test Email**: `player@test.com`
* **Test Password**: `password123`

### 2. Secure Admin View (Staff Dashboard)
* **URL**: `http://localhost:3000/admin`
* **Admin Email**: `admin@jackpot.com` (Defined inside `.env.local`)
* **Admin Password**: `admin123` (Defined inside `.env.local`)

---

## 🔄 Dynamic Flows & Workflows

### 🎮 1. Games Library Logo Uploads
* Instead of dropdown selections, the admin can upload a custom logo/cover graphic file directly when adding or editing games inside the **Library** tab.
* The image is converted into a Base64 string and stored in the database.

### 💳 2. Payment Gateway QR Code Uploads
* Inside the **Payment Gateways** manager tab, the admin can upload a custom payment QR code graphic file directly.
* The image is encoded into a Base64 string, rendering dynamically inside the player checkout invoice box.

### 🔔 3. Toast Notifications & Scrollable Modals
* **Top-Right Alerts**: Banners float in the top-right corner to prevent overlapping with navigation buttons.
* **Scrollable Modals**: Overriding body elements ensure that forms scroll smoothly on smaller viewports.

---

## ⚙️ Running Locally

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the dev server:
   ```bash
   npm run dev
   ```
3. Open `http://localhost:3000` (Player view) or `http://localhost:3000/admin` (Admin portal).
