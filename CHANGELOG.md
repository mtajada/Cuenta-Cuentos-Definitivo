# Changelog
Todos los cambios notables en este proyecto serán documentados en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/),
y este proyecto adhiere a [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.5] - 2025-12-08

### Añadido
- **Selección de modo e ilustración**: Nuevo paso para elegir entre cuento estándar o con imágenes, incluyendo cuadrícula de estilos validados.

### Mejoras
- **Propagación de estilo**: El `imageStyle` se persiste en `stories.image_style` y viaja a generación de escenas, imágenes (Gemini/OpenAI) y PDFs ilustrados.
- **Contrato de Edge Functions**: `generate-story`, `generate-scenes-from-content` y `generate-image` aceptan `imageStyle/styleId` y mapean automáticamente a `style: vivid|natural` según el catálogo.

## [1.1.4] - 2025-01-12

### Añadido
- **Sistema de generación de imágenes**: Implementación completa de generación de imágenes para cuentos usando OpenAI DALL-E 3
- **Edge Function para imágenes**: Nueva función para procesar y almacenar imágenes generadas
- **Botón de prueba en StoryViewer**: Botón "Generar Imágenes" para testear el sistema de generación
- **Soporte para múltiples formatos**: Manejo tanto de URLs como datos base64 para máxima flexibilidad

### Mejoras
- **Generación asíncrona**: Las 4 imágenes (portada, 2 escenas, personaje) se generan simultáneamente para mayor velocidad
- **Prompts optimizados**: Uso de prompts con contexto específico para cada tipo de imagen
- **Estructura de almacenamiento**: Organización clara
- **Manejo de errores robusto**: Procesamiento independiente de cada imagen con recolección de errores específicos
- **Logging detallado**: Trazabilidad completa del proceso de generación y subida

### Cambios Técnicos
- Integración del SDK oficial de OpenAI
- Edge Function con validación dual (URL/base64) y conversión eficiente
- TypeScript estricto con interfaces específicas para opciones y resultados

### Infraestructura
- **Bucket de almacenamiento**: Configuración para almacenar las imágenes

## [1.1.3] - 2025-06-03

### Mejoras
- **Sistema de alertas mejorado**: Implementación de `toastManager` para evitar alertas duplicadas y mejorar la experiencia del usuario
- **Generación de párrafos optimizada**: Nuevo método `parseTextToParagraphs` que elimina espacios vacíos y mejora el formato de las historias
- **Manejo de errores en generación de audio**: Mensajes específicos para límites de créditos (Error 429) y otros errores HTTP
- **Experiencia de usuario en botones**: Implementación de botones "disabled" con feedback visual pero permitiendo mostrar información sobre limitaciones
- **Actualización de prompts y lógica**: Se reforzó la instrucción ortotipográfica para títulos de capítulos en estilo 'Sentence case' en los prompts de generación y continuación de historias

### Cambios Técnicos
- Modificaciones en los archivos de lógica de challenge, generate-story y story-continuation
- Ajuste en la longitud de historia en `supabase/functions/story-continuation/prompt.ts` para mayor flexibilidad
- Eliminación de archivos README desactualizados
- Aplicación de principios SOLID y Clean Code en utilidades y manejo de estado
- Implementación de TypeScript estricto en manejo de errores

### Correcciones
- **Alertas duplicadas**: Solucionado el problema de múltiples toasts al cambiar voces o capítulos en el reproductor de audio
- **Espaciado de párrafos**: Eliminación de espacios innecesarios generados por el split de contenido
- **Manejo de errores específicos**: Mensajes claros para diferentes tipos de errores en la generación de audio

## [1.1.2] - 2025-05-10

### Mejoras
- Mejoras en la generación de las historias
- Mejoras en la generación de los audios
- Preview de los personajes
- Mejoras en la personalidad y tono de los personajes y sus narraciones
- Footer global y visualización de la versión de la aplicación

### Correcciones
- Fix al momento de generar una historia y sus capítulos
- Resolución de bugs generales

## [1.1.1] - 2025-04-25

### Mejoras
- Implementación del sistema de audio en las historias
- Mejoras en la UI de la aplicación

### Correcciones
- Corrección de errores en la autenticación
- Mejoras en la estabilidad de la aplicación

## [1.1.0] - 2025-04-23

### Añadido
- Sistema de narración por voz
- Páginas para la selección de personajes
- Sistema de pago y suscripciones

### Mejoras
- Rediseño de la interfaz de usuario
- Optimización del rendimiento en dispositivos móviles

## [1.0.0] - 2025-04-15

### Añadido
- Versión inicial de TaleMe
- Generación de historias personalizadas
- Sistema de usuarios y autenticación
- Interfaz básica para la generación de cuentos
