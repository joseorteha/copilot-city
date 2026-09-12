# Copilot City

Visualizador arquitectónico 3D que transforma repositorios públicos de GitHub en ciudades explorables.

## Alcance actual

El MVP incluye:

- Entrada de URL y análisis de repositorios públicos mediante GitHub REST API.
- Árbol de archivos normalizado y análisis parcial de imports JavaScript/TypeScript.
- Distritos derivados de carpetas, edificios procedurales derivados de archivos y carreteras derivadas de dependencias.
- Jerarquía visual por tamaño, complejidad y conectividad.
- Ciudad de demostración disponible antes de analizar un repositorio.
- Navegación orbital, selección de edificios e inspector con métricas reales.
- Búsqueda de archivos con enfoque automático de cámara.
- Trazado interactivo de imports entrantes y salientes entre edificios.
- Detección del corazón arquitectónico del repositorio.
- Distritos semánticos, plazas, vegetación y calles internas.
- Construcción progresiva de distritos, carreteras y edificios.
- Modos Mapa y Explorar; el segundo permite caminar con WASD, mirar con el mouse y correr con Shift.
- Capas de estructura, complejidad, actividad, conexiones, prioridad y autoría.
- Historial Git como línea temporal y cambios recientes por edificio.
- Pull Requests abiertas como obras con andamios y colores por tipo de cambio.
- Detección de ciclos de dependencias y recorridos arquitectónicos recomendados.
- Colaboradores reales como habitantes vinculados a sus zonas de trabajo.
- Estado real de GitHub Actions; una ejecución fallida produce lluvia sobre la ciudad.
- Vista previa de código dentro del inspector y comparación entre dos repositorios.
- Exportador de contexto Markdown para IA con resumen, árbol, código, conteo aproximado de tokens y descarga directa.
- Exclusión automática de binarios, builds, dependencias, `.env`, credenciales y llaves privadas.
- Estados completos de carga, error y resultados.

## Sistema visual 2026

- Arquitectura modular con masas escalonadas, alas, aletas, coronas y landmarks propios.
- Fachadas volumétricas con ventanas instanciadas, variación determinista e iluminación interior.
- Materiales PBR compartidos, iluminación de entorno y tone mapping cinematográfico.
- Ambient occlusion, bloom selectivo y viñeta adaptados al rendimiento del equipo.
- Modos Día y Noche analítica.
- Vegetación y alumbrado urbano instanciados.
- Tráfico luminoso derivado de las calles del grafo.
- Escáner arquitectónico al seleccionar un edificio.
- Pull Requests con andamios y grúas animadas.
- Recorrido cinematográfico automático y exportación de fotografía PNG.
- Calidad automática, alta o baja con DPR adaptativo.

Los controles visuales aparecen en la esquina superior derecha después de analizar un repositorio: día/noche, recorrido, fotografía y calidad.

La dirección completa está documentada en [`docs/COPILOT_CITY_DIRECCION_VISUAL_3D_2026.md`](docs/COPILOT_CITY_DIRECCION_VISUAL_3D_2026.md).

## Ejecutar

```bash
npm install
npm run dev
```

Abre `http://localhost:3000`.

Opcionalmente configura `GITHUB_TOKEN` para aumentar el límite de solicitudes y obtener una historia y lista de PR más profundas. Sin token se usa una muestra conservadora y caché temporal.

La exportación Markdown admite hasta 180 archivos textuales y 2.4 millones de caracteres por descarga. Si el repositorio excede esos límites, el propio documento indica que fue truncado.

## Flujo principal

```text
URL de GitHub
    ↓
API /api/analyze
    ↓
árbol + imports
    ↓
modelo urbano
    ↓
CityScene (distritos + carreteras + edificios)
```

La escena de bienvenida usa `lib/city/demo-city.ts`; al terminar un análisis se sustituye por datos reales sin acoplar la capa de GitHub al renderizado 3D.

## Validación

```bash
npm run typecheck
npm run lint
npm run build
npm run visual-check -- http://localhost:3000
```
