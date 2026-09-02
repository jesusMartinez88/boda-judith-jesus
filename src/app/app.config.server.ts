import { mergeApplicationConfig, ApplicationConfig } from '@angular/core';
import { provideServerRendering, withRoutes, RenderMode, ServerRoute } from '@angular/ssr';

import { appConfig } from './app.config';

// Configuración de renderizado por ruta:
// - /login y /register se renderizan previamente al hacer el build.
// - El resto de rutas siguen en CSR (Client-Side Rendering), sin cambios.
//
// Cuando un usuario entra a /login o /register, el servidor Express ejecuta
// el bootstrap de Angular, renderiza la página a HTML y la envía al cliente,
// que luego se hidrata y se vuelve interactiva.
const serverRoutes: ServerRoute[] = [
  { path: '', renderMode: RenderMode.Prerender },
  { path: 'login', renderMode: RenderMode.Prerender },
  { path: 'register', renderMode: RenderMode.Prerender },
  { path: '**', renderMode: RenderMode.Client },
];

const serverConfig: ApplicationConfig = {
  providers: [provideServerRendering(withRoutes(serverRoutes))],
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
