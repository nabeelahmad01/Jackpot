import "./globals.css";
import ClientChunkGuard from "../components/ClientChunkGuard";
import NativeSplash from "../components/NativeSplash";
import NativeChrome from "../components/NativeChrome";

export const metadata = {
  title: "Jackpot Royals - Win Big!",
  description: "Welcome to Jackpot Royals. Access sweepstakes games, grab bonuses, and win big!",
  applicationName: "Jackpot Royals",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" }
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }]
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Jackpot Royals"
  },
  formatDetection: {
    telephone: false
  }
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#080a11"
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Google Fonts: Orbitron (headings) & Montserrat (body) */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&family=Orbitron:wght@500;700;900&display=swap" rel="stylesheet" />
        
        {/* FontAwesome Premium Icon Library */}
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
      </head>
      <body suppressHydrationWarning>
        <NativeChrome />
        <NativeSplash />
        <ClientChunkGuard />
        {children}
      </body>
    </html>
  );
}
