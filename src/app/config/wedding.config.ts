/**
 * CONFIGURACIÓN PRINCIPAL DE LA BODA
 *
 * Modifica este archivo para cambiar detalles de la boda
 * sin tener que editar múltiples archivos
 */

export const WEDDING_CONFIG = {
  // Información de los novios
  groom: 'Jesús',
  bride: 'Judith',

  // Fecha y hora de la ceremonia
  ceremonyDate: new Date('2026-07-11T18:00:00'),

  // Información de ubicación
  location: {
    name: 'Pericon Azahar',
    city: 'Granada',
    country: 'España',
    latitude: 37.1686,
    longitude: -3.5944,
  },

  // Colores principales
  colors: {
    primary: '#ec4899', // Rosa principal
    secondary: '#be185d', // Rosa oscuro
    accent: '#f472b6', // Rosa claro
  },

  // Cronograma de eventos
  schedule: [
    {
      time: '18:00',
      title: 'Ceremonia',
      description: 'Ceremonia en blanca. ¡El momento esperado!',
      location: 'Iglesia del Blanca',
      icon: '💍',
    },
    {
      time: '21:00',
      title: 'Cóctel',
      description: 'Aperitivos y bebidas en un ambiente relajado',
      location: 'Pericon Azahar (Abarán)',
      icon: '🥂',
    },
    {
      time: '22:30',
      title: 'Cena',
      description: 'Cena de gala con menú especial',
      location: 'Pericon Azahar (Abarán)',
      icon: '🍽️',
    },
    {
      time: '00:30',
      title: 'Barra Libre & Fiesta',
      description: 'Barra libre y diversión toda la noche',
      location: 'Pericon Azahar (Abarán)',
      icon: '🎉',
    },
  ],

  // Configuración de API
  api: {
    baseUrl: 'https://boda-backend-4e6z.onrender.com',
    guestsEndpoint: '/api/guests',
  },

  // Textos personalizables
  texts: {
    heroSubtitle: 'Se casan el 11 de Julio de 2026',
    heroLocation: 'Granada, España',
    countdownTitle: 'Nos casamos en',
    galleryTitle: 'Nuestra historia',
    gallerySubtitle: 'Nuestros momentos especiales',
    timelineTitle: 'Cronograma del Día',
    mapTitle: 'Ubicación',
    rsvpTitle: 'Confirma tu Asistencia',
    rsvpSubtitle: 'Ayúdanos a preparar un día perfecto',
  },

  // Fotos (actualizar con tus rutas)
  photos: {
    hero: 'assets/fotos/hero.jpg',
    gallery: [
      'assets/fotos/foto1.jpg',
      'assets/fotos/foto2.jpg',
      'assets/fotos/foto3.jpg',
      'assets/fotos/foto4.jpg',
      'assets/fotos/foto5.jpg',
      'assets/fotos/foto6.jpg',
    ],
  },
};

export default WEDDING_CONFIG;
