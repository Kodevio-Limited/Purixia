import type { Metadata } from 'next';
import { Inter, Poppins } from 'next/font/google';
import { Navbar } from '../components/layout/Navbar';
import { Footer } from '../components/layout/Footer';
import { Providers } from './providers';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-poppins',
});

export const metadata: Metadata = {
  title: 'Purixia - Premium Gadget E-commerce Store',
  description:
    'Purixia is the leading premium gadget, watch, headphone, and accessory store in Bangladesh. Discover the latest tech items with fast shipping.',
  keywords: 'ecommerce, gadgets, smart watches, headphones, tech, bangladesh, purixia',
  icons: { icon: '/favicon.ico' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${poppins.variable}`}>
      <body className="min-h-screen flex flex-col bg-gray-50/50 text-gray-900 antialiased font-poppins">
        <Providers>
          <Navbar />
          <main className="flex-1">{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
