import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Daily Usage Tracker",
  description: "Track your daily expenses with AI-powered insights",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var activeUser = localStorage.getItem('wallet_app_active_user') || 'default';
                var settingsStr = localStorage.getItem('wallet_app_' + activeUser + '_settings');
                var theme = 'dark';
                if (settingsStr) {
                  var settings = JSON.parse(settingsStr);
                  if (settings.theme) theme = settings.theme;
                }
                if (theme === 'dark') document.documentElement.classList.add('dark');
                if (theme === 'blossom') document.documentElement.classList.add('theme-blossom');
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
