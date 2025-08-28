import type { Metadata } from 'next';
import { ThemeProvider } from '@/contexts/theme-context';
import './globals.css';

export const metadata: Metadata = {
  title: 'Gemini File Processor',
  description:
    'Upload up to 10 text files and let Gemini AI process them in parallel with your custom instructions',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider defaultTheme="system" storageKey="next-ui-theme">
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
