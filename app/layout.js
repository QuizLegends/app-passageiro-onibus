import './globals.css';

export const metadata = {
  title: 'App Ônibus Recife',
  description: 'Transporte público em tempo real',
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <head>
        {/* CSS Oficial do Mapbox via CDN */}
        <link
          href="https://api.mapbox.com/mapbox-gl-js/v3.1.2/mapbox-gl.css"
          rel="stylesheet"
        />
      </head>
      <body className="w-full h-full m-0 p-0 overflow-hidden">{children}</body>
    </html>
  );
}
