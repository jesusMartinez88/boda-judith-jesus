import { Injectable, signal } from '@angular/core';
import { Observable } from 'rxjs';

// Tipos para la Chrome AI API (Prompt API)
interface AILanguageModelSession {
  prompt(text: string, options?: { signal?: AbortSignal }): Promise<string>;
  promptStreaming(text: string, options?: { signal?: AbortSignal }): AsyncIterable<string>;
  destroy(): void;
  clone(): Promise<AILanguageModelSession>;
}

interface AILanguageModelCapabilities {
  available: 'readily' | 'after-download' | 'no';
}

interface AILanguageModel {
  capabilities(): Promise<AILanguageModelCapabilities>;
  availability(): Promise<AILanguageModelCapabilities>;
  create(options?: {
    monitor?: (m: any) => void;
    signal?: AbortSignal;
    systemPrompt?: string;
  }): Promise<AILanguageModelSession>;
}

declare global {
  interface Window {
    ai?: {
      languageModel: AILanguageModel;
    };
    LanguageModel?: AILanguageModel;
  }
}

@Injectable({
  providedIn: 'root'
})
export class ChromeAiService {
  isAvailable = signal(false);
  isLoading = signal(false);
  isSupported = signal(false);
  needsDownload = signal(false);
  downloadProgress = signal(0);
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
        this.isSupported.set(true);
        
        let status: any;
        
        // 1. Intentar obtener el estado y LOGUEAR el objeto completo para ver qué hay dentro
        if ((model as any).capabilities) {
          const cap = await (model as any).capabilities();
          status = typeof cap === 'string' ? cap : (cap?.available || cap?.status);
        } else if ((model as any).availability) {
          const av = await (model as any).availability();
          status = typeof av === 'string' ? av : (av?.available || av?.status);
        } else if ((window as any).ai?.canCreateTextSession) {
          status = await (window as any).ai.canCreateTextSession();
        }

        const isReady = status === 'readily' || status === 'available';
        const needsDl = status === 'after-download' || status === 'downloadable';
        const isUnavailable = status === 'no' || status === 'unavailable';

        this.isAvailable.set(isReady);
        
        if (status === undefined || status === null) {
          this.isAvailable.set(false);
          this.needsDownload.set(true);
        } else {
          this.needsDownload.set(needsDl || (!isReady && !isUnavailable));
        }

        if (isUnavailable) {
          this.isAvailable.set(false);
          this.needsDownload.set(false);
        }
      } else {
        this.isSupported.set(false);
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

  async downloadModel(): Promise<void> {
    await this.getSession();
    this.needsDownload.set(false);
  }

  private async getSession(): Promise<AILanguageModelSession> {
    const model = this.aiModel;
    if (!this.session && model) {
      try {
        this.session = await model.create({
          monitor: (m: { addEventListener: (name: string, cb: (e: { loaded: number, total: number }) => void) => void }) => {
            m.addEventListener('downloadprogress', (e) => {
              const progress = Math.round((e.loaded / e.total) * 100);
              this.downloadProgress.set(progress);
              console.log(`Descargando modelo: ${progress}%`);
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

  async generate(prompt: string): Promise<string> {
    const session = await this.getSession();
    const result = await session.prompt(prompt);
    return result;
  }

  generateStream(prompt: string): Observable<string> {
    return new Observable<string>((observer) => {
      let isAborted = false;

      this.getSession().then(async (session) => {
        try {
          const stream = session.promptStreaming(prompt);
          let fullText = '';
          
          for await (const chunk of stream) {
            if (isAborted) break;
            
            let delta = '';
            // DETECCIÓN INTELIGENTE:
            // Si el chunk empieza por lo que ya teníamos, es ACUMULADO.
            // Si no, es un DELTA puro.
            if (chunk.startsWith(fullText) && fullText.length > 0) {
              delta = chunk.substring(fullText.length);
              fullText = chunk;
            } else {
              delta = chunk;
              fullText += chunk;
            }

            if (delta) {
              observer.next(delta);
            }
          }
          observer.complete();
        } catch (error) {
          observer.error(error);
        }
      }).catch(err => observer.error(err));

      return () => { isAborted = true; };
    });
  }

  generateAttendanceNoteStream(guestName: string): Observable<string> {
    const prompt = `Actúa como el invitado "${guestName}" que confirma su asistencia a la boda de Judith y Jesús. 
    Escribe una nota rápida, festiva y cariñosa para los novios. 
    Y recomienda UNA canción de fiesta para bailar.
    Formato:
    MENSAJE: [Tu nota aquí]
    CANCION: [Canción - Artista]
    Escribe en español.`;
    return this.generateStream(prompt);
  }

  generateExcuseStream(): Observable<string> {
    const prompt = 'Actúa como un invitado que no puede asistir a una boda. Genera una excusa breve (1-2 frases), educada y cariñosa en español para los novios (Judith y Jesús).';
    return this.generateStream(prompt);
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
