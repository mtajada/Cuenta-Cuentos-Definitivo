import { StoryCharacter } from "../../types";

// Constantes de validación
export const CHARACTER_LIMITS = {
  MIN_CHARACTERS: 1,
  MAX_CHARACTERS: 4,
  MAX_NAME_LENGTH: 50,
  MIN_NAME_LENGTH: 2,
} as const;

// Tipos para validación
export interface CharacterValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface CharacterSelectionValidationResult extends CharacterValidationResult {
  canSelectMore: boolean;
  selectionCount: number;
}

/**
 * Valida si se puede seleccionar un personaje adicional
 */
export const validateCharacterSelection = (
  currentSelection: StoryCharacter[],
  characterToSelect: StoryCharacter
): CharacterSelectionValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];
  let isValid = true;

  // Verificar límite máximo
  if (currentSelection.length >= CHARACTER_LIMITS.MAX_CHARACTERS) {
    errors.push(`Máximo ${CHARACTER_LIMITS.MAX_CHARACTERS} personajes permitidos`);
    isValid = false;
  }

  // Verificar si el personaje ya está seleccionado
  if (currentSelection.some(char => char.id === characterToSelect.id)) {
    errors.push("Este personaje ya está seleccionado");
    isValid = false;
  }

  // Verificar si el personaje es válido
  const characterValidation = validateCharacter(characterToSelect);
  if (!characterValidation.isValid) {
    errors.push(...characterValidation.errors);
    isValid = false;
  }

  // Advertencia para historias cortas con muchos personajes
  if (currentSelection.length >= 2) {
    warnings.push("Para cuentos cortitos, recomendamos menos personajes para que cada uno brille más");
  }

  return {
    isValid,
    errors,
    warnings,
    canSelectMore: currentSelection.length < CHARACTER_LIMITS.MAX_CHARACTERS - 1,
    selectionCount: currentSelection.length + (isValid ? 1 : 0)
  };
};

/**
 * Valida la selección múltiple de personajes
 */
export const validateMultipleCharacterSelection = (
  characters: StoryCharacter[]
): CharacterSelectionValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];
  let isValid = true;

  // Verificar límites
  if (characters.length < CHARACTER_LIMITS.MIN_CHARACTERS) {
    errors.push(`Debes seleccionar al menos ${CHARACTER_LIMITS.MIN_CHARACTERS} personaje`);
    isValid = false;
  }

  if (characters.length > CHARACTER_LIMITS.MAX_CHARACTERS) {
    errors.push(`Máximo ${CHARACTER_LIMITS.MAX_CHARACTERS} personajes permitidos`);
    isValid = false;
  }

  // Verificar duplicados
  const uniqueIds = new Set(characters.map(char => char.id));
  if (uniqueIds.size !== characters.length) {
    errors.push("No se pueden seleccionar personajes duplicados");
    isValid = false;
  }

  // Validar cada personaje individualmente
  for (const character of characters) {
    const charValidation = validateCharacter(character);
    if (!charValidation.isValid) {
      errors.push(`Personaje "${character.name}": ${charValidation.errors.join(", ")}`);
      isValid = false;
    }
  }

  // Advertencias basadas en el número de personajes
  if (characters.length >= 3) {
    warnings.push("✨ Con 3 o más personajes tu historia será muy rica, pero puede ser un poco más larga");
  } else if (characters.length === 2) {
    warnings.push("✨ ¡Perfecto! Dos personajes crean historias dinámicas y entretenidas");
  }

  return {
    isValid,
    errors,
    warnings,
    canSelectMore: characters.length < CHARACTER_LIMITS.MAX_CHARACTERS,
    selectionCount: characters.length
  };
};

/**
 * Valida un personaje individual
 */
export const validateCharacter = (character: StoryCharacter): CharacterValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];
  let isValid = true;

  // Validar campos requeridos
  if (!character.name || character.name.trim().length === 0) {
    errors.push("El nombre del personaje es obligatorio");
    isValid = false;
  } else {
    // Validar longitud del nombre
    if (character.name.length < CHARACTER_LIMITS.MIN_NAME_LENGTH) {
      errors.push(`El nombre debe tener al menos ${CHARACTER_LIMITS.MIN_NAME_LENGTH} caracteres`);
      isValid = false;
    }
    if (character.name.length > CHARACTER_LIMITS.MAX_NAME_LENGTH) {
      errors.push(`El nombre no puede tener más de ${CHARACTER_LIMITS.MAX_NAME_LENGTH} caracteres`);
      isValid = false;
    }
  }

  if (!character.profession || character.profession.trim().length === 0) {
    errors.push("La profesión del personaje es obligatoria");
    isValid = false;
  }

  if (!character.characterType || character.characterType.trim().length === 0) {
    errors.push("El tipo de personaje es obligatorio");
    isValid = false;
  }

  if (!character.hobbies || character.hobbies.length === 0) {
    warnings.push("Sería genial añadir algunos hobbies para hacer el personaje más interesante");
  }

  if (!character.personality || character.personality.trim().length === 0) {
    warnings.push("Una personalidad definida hará que el personaje sea más memorable");
  }

  return {
    isValid,
    errors,
    warnings
  };
};

/**
 * Obtiene el mensaje recomendado según el número de personajes seleccionados
 */
export const getCharacterSelectionMessage = (count: number): string => {
  switch (count) {
    case 0:
      return "✨ ¡Selecciona hasta 4 personajes para tu historia!";
    case 1:
      return "✨ ¡Genial! Puedes añadir hasta 3 personajes más si quieres";
    case 2:
      return "✨ ¡Perfecto! Esta combinación creará una historia muy dinámica";
    case 3:
      return "✨ ¡Increíble! Tu historia será muy rica con estos 3 personajes";
    case 4:
      return "✨ ¡Máximo alcanzado! Estos 4 personajes crearán una historia épica";
    default:
      return "✨ Para cuentos cortitos, recomendamos menos personajes para que cada uno brille más";
  }
};

/**
 * Valida si se puede generar una historia con los personajes seleccionados
 */
export const validateStoryGeneration = (characters: StoryCharacter[]): CharacterValidationResult => {
  if (characters.length === 0) {
    return {
      isValid: false,
      errors: ["Debes seleccionar al menos un personaje para generar la historia"],
      warnings: []
    };
  }

  // Usar la validación múltiple
  const validation = validateMultipleCharacterSelection(characters);

  return {
    isValid: validation.isValid,
    errors: validation.errors,
    warnings: validation.warnings
  };
};