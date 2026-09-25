import type { Metadata } from 'next';
import { Toaster } from 'sonner';
import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-500.css';
import '@fontsource/ibm-plex-sans/latin-600.css';
import '@fontsource/ibm-plex-sans-devanagari/devanagari-400.css';
import '@fontsource/ibm-plex-sans-devanagari/devanagari-600.css';
import '@fontsource/ibm-plex-mono/latin-400.css';
import '@fontsource/source-serif-4/latin-400.css';
import '@fontsource/source-serif-4/latin-600.css';
import '@fontsource/noto-serif-devanagari/devanagari-400.css';
import './globals.css';
import { Shell } from '@/components/shell/Shell';

export const metadata: Metadata = {
  title: 'Aalekh FRS',
  description: 'Requirements engineering for e-Governance projects, Directorate of IT, Rajyapradesh',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Shell>{children}</Shell>
        <Toaster position="bottom-right" toastOptions={{ style: { fontFamily: 'inherit', fontSize: 13 } }} />
      </body>
    </html>
  );
}
