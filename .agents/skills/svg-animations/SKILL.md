---
name: svg-css-animation
description: "Genera micro-animaciones SVG con CSS puro (cero JavaScript, cero librerías). Actívate cuando el usuario quiera animar un SVG, añadir animaciones a una ilustración, crear efectos de entrada/reveal/pulso en SVG, o pida animaciones CSS para gráficos vectoriales. Usa @property + @keyframes, maneja transform attributes existentes con wrappers limpios, y aplica transform-box: fill-box para SVG. Siempre pregunta el tipo de animación antes de generar: sencilla, por partes o detallada."
---

# SVG + CSS Micro-animations Skill

## La filosofía

El SVG **nunca se modifica estructuralmente**. Lo que hacemos es:
1. Analizar el SVG para entender qué partes queremos animar y qué transforms ya existen
2. Agrupar partes animables con `<g id="nombre">` si no están identificadas
3. Controlar esas partes desde CSS puro con `@property` + `@keyframes`

Sin JavaScript. Sin librerías. Solo CSS moderno.

---

## Paso 0 — Preguntar antes de generar

Antes de escribir una sola línea de código, **siempre pregunta al usuario**:

> "¿Qué tipo de animación buscas?
> - **Sencilla**: entrada suave de toda la ilustración (fade + scale). Rápido y limpio.
> - **Por partes**: cada sección aparece en secuencia (fondo → contenido → personaje). Más narrativa.
> - **Detallada**: animaciones específicas por elemento (pulso, shake, reveal, rotación). Máxima expresividad."

Con esa respuesta, también lee el SVG e identifica:

1. **¿Qué grupos/paths son actores independientes?** (personaje, fondo, UI, iconos)
2. **¿Tienen `transform` attributes existentes?** (`transform="translate(...)"`, `transform="rotate(...)"`)
3. **¿La complejidad pedida es compatible con los actores disponibles en el SVG?**

---

## Paso 1 — Identificar qué animar y planear la historia

Define los "capítulos" de la animación con porcentajes:

```
0%   → estado inicial (todo oculto o en posición de salida)
33%  → Fase 1 terminada
66%  → Fase 2 terminada
100% → estado final (todo en su lugar)
```

Máximo 3-4 fases por animación. Más fases = más complejidad innecesaria.

---

## Paso 2 — Resolver el problema de transform attributes existentes

**Este es el error más común:** un grupo SVG ya tiene `transform="translate(x, y)"` como atributo. Si le aplicas CSS `transform` encima, los valores colisionan y los elementos se desposicionan.

### La solución: el wrapper limpio

```html
<!-- ❌ MAL: este <g> ya tiene transform, CSS transform colisiona -->
<g id="dashboard" transform="translate(657.698 351.964)">
  ...paths...
</g>

<!-- ✅ BIEN: wrapper limpio, sin transform attribute -->
<g id="dashboard-wrapper">
  <g transform="translate(657.698 351.964)">  <!-- transform original intacto -->
    ...paths...
  </g>
</g>
```

### Cuándo usar wrapper vs animar directo

| Situación | Qué hacer |
|---|---|
| El `<g>` NO tiene `transform` attribute | Anima directo, añade `id` |
| El `<g>` SÍ tiene `transform` attribute | Añade wrapper `<g id="...">` sin transform |
| Solo necesitas opacity (fade) | Anima directo aunque tenga transform (opacity no colisiona) |

---

## Paso 3 — Declarar `@property` para cada variable animable

```css
/* Para transforms (translate, rotate, scale) */
@property --nombre-transform {
    syntax: "<transform-function>";
    inherits: true;
    initial-value: scale(1);
}

/* Para opacidades */
@property --nombre-opacity {
    syntax: "<number>";
    inherits: true;
    initial-value: 0;
}

/* Para clip-path con porcentajes */
@property --nombre-clip {
    syntax: "<percentage>";
    inherits: true;
    initial-value: 0%;
}

/* Para ángulos */
@property --nombre-rotate {
    syntax: "<angle>";
    inherits: true;
    initial-value: 0deg;
}
```

**Por qué importa:** sin `@property`, las custom properties son strings — el navegador no puede interpolarlas. Con el tipo declarado, la transición es suave.

---

## Paso 4 — Aplicar variables en selectores estáticos

```css
#mi-wrapper {
    transform-box: fill-box;           /* Transforma relativo al propio elemento */
    transform-origin: center center;   /* Ajusta según la animación */
    transform: var(--mi-transform);
    opacity: var(--mi-opacity);
}
```

`transform-box: fill-box` es clave para SVG — sin esto, `transform-origin` se calcula relativo al viewport SVG, no al elemento.

---

## Paso 5 — Un solo @keyframes cuenta toda la historia

