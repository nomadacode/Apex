import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";

import { ServiceWorker } from "@/components/pwa/service-worker";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Apex — Planificador de proyectos",
  description:
    "Planificador de proyectos: tareas, tablero, cronograma, calendarios y reportes.",
  applicationName: "Apex",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/icons/32", sizes: "32x32", type: "image/png" }],
    apple: [{ url: "/icons/180", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    // Esto es lo que hace que, al agregarla a la pantalla de inicio en
    // iPhone, la app abra sin la barra de Safari.
    capable: true,
    title: "Apex",
    statusBarStyle: "black-translucent",
  },
  formatDetection: {
    // Sin esto, iOS convierte fechas y números en enlaces azules.
    telephone: false,
    date: false,
  },
  other: {
    // Next emite la etiqueta estándar `mobile-web-app-capable`, pero
    // Safari en iOS sigue leyendo la suya con prefijo: sin ella, la app
    // agregada a la pantalla de inicio abre con la barra del navegador.
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Que el fondo llegue hasta debajo de la barra de estado y el notch;
  // el espacio seguro lo maneja el CSS con `env(safe-area-inset-*)`.
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0d0f13" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      {/* `suppressHydrationWarning` acá es por las extensiones del
          navegador: varias (ColorZilla, gestores de contraseñas, lectores)
          inyectan atributos en el `<body>` antes de que React hidrate, y
          eso dispara una alerta que no viene de este código. Solo silencia
          los atributos de este elemento, no los de sus hijos, así que un
          desajuste propio dentro de la app se sigue reportando. */}
      <body className="min-h-full" suppressHydrationWarning>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
          {/* Los avisos también se posicionan contra la ventana: sin
              correrlos, el de más abajo aterrizaba sobre la barra de
              gestos y su botón de cerrar no respondía. */}
          <Toaster
            position="bottom-right"
            richColors
            closeButton
            offset={{
              top: "calc(1rem + var(--safe-top))",
              right: "calc(1rem + var(--safe-right))",
              bottom: "calc(1rem + var(--safe-bottom))",
              left: "calc(1rem + var(--safe-left))",
            }}
            mobileOffset={{
              top: "calc(1rem + var(--safe-top))",
              right: "calc(1rem + var(--safe-right))",
              bottom: "calc(1rem + var(--safe-bottom))",
              left: "calc(1rem + var(--safe-left))",
            }}
          />
          <ServiceWorker />
        </ThemeProvider>
      </body>
    </html>
  );
}
