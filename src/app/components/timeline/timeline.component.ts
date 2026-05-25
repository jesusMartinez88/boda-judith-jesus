import { Component } from '@angular/core';

interface Event {
  time: string;
  title: string;
  description: string;
  location: string;
  locationUrl?: string;
  icon: string;
}

@Component({
  selector: 'app-timeline',
  standalone: true,
  imports: [],
  templateUrl: './timeline.component.html',
  styleUrl: './timeline.component.css',
})
export class TimelineComponent {
  events: Event[] = [
    {
      time: '18:00',
      title: 'Ceremonia',
      description: 'Ceremonia en Blanca. ¡El momento esperado!',
      location: 'Iglesia de Blanca',
      locationUrl: 'https://www.google.com/maps/dir/?api=1&destination=38.1804621,-1.375567',
      icon: '💍',
    },
    {
      time: '21:00',
      title: 'Cóctel',
      description: 'Aperitivos y bebidas en un ambiente relajado',
      location: 'Pericon Azahar',
      locationUrl: 'https://www.google.com/maps/dir/?api=1&destination=38.2151126,-1.3497794',
      icon: '🥂',
    },
    {
      time: '22:30',
      title: 'Cena',
      description: 'Cena de gala con menú especial',
      location: 'Pericon Azahar',
      locationUrl: 'https://www.google.com/maps/dir/?api=1&destination=38.2151126,-1.3497794',
      icon: '🍽️',
    },
    {
      time: '00:30',
      title: 'Barra Libre & Fiesta',
      description: 'Barra libre y diversión toda la noche',
      location: 'Pericon Azahar',
      locationUrl: 'https://www.google.com/maps/dir/?api=1&destination=38.2151126,-1.3497794',
      icon: '🎉',
    },
  ];
}
