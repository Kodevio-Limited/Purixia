import type { Metadata, Viewport } from 'next';
import { Poppins, Raleway } from 'next/font/google';
import { Navbar } from '../components/layout/Navbar';
import { Footer } from '../components/layout/Footer';
import { Providers } from './providers';
import './globals.css';

// Poppins — primary UI font (headings + body).
const poppins = Poppins({
  subsets: ['latin'],
  weight: ['200', '300', '400', '500', '600', '700'],
  variable: '--font-poppins',
  display: 'swap',
});

// Raleway — secondary brand font (display text, taglines, stat callouts).
const raleway = Raleway({
  subsets: ['latin'],
  weight: ['200', '400', '700', '800', '900'],
  variable: '--font-raleway',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Purixia BD — Premium Gadget Store',
  description:
    'Purixia BD is the leading premium gadget, watch, headphone, and accessory store in Bangladesh. Discover the latest tech items with fast shipping.',
  keywords: 'ecommerce, gadgets, smart watches, headphones, tech, bangladesh, purixia',
  icons: { icon: '/favicon.ico', apple: '/icon.png' },
};

export const viewport: Viewport = {
  themeColor: '#07213F',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${poppins.variable} ${raleway.variable}`}>
      <body className="min-h-screen flex flex-col bg-white text-black antialiased font-poppins">
        <Providers>
          <Navbar />
          <main className="flex-1">{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
