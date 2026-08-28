import './globals.css';

export const metadata = {
  title: 'App Ônibus Recife',
  description: 'Transporte público em tempo real',
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <head>
        {/* CSS Oficial do Mapbox para renderização perfeita */}
        <link
          href="https://api.mapbox.com/mapbox-gl-js/v3.1.2/mapbox-gl.css"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
