import "./globals.css";

export const metadata = {
  title: "Jackpot Entry - Win Big!",
  description: "Welcome to Jackpot Entry. Access sweepstakes games, grab bonuses, and win big!",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        {/* PWA manifest link */}
        <link rel="manifest" href="/manifest.json" />
        
        {/* Google Fonts: Orbitron (headings) & Montserrat (body) */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&family=Orbitron:wght@500;700;900&display=swap" rel="stylesheet" />
        
        {/* FontAwesome Premium Icon Library */}
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
