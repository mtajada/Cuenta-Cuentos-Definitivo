import { StoryCharacter } from "../../types";
import { v4 as uuidv4 } from "uuid";

/**
 * Genera un ID único formato UUID, compatible con PostgreSQL
 * Reemplaza la implementación anterior que usaba prefijos personalizados
 */
export const generateId = (prefix: string = "id") => {
  return uuidv4();
};

/**
 * Crea un personaje con valores por defecto y un ID único totalmente nuevo
 */
export const createDefaultCharacter = (): StoryCharacter => {
  const newId = generateId("char");
  console.log(`Creando personaje por defecto con nuevo ID: ${newId}`);
  return {
    id: newId,
    name: "",
    hobbies: [],
    description: "",
    profession: "",
    characterType: "Personalizado", // Valor por defecto para evitar errores de validación
    personality: "",
  }
};
