import { Component, signal, input } from '@angular/core';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

@Component({
  selector: 'app-export-pdf-btn',
  standalone: true,
  imports: [],
  templateUrl: './export-pdf-btn.html',
  styleUrl: './export-pdf-btn.css',
})
export class ExportPdfBtnComponent {
  readonly hallElement = input.required<HTMLElement | undefined>();

  isExportingPdf = signal(false);

  async exportHallToPdf() {
    const hallElement = this.hallElement();
    if (!hallElement) return;

    this.isExportingPdf.set(true);

    try {
      const element = hallElement;

      const canvas = await html2canvas(element, {
        scale: 2, // Buena resolución
        useCORS: true,
        backgroundColor: '#f8fafc', // Fondo del dashboard
      });

      const imgData = canvas.toDataURL('image/png');

      // Crear PDF apaisado A4
      const pdf = new jsPDF('l', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = imgWidth / imgHeight;

      let finalWidth = pdfWidth;
      let finalHeight = finalWidth / ratio;

      // Escalar si el alto supera a la página
      if (finalHeight > pdfHeight) {
        finalHeight = pdfHeight;
        finalWidth = finalHeight * ratio;
      }

      // Centrar
      const x = (pdfWidth - finalWidth) / 2;
      const y = (pdfHeight - finalHeight) / 2;

      pdf.addImage(imgData, 'PNG', x, y, finalWidth, finalHeight);
      pdf.save('distribucion_mesas.pdf');
    } catch (error) {
      console.error('Error generando PDF:', error);
      alert('Ocurrió un error al generar el PDF de las mesas.');
    } finally {
      this.isExportingPdf.set(false);
    }
  }
}
