import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'CreditCEP AI — Tableau de bord',
  description:
    "Systeme intelligent d'analyse et d'octroi de credit agricole pour cooperatives (CEP / ProSMAT).",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
