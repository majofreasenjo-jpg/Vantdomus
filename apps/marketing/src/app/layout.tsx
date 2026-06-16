import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import { LanguageProvider } from '@/context/LanguageContext';
import SmoothScroll from '@/components/SmoothScroll';
import { Analytics } from '@vercel/analytics/react';
import { CommandMenu } from '@/components/CommandMenu';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

// 1. Metaetiquetas Nivel Dios (Open Graph y Twitter Cards)
export const metadata: Metadata = {
  title: 'Luxen | Driving Digital Innovation',
  description: 'Aceleramos la transformación digital de tu empresa con soluciones tecnológicas de alto rendimiento.',
  openGraph: {
    title: 'Luxen | Transformación Digital',
    description: 'Soluciones tecnológicas y desarrollo de software para escalar tu negocio.',
    url: 'https://luxen.cl',
    siteName: 'Luxen',
    images: [
      {
        url: 'https://luxen.cl/og-image.jpg', // El equipo debe crear esta imagen
        width: 1200,
        height: 630,
        alt: 'Luxen Digital Innovation',
      },
    ],
    locale: 'es_CL',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  
  // 2. Schema Markup (JSON-LD) para dominar Google
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ITUtility',
    name: 'Luxen',
    url: 'https://luxen.cl',
    logo: 'https://luxen.cl/logo.png',
    contactPoint: {
      '@type': 'ContactPoint',
      email: 'comercial@luxen.cl',
      contactType: 'Sales and Support',
      availableLanguage: ['Spanish', 'English']
    },
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Santiago',
      addressCountry: 'CL'
    }
  };

  return (
    <html lang="es" className="scroll-smooth">
      <body className={`${inter.className} bg-slate-950 text-slate-50 antialiased`}>
        <CommandMenu />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />

        <LanguageProvider>
          <Header />
          <SmoothScroll>
            <main>{children}</main>
            <Footer />
          </SmoothScroll>
        </LanguageProvider>
        <Analytics />
      </body>
    </html>
  );
}
