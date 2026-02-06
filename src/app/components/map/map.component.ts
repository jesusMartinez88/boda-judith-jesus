import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import L from 'leaflet';

@Component({
  selector: 'app-map',
  standalone: true,
  templateUrl: './map.component.html',
  styleUrl: './map.component.css'
})
export class MapComponent implements OnInit {
  @ViewChild('mapContainer') mapContainer!: ElementRef;
  private map: any;

  ngOnInit() {
    setTimeout(() => this.initializeMap(), 100);
  }

  private initializeMap() {
    // Coordenadas de Pericon Azahar (ubicación aproximada)
    const lat = 37.1686;
    const lng = -3.5944;

    this.map = L.map(this.mapContainer.nativeElement).setView([lat, lng], 15);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(this.map);

    // Agregar marcador personalizado
    const customIcon = L.divIcon({
      html: `<div class="custom-marker">💍</div>`,
      className: 'custom-marker-container',
      iconSize: [40, 40],
      iconAnchor: [20, 40],
      popupAnchor: [0, -40]
    });

    L.marker([lat, lng], { icon: customIcon })
      .addTo(this.map)
      .bindPopup('<strong>Pericon Azahar</strong><br>Lugar de la Boda', { offset: L.point(0, -10) })
      .openPopup();

    // Hacer el mapa responsivo
    setTimeout(() => this.map.invalidateSize(), 300);
  }
}
