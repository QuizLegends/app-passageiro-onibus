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
      </head>
      <body className="bg-slate-900 text-slate-800 antialiased">
        {children}
      </body>
    </html>
  );
}