```css
.contenedor {
    animation: nombre-animacion 2s forwards ease-out;
}

@keyframes nombre-animacion {
    0% {
        --transform-a: scale(0);
        --opacity-b: 0;
    }
    33% {
        --transform-a: scale(1);  /* Fase 1 lista */
        --opacity-b: 0;
    }
    66% {
        --transform-a: scale(1);
        --opacity-b: 1;           /* Fase 2 lista */
    }
    100% {
        --transform-a: scale(1);
        --opacity-b: 1;
    }
}
```

**Siempre `forwards`** — para que el estado final se mantenga.

---

## Patrones comunes

### Aparición (scale 0→1)
```css
@property --scale-elemento { syntax: "<transform-function>"; inherits: true; initial-value: scale(0); }
#el { transform-box: fill-box; transform-origin: center center; transform: var(--scale-elemento); }
```

### Entrada desde la izquierda
```css
@property --slide-in { syntax: "<transform-function>"; inherits: true; initial-value: translateX(-20px); }
#el { transform-box: fill-box; transform: var(--slide-in); opacity: var(--opacity-el); }
```

### Entrada desde abajo
```css
@property --rise-in { syntax: "<transform-function>"; inherits: true; initial-value: translateY(16px); }
#el { transform-box: fill-box; transform: var(--rise-in); opacity: var(--opacity-el); }
```

### Reveal con clip-path (izquierda → derecha, ideal para gráficas)
```css
@property --clip-reveal { syntax: "<percentage>"; inherits: true; initial-value: 100%; }
#el { clip-path: inset(0 var(--clip-reveal) 0 0); }
/* keyframes: 0% → 100%, 100% → 0% */
```

### Reveal circular (clip-path radial)
```css
@property --clip-circle { syntax: "<percentage>"; inherits: true; initial-value: 0%; }
#el { clip-path: circle(var(--clip-circle) at 50% 50%); }
```

### Pulso (heartbeat)
```css
@property --pulso { syntax: "<transform-function>"; inherits: true; initial-value: scale(1); }
/* keyframes: 0% scale(1) → 10% scale(1.3) → 22% scale(0.95) → 32% scale(1.2) → 44% scale(0.95) → 55% scale(1) */
```

### Truco de stacking (dos elementos en el mismo espacio)
```css
.contenedor { display: grid; place-items: center; grid-template-areas: "slot"; }
.elemento-a, .elemento-b { grid-area: slot; }
```

---

## Estructura del output

Siempre dos archivos:

### `index.html`
```html
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Nombre</title>
    <link rel="stylesheet" href="./estilos.css">
</head>
<body>
    <div class="contenedor-animacion">
        <svg ...>
            <g id="frame-bg">
              ...
            </g>
            <g id="dashboard-wrapper">  <!-- wrapper limpio -->
              <g transform="translate(657, 351)">  <!-- transform original -->
                ...
              </g>
            </g>
        </svg>
    </div>
</body>
</html>
```

### `estilos.css`
```css
/* 1. Reset */
* { margin: 0; box-sizing: border-box; }

/* 2. Body centrado */
body { height: 100vh; display: flex; justify-content: center; align-items: center; }

/* 3. @property — una por variable */
@property --var-uno { syntax: "<transform-function>"; inherits: true; initial-value: translateY(16px); }
@property --var-opacity { syntax: "<number>"; inherits: true; initial-value: 0; }

/* 4. Selectores estáticos */
.contenedor-animacion { animation: historia 2s forwards ease-out; }
#wrapper { transform-box: fill-box; transform-origin: center center; transform: var(--var-uno); opacity: var(--var-opacity); }

/* 5. @keyframes */
@keyframes historia {
    0%   { --var-uno: translateY(16px); --var-opacity: 0; }
    100% { --var-uno: translateY(0px);  --var-opacity: 1; }
}
```

---

## Reglas de oro

- **Cero JavaScript**
- **No modificar el SVG** — solo añadir `id` y wrappers `<g>` vacíos cuando sea necesario
- **Un solo `@keyframes`** — toda la historia en un bloque
- **`transform-box: fill-box`** en todo elemento SVG que use transform CSS
- **`forwards`** siempre
- **Wrapper limpio** cuando el grupo ya tiene `transform` attribute
- **Solo opacity** cuando el transform no es necesario (evita conflictos sin wrappers)

---

## Checklist antes de entregar

- [ ] ¿Todos los grupos animados tienen `id`?
- [ ] ¿Los grupos con `transform` attribute existente tienen un wrapper limpio?
- [ ] ¿Todos los selectores que usan transform tienen `transform-box: fill-box`?
- [ ] ¿La animación usa `forwards`?
- [ ] ¿Hay JavaScript en algún lado? (si sí, elimínalo)
- [ ] ¿La historia tiene sentido visual?
