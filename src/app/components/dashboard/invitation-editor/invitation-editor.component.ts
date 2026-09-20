import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { InvitationMediaService } from '../../../services/invitation-media.service';

type ImageKind = 'jpeg' | 'png' | 'webp';

interface PreparedPhoto {
  id: string;
  url: string;
  name: string;
}

interface PreparedUpload {
  blob: Blob;
  name: string;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_IMAGE_PIXELS = 20_000_000;
const MAX_RENDER_DIMENSION = 2560;
const MAX_GALLERY_PHOTOS = 12;

@Component({
  selector: 'app-invitation-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './invitation-editor.component.html',
  styleUrl: './invitation-editor.component.css',
})
export class InvitationEditorComponent implements OnInit {
  private readonly mediaService = inject(InvitationMediaService);
  readonly invitationUrl = input.required<string>();

  readonly coverPhoto = signal<PreparedPhoto | null>(null);
  readonly galleryPhotos = signal<PreparedPhoto[]>([]);
  readonly errorMessage = signal<string | null>(null);
  readonly isPreparing = signal(false);

  async selectCover(event: Event) {
    const file = this.fileFrom(event);
    if (!file) return;

    this.isPreparing.set(true);
    try {
      const photo = await this.preparePhoto(file);
      if (!photo) return;
      const url = await firstValueFrom(this.mediaService.uploadCover(photo.blob));
      this.coverPhoto.set(this.toPreparedPhoto(url, photo.name));
    } catch {
      this.errorMessage.set('No se pudo guardar la foto de portada. Inténtalo de nuevo.');
    } finally {
      this.isPreparing.set(false);
    }
  }

  async addGalleryPhotos(event: Event) {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';

    if (!files.length) return;
    const remaining = MAX_GALLERY_PHOTOS - this.galleryPhotos().length;
    if (remaining <= 0) {
      this.errorMessage.set(`Puedes añadir un máximo de ${MAX_GALLERY_PHOTOS} fotos a la galería.`);
      return;
    }

    if (files.length > remaining) {
      this.errorMessage.set(
        `Solo se añadirán ${remaining} fotos para completar el límite de ${MAX_GALLERY_PHOTOS}.`,
      );
    }

    this.isPreparing.set(true);
    try {
      const photos = await Promise.all(
        files.slice(0, remaining).map((file) => this.preparePhoto(file)),
      );
      const validPhotos = photos.filter((photo): photo is PreparedUpload => photo !== null);
      if (!validPhotos.length) return;
      const urls = await firstValueFrom(
        this.mediaService.uploadGallery(validPhotos.map((photo) => photo.blob)),
      );
      this.galleryPhotos.update((current) => [
        ...current,
        ...urls.map((url, index) => this.toPreparedPhoto(url, validPhotos[index].name)),
      ]);
    } catch {
      this.errorMessage.set('No se pudieron guardar las fotos de la galería. Inténtalo de nuevo.');
    } finally {
      this.isPreparing.set(false);
    }
  }

  async removeCover() {
    const photo = this.coverPhoto();
    if (!photo) return;
    try {
      await firstValueFrom(this.mediaService.remove(photo.url));
      this.coverPhoto.set(null);
    } catch {
      this.errorMessage.set('No se pudo eliminar la foto de portada.');
    }
  }

  async removeGalleryPhoto(id: string) {
    const photo = this.galleryPhotos().find((item) => item.id === id) ?? null;
    if (!photo) return;
    try {
      await firstValueFrom(this.mediaService.remove(photo.url));
      this.galleryPhotos.update((photos) => photos.filter((item) => item.id !== id));
    } catch {
      this.errorMessage.set('No se pudo eliminar la foto de la galería.');
    }
  }

  async ngOnInit() {
    try {
      const media = await firstValueFrom(this.mediaService.listMine());
      this.coverPhoto.set(media.coverUrl ? this.toPreparedPhoto(media.coverUrl) : null);
      this.galleryPhotos.set(media.galleryUrls.map((url) => this.toPreparedPhoto(url)));
    } catch {
      this.errorMessage.set('No se pudieron cargar las fotos guardadas.');
    }
  }

  private fileFrom(event: Event): File | null {
    const input = event.target as HTMLInputElement;
    const file = input.files?.item(0) ?? null;
    input.value = '';
    return file;
  }

  private async preparePhoto(file: File): Promise<PreparedUpload | null> {
    this.errorMessage.set(null);

    if (file.size === 0 || file.size > MAX_FILE_SIZE) {
      this.errorMessage.set('Cada imagen debe pesar como máximo 10 MB.');
      return null;
    }

    try {
      const kind = await this.detectImageKind(file);
      if (!kind) {
        this.errorMessage.set(
          'Selecciona una imagen JPEG, PNG o WebP válida. No se admiten SVG ni otros formatos.',
        );
        return null;
      }

      const bitmap = await createImageBitmap(file);
      try {
        if (bitmap.width * bitmap.height > MAX_IMAGE_PIXELS) {
          this.errorMessage.set(
            'La imagen tiene demasiados píxeles. Elige una de hasta 20 megapíxeles.',
          );
          return null;
        }

        const cleanBlob = await this.reencode(bitmap);
        return {
          blob: cleanBlob,
          name: file.name,
        };
      } finally {
        bitmap.close();
      }
    } catch {
      this.errorMessage.set('No se ha podido leer la imagen. Prueba con otro archivo.');
      return null;
    }
  }

  private async detectImageKind(file: File): Promise<ImageKind | null> {
    const header = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    const jpeg = header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
    const png =
      header[0] === 0x89 &&
      header[1] === 0x50 &&
      header[2] === 0x4e &&
      header[3] === 0x47 &&
      header[4] === 0x0d &&
      header[5] === 0x0a &&
      header[6] === 0x1a &&
      header[7] === 0x0a;
    const webp =
      header[0] === 0x52 &&
      header[1] === 0x49 &&
      header[2] === 0x46 &&
      header[3] === 0x46 &&
      header[8] === 0x57 &&
      header[9] === 0x45 &&
      header[10] === 0x42 &&
      header[11] === 0x50;

    return jpeg ? 'jpeg' : png ? 'png' : webp ? 'webp' : null;
  }

  private async reencode(bitmap: ImageBitmap): Promise<Blob> {
    const scale = Math.min(1, MAX_RENDER_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas is not available');

    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/webp', 0.9),
    );
    if (!blob) throw new Error('Image could not be encoded');
    return blob;
  }

  private toPreparedPhoto(url: string, originalName?: string): PreparedPhoto {
    return {
      id: url,
      url,
      name:
        originalName ?? decodeURIComponent(new URL(url).pathname.split('/').pop() ?? 'foto.webp'),
    };
  }
}
