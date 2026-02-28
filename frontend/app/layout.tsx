import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ZonaDev Auth",
  description: "Provedor de identidade centralizado — ZonaDev",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
