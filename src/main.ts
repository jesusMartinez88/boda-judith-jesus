import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { HealthService } from './app/services/health.service';

bootstrapApplication(App, appConfig)
  .then((moduleRef) => {
    // Warm-up del servidor en paralelo
    const healthService = moduleRef.injector.get(HealthService);
    healthService.warmUpServer();
  })
  .catch((err) => console.error(err));
