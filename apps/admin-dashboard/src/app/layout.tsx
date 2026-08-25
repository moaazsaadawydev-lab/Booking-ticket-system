import './global.css';
import { AuthProvider } from '../lib/auth-context';
import { ThemeProvider } from '../components/theme/ThemeProvider';

export const metadata = {
  title: 'Aflamak Cinema OS | Operations & Admin Portal',
  description: 'Enterprise Cinema Management, Movie Catalog & Ticketing Dashboard',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-slate-50 dark:bg-[#090d16] text-slate-900 dark:text-slate-100 antialiased selection:bg-blue-600 selection:text-white">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          <AuthProvider>{children}</AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
