export type ProfileSettings = {
  // --- DATOS PRINCIPALES ---
  // Muestra estos campos en gris oscuro (#222) sobre fondo claro para máxima legibilidad
  language: string; // Idioma preferido del usuario
  childAge: number; // Edad del niño/a
  specialNeed?: string | null; // Necesidad especial (si aplica)

  // --- CAMPOS DE STRIPE ---
  // Datos sensibles, mostrar en gris oscuro o azul claro solo si es info secundaria
  stripe_customer_id?: string | null;
  subscription_status?: string | null; // Estado de la suscripción (destacar si es "activa" o "cancelada")
  subscription_id?: string | null;
  plan_id?: string | null;
  current_period_end?: string | null; // Fecha de renovación, mostrar en gris oscuro o azul claro

  // --- LÍMITES Y CRÉDITOS ---
  // Mostrar estos campos en tarjetas con fondo blanco translúcido y texto destacado:
  // - Números/acento: color de la paleta (ej. rosa #F6A5B7 para "8 / 10")
  // - Texto principal: gris oscuro (#222)
  // - Descripciones: azul claro (#7DC4E0)
  voice_credits?: number | null; // Créditos de voz restantes
  monthly_stories_generated?: number | null; // Historias generadas este mes
  period_start_date?: string | null;
  monthly_voice_generations_used?: number | null; // Usos de voz este mes

  // --- OTROS ---
  has_completed_setup: boolean; // Mostrar como check visual, icono en color de la paleta
};

export type StoryDuration = 'short' | 'medium' | 'long';

export type StoryCharacter = {
  id: string;
  name: string;
  hobbies: string[];
  description: string;
  profession: string;
  characterType: string;
  personality?: string;
}

export type PartialStoryCharacter = {
  id: string;
  name?: string;
  hobbies?: string[];
  description?: string;
  profession?: string;
  characterType?: string;
  personality?: string;
}

export type StoryOptions = {
  moral: string;
  characters: StoryCharacter[];  // Unified: array de personajes (1-4)
  genre: string;
  duration: StoryDuration;
  language?: string;
  userProvidedContext?: string;
}

export type Story = {
  id: string;
  title: string;
  content: string;
  audioUrl?: string;
  options: StoryOptions;
  createdAt: string;
  additional_details?: string | null;
}

export type User = {
  email: string;
  id: string;
}

export type HobbyOption = {
  id: string;
  name: string;
  icon: React.ReactNode;
}

export type ChallengeCategory = 'language' | 'math' | 'comprehension';

export type ChallengeQuestion = {
  id: string;
  question: string;
  options: string[];
  correctOptionIndex: number;
  explanation: string;
  category: ChallengeCategory;
  targetLanguage?: string; // Only for language challenges
};

export type Challenge = {
  id: string;
  storyId: string;
  questions: ChallengeQuestion[];
  createdAt: string;
};

export type StoryChapter = {
  id: string;
  chapterNumber: number;
  title: string;
  content: string;
  createdAt: string;
  generationMethod?: 'free' | 'option1' | 'option2' | 'option3' | 'custom';
  customInput?: string; // Only if generationMethod is 'custom'
};

export type StoryWithChapters = {
  id: string;
  title: string;
  content: string;
  audioUrl?: string;
  options: StoryOptions;
  createdAt: string;
  additional_details?: string | null;
  chapters: StoryChapter[];
  hasMultipleChapters?: boolean;
  chaptersCount?: number;
};

export type PresetSuggestion = {
  id: number; // Supabase bigint maps to number in JS/TS if not excessively large
  text_prompt: string;
};
