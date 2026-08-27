import "./globals.css";

export const metadata = {
  title: "App Ônibus Recife",
  description: "Mobilidade simples em Recife",
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <head>
        <script src="https://cdn.tailwindcss.com"></script>
        {/* CSS do Leaflet para o mapa real */}
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
          integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
          crossOrigin=""
        />
      </head>
      <body className="bg-slate-900 text-slate-800 antialiased h-full w-full overflow-hidden select-none">
        {children}
      </body>
    </html>
  );
}
