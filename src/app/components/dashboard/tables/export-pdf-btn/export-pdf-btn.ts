import { Component, signal, input } from '@angular/core';
import jsPDF from 'jspdf';
import { toPng } from 'html-to-image';

interface TableRotationInfo {
  id: number;
  rotation?: number;
}

@Component({
  selector: 'app-export-pdf-btn',
  standalone: true,
  imports: [],
  templateUrl: './export-pdf-btn.html',
  styleUrl: './export-pdf-btn.css',
})
export class ExportPdfBtnComponent {
  readonly hallElement = input.required<HTMLElement | undefined>();
  readonly tables = input<TableRotationInfo[]>([]);

  isExportingPdf = signal(false);

  async exportHallToPdf() {
    const hallElement = this.hallElement();
    if (!hallElement) return;

    this.isExportingPdf.set(true);

    // Neutralizamos el zoom del salón para que el PDF salga sin escalar
    const originalHallTransform = hallElement.style.transform;
    hallElement.style.transform = 'none';

    try {
      // html-to-image tiene un bug conocido: en la primera llamada los estilos de SVGs
      // embebidos (como el progress-ring) no se aplican correctamente y salen con fondo negro.
      // La solución documentada es llamar toPng dos veces — la primera calienta el cache
      // de estilos, la segunda renderiza correctamente.
      const options = {
        pixelRatio: 2,
        backgroundColor: '#eedfc4',
        cacheBust: true,
        style: {
          transform: 'none',
        },
      };
      await toPng(hallElement, options); // primera pasada: calienta el cache
      const dataUrl = await toPng(hallElement, options); // segunda: renderizado correcto


      hallElement.style.transform = originalHallTransform;

      const img = new Image();
      img.src = dataUrl;
      await new Promise<void>((resolve) => {
        img.onload = () => resolve();
      });

      const pdf = new jsPDF('l', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      const ratio = img.width / img.height;
      let finalWidth = pdfWidth;
      let finalHeight = finalWidth / ratio;

      if (finalHeight > pdfHeight) {
        finalHeight = pdfHeight;
        finalWidth = finalHeight * ratio;
      }

      const x = (pdfWidth - finalWidth) / 2;
      const y = (pdfHeight - finalHeight) / 2;

      pdf.addImage(dataUrl, 'PNG', x, y, finalWidth, finalHeight);
      pdf.save('distribucion_mesas.pdf');
    } catch (error) {
      hallElement.style.transform = originalHallTransform;
      console.error('Error generando PDF:', error);
      alert('Ocurrió un error al generar el PDF de las mesas.');
    } finally {
      this.isExportingPdf.set(false);
    }
  }
}

