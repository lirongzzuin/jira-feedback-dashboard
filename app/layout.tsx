import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { APP_TITLE } from '@/lib/site';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const jetbrains = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains-mono' });

export const metadata: Metadata = {
  title: APP_TITLE,
  description: 'Slack으로 들어온 고객사 요청과 Jira 티켓을 한눈에 보는 모니터링 대시보드',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={`${inter.variable} ${jetbrains.variable}`}>
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-slate-50 text-slate-800 font-sans min-h-screen flex flex-col selection:bg-blue-100 selection:text-blue-900">
        {children}
      </body>
    </html>
  );
}
