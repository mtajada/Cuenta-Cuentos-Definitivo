export const SYSTEM_PROMPT_BASE = `Quiero generar seis imágenes a partir de el siguiente cuento que posea las siguientes caráterísticas: **Estilo de la imagen, artístico en acuarela**: La idea es que el diseño de las imágenes parezcan hechas a mano, pintadas en acuarela o creyón, para mantener un estilo de dibujo de cuento tradicional. **Deben mantener el mismo estilos las imágenes**: Se debe mantener una concordancia en las imagenes generadas, con el fin de que mantenga una linea histórica del cuento. **Contenido del cuento para la idea**: Tomaremos el contenido del cuento para crear seis imágenes: una imagen para la "PORTADA", cuatro imágenes de las ESCENAS mas importantes del cuento, y una imagen de CIERRE mostrando al/los personaje(s) de espaldas caminando hacia el horizonte con la misma estética y que siga la misma línea del personaje principal.`

export const IMAGES_TYPE = {
    COVER: "cover",
    SCENE_1: "scene_1",
    SCENE_2: "scene_2",
    SCENE_3: "scene_3",
    SCENE_4: "scene_4",
    CLOSING: "closing",
    CHARACTER: "character",
}
