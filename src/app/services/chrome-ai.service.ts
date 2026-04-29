import { Injectable, signal } from '@angular/core';

// Tipos para la Chrome AI API (Prompt API)
interface AILanguageModelSession {
  prompt(text: string, options?: any): Promise<string>;
  promptStreaming(text: string, options?: any): ReadableStream;
  destroy(): void;
  clone(): Promise<AILanguageModelSession>;
}

interface AILanguageModelCapabilities {
  available: 'readily' | 'after-download' | 'no';
}

interface AILanguageModel {
  availability(options?: any): Promise<AILanguageModelCapabilities>;
  create(options?: any): Promise<AILanguageModelSession>;
}

declare global {
  interface Window {
    LanguageModel?: AILanguageModel;
    ai?: {
      languageModel: AILanguageModel;
    };
  }
}

@Injectable({
  providedIn: 'root'
})
export class ChromeAiService {
  isAvailable = signal(false);
  isLoading = signal(false);
  needsDownload = signal(false);
  private session: AILanguageModelSession | null = null;

  constructor() {
    this.checkAvailability();
  }

  private get aiModel() {
    return window.ai?.languageModel || window.LanguageModel;
  }

  private async checkAvailability() {
    try {
      const model = this.aiModel;
      if (model) {
        // En algunas versiones es capabilities() y en otras availability()
        let capabilities: any;
        if ((model as any).capabilities) {
          capabilities = await (model as any).capabilities();
        } else if ((model as any).availability) {
          capabilities = await (model as any).availability();
        }

        // Si capabilities es un string (algunas versiones viejas), lo usamos directamente
        // Si es un objeto, buscamos la propiedad available
        const status = typeof capabilities === 'string' ? capabilities : capabilities?.available;

        const readyValues = ['readily', 'available'];
        const downloadValues = ['after-download', 'downloadable'];
        const unavailableValues = ['no', 'unavailable'];

        const isReady = readyValues.includes(status);
        const needsDl = downloadValues.includes(status);
        const isUnavailable = unavailableValues.includes(status);

        this.isAvailable.set(isReady || needsDl);
        this.needsDownload.set(needsDl);

        if (isUnavailable || status === undefined) {
          // Si es undefined, algo falló en la detección, mejor desactivar local
          this.isAvailable.set(false);
          this.needsDownload.set(false);
        }
      } else {
        this.isAvailable.set(false);
        this.needsDownload.set(false);
      }
    } catch (error) {
      console.error('Error checking AI availability:', error);
      this.isAvailable.set(false);
      this.needsDownload.set(false);
    }
  }

  async recheckAvailability() {
    await this.checkAvailability();
  }

  private async getSession(): Promise<AILanguageModelSession> {
    const model = this.aiModel;
    if (!this.session && model) {
      try {
        this.session = await model.create({
          monitor(m: any) {
            m.addEventListener('downloadprogress', (e: any) => {
              console.log(`Descargando modelo: ${Math.round(e.loaded * 100)}%`);
            });
          },
        });
      } catch (error) {
        console.error('Error creando sesión:', error);
        this.session = null;
        throw error;
      }
    }
    if (!this.session) {
      throw new Error('No se pudo crear la sesión de AI');
    }
    return this.session;
  }

  private resetSession() {
    if (this.session) {
      try {
        this.session.destroy();
      } catch (e) {}
      this.session = null;
    }
  }

  async generateWeddingMessage(): Promise<string> {
    if (!this.isAvailable()) {
      throw new Error('Chrome AI no está disponible');
    }

    this.isLoading.set(true);
    try {
      const session = await this.getSession();
      const prompt = `Genera un mensaje corto y emotivo (máximo 2-3 frases) para felicitar a una pareja de novios en su boda. 
      Debe ser cálido, sincero y especial. No uses emojis. Escribe en español.`;
      
      const response = await session.prompt(prompt);
      return response.trim();
    } catch (error: any) {
      console.error('Error generando mensaje:', error);
      
      // Manejar error de espacio insuficiente
      if (error.name === 'NotAllowedError' && error.message?.includes('enough space')) {
        throw new Error('No hay suficiente espacio en disco para descargar el modelo de IA (se necesitan ~22GB libres).');
      }
      
      // Si es un error genérico, resetear la sesión para el próximo intento
      if (error.message?.includes('generic failures') || error.name === 'UnknownError') {
        this.resetSession();
        throw new Error('El modelo de IA aún se está inicializando. Por favor, espera unos segundos e intenta de nuevo.');
      }
      
      throw error;
    } finally {
      this.isLoading.set(false);
    }
  }

  async generatePartySong(): Promise<string> {
    if (!this.isAvailable()) {
      throw new Error('Chrome AI no está disponible');
    }

    this.isLoading.set(true);
    try {
      const session = await this.getSession();
      const prompt = `Sugiere UNA canción popular de discoteca o fiesta perfecta para bailar en una boda, dando preferencia a música o artistas en español. 
      Responde SOLO con el nombre de la canción y el artista en este formato exacto: "Nombre de la canción - Artista"
      Elige canciones conocidas y animadas que funcionen bien en bodas. Escribe en español.`;
      
      const response = await session.prompt(prompt);
      return response.trim();
    } catch (error: any) {
      console.error('Error generando canción:', error);
      
      // Manejar error de espacio insuficiente
      if (error.name === 'NotAllowedError' && error.message?.includes('enough space')) {
        throw new Error('No hay suficiente espacio en disco para descargar el modelo de IA (se necesitan ~22GB libres).');
      }
      
      // Si es un error genérico, resetear la sesión para el próximo intento
      if (error.message?.includes('generic failures') || error.name === 'UnknownError') {
        this.resetSession();
        throw new Error('El modelo de IA aún se está inicializando. Por favor, espera unos segundos e intenta de nuevo.');
      }
      
      throw error;
    } finally {
      this.isLoading.set(false);
    }
  }

  async generateMessageAndSong(): Promise<{ message: string; song: string }> {
    const [message, song] = await Promise.all([
      this.generateWeddingMessage(),
      this.generatePartySong()
    ]);

    return { message, song };
  }

  async generateExcuse(): Promise<string> {
    if (!this.isAvailable()) {
      throw new Error('Chrome AI no está disponible');
    }

    this.isLoading.set(true);
    try {
      const session = await this.getSession();
      const prompt = `Genera una excusa breve, educada y creíble (máximo 2-3 frases) de por qué alguien no puede asistir a una boda. 
      Debe ser respetuosa, sincera y comprensible. No uses emojis. Escribe en español.
      Ejemplos de motivos: compromisos laborales, viaje previo, problemas de salud, compromisos familiares, etc.`;
      
      const response = await session.prompt(prompt);
      return response.trim();
    } catch (error: any) {
      console.error('Error generando excusa:', error);
      
      // Manejar error de espacio insuficiente
      if (error.name === 'NotAllowedError' && error.message?.includes('enough space')) {
        throw new Error('No hay suficiente espacio en disco para descargar el modelo de IA (se necesitan ~22GB libres).');
      }
      
      // Si es un error genérico, resetear la sesión para el próximo intento
      if (error.message?.includes('generic failures') || error.name === 'UnknownError') {
        this.resetSession();
        throw new Error('El modelo de IA aún se está inicializando. Por favor, espera unos segundos e intenta de nuevo.');
      }
      
      throw error;
    } finally {
      this.isLoading.set(false);
    }
  }

  destroy() {
    if (this.session) {
      this.session.destroy();
      this.session = null;
    }
  }
}
