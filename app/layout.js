import './globals.css';

export const metadata = {
  title: 'App Ônibus Recife',
  description: 'Transporte público em tempo real',
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body className="w-full h-full m-0 p-0 overflow-hidden">{children}</body>
    </html>
  );
}
