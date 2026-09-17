export const environment = {
  production: false,
  apiUrl: 'http://localhost:3000/api/guests',
  apiBaseUrl: 'http://localhost:3000',

  /**
   * Información de contacto mostrada en el footer compartido de las
   * páginas públicas (landing + /contacto) y en la sección de contacto.
   *
   *  - `supportEmail`     Aparece en el footer y se usa como `mailto:`.
   *  - `whatsappNumber`   Número en formato internacional SIN `+` (lo que
   *                        espera `https://wa.me/<numero>`). Ej: '34695677269'.
   *  - `whatsappDisplay`  Texto humano que se muestra al usuario.
   *  - `whatsappPrefill`  Mensaje opcional que se pre-rellena al abrir el
   *                        chat (se codifica automáticamente con
   *                        `encodeURIComponent`).
   *
   * Ajusta estos valores a tus datos reales: el formulario público envía
   * al `EMAILOWNER` del backend, que puede ser el mismo o uno distinto.
   */
  landingContact: {
    supportEmail: 'jesusmartinezsanchez9@gmail.com',
    whatsappNumber: '34695677269',
    whatsappDisplay: '+34 695 677 269',
    whatsappPrefill:
      'Hola Jesús, vengo de la web de BodasOnline y me gustaría hacerte una consulta.',
  },
};
