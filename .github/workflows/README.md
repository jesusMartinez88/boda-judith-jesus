# GitHub Actions Workflows

Este directorio contiene los workflows de CI/CD para el proyecto.

## Workflows disponibles

### 1. Deploy (`deploy.yaml`)

**Trigger:** Automático en push a `main`

**Propósito:** Construir y desplegar la aplicación a GitHub Pages

**Pasos:**

1. Checkout del código
2. Setup de Node.js
3. Instalación de dependencias
4. **Sincronización de versión** (asegura que todos los archivos tengan la versión correcta)
5. Inyección de variables de entorno
6. Build de producción
7. Deploy a GitHub Pages

**Variables requeridas:**

- `NG_APP_SHEETURL` (secret)
- `YOUTUBE_API_KEY` (secret)
- `GH_TOKEN` (secret)

### 2. Version Bump (`version-bump.yaml`)

**Trigger:** Manual desde la pestaña Actions

**Propósito:** Incrementar la versión del proyecto de forma automatizada

**Parámetros:**

- `version_type`: patch | minor | major

**Pasos:**

1. Checkout del código
2. Setup de Node.js
3. Configuración de Git
4. Instalación de dependencias
5. Incremento de versión con `npm version`
6. Sincronización de archivos (package-lock.json, version.service.ts, sw.js)
7. Commit de cambios
8. Push de cambios y tags
9. Creación de GitHub Release

**Resultado:**

- Nueva versión en `main`
- Tag de git creado
- GitHub Release publicado
- Trigger automático del workflow de Deploy

## Cómo usar Version Bump

1. Ve a la pestaña **Actions** en GitHub
2. Selecciona el workflow **"Version Bump"**
3. Click en **"Run workflow"** (botón azul)
4. Selecciona el tipo de versión:
   - **patch**: Para correcciones de bugs (1.3.0 → 1.3.1)
   - **minor**: Para nuevas funcionalidades (1.3.0 → 1.4.0)
   - **major**: Para cambios incompatibles (1.3.0 → 2.0.0)
5. Click en **"Run workflow"**

El workflow se ejecutará y:

- Incrementará la versión
- Actualizará todos los archivos necesarios
- Creará un commit y tag
- Publicará un release en GitHub
- Disparará automáticamente el deploy

## Flujo de trabajo recomendado

### Para desarrollo normal:

```
1. Crear feature branch
2. Hacer cambios y commits
3. Crear Pull Request
4. Revisar y mergear a main
5. Ejecutar "Version Bump" desde Actions (si es necesario)
6. El deploy se ejecuta automáticamente
```

### Para hotfixes urgentes:

```
1. Hacer cambios directamente en main (o hotfix branch)
2. Mergear a main
3. Ejecutar "Version Bump" con tipo "patch"
4. El deploy se ejecuta automáticamente
```

## Archivos sincronizados por Version Bump

- `package.json` - Versión principal (fuente de verdad)
- `package-lock.json` - Lockfile de npm
- `public/sw.js` - Cache del Service Worker

**Nota:** `src/app/services/version.service.ts` importa directamente el `package.json` usando TypeScript, por lo que no requiere sincronización.

## Permisos requeridos

Los workflows necesitan los siguientes permisos:

- `contents: write` - Para hacer commits y crear releases
- `GITHUB_TOKEN` - Proporcionado automáticamente por GitHub Actions

## Troubleshooting

### El workflow de Version Bump falla

- Verifica que no haya cambios sin commitear en main
- Asegúrate de que los permisos de Actions estén habilitados
- Revisa los logs del workflow para más detalles

### El deploy falla

- Verifica que las secrets estén configuradas correctamente
- Asegúrate de que GitHub Pages esté habilitado en el repositorio
- Revisa que la rama de deploy sea correcta

### La versión no se actualiza

- Ejecuta `npm run version:sync` localmente para verificar el script
- Verifica que todos los archivos tengan permisos de escritura
- Asegúrate de que el script `scripts/update-version.js` exista

## Monitoreo

Puedes ver el estado de los workflows en:

- Pestaña **Actions** del repositorio
- Badge de status en el README (si está configurado)
- Notificaciones de GitHub (si están habilitadas)
