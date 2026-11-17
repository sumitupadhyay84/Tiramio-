import './globals.css';

export const metadata = {
  title: 'Dear Misu Tiramisu | Layers of Love, in Every Bite',
  description: 'A little box of happiness. Explore Dear Misu Mini, Classic and Share Box tiramisu and order directly on WhatsApp.',
  applicationName: 'Dear Misu Tiramisu',
  icons: { icon: '/images/dear-misu-badge.webp', apple: '/images/dear-misu-badge.webp' },
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://example.com'),
  openGraph: {
    title: 'Dear Misu Tiramisu',
    description: 'Layers of Love, in Every Bite.',
    type: 'website'
  }
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=Playfair+Display:wght@500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
