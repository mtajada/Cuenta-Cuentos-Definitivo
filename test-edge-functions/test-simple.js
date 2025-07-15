#!/usr/bin/env deno run --allow-env --allow-net --allow-read --allow-run
// test-simple.js - Script simplificado para testear Edge Functions

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';
import {
  multipleCharactersPayload,
  // singleCharacterPayload removed
  mockStory,
  mockChapters,
  optionContinuationPayload,
  freeContinuationPayload,
  directedContinuationPayload,
  createHeaders,
  validateStoryResponse,
  validateContinuationOptionsResponse,
  analyzeCharacterPresence,
  testCharacters
} from './test-data.js';

// Variables de entorno
const SUPABASE_URL = "https://vljseinehlxrvlghxcyk.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZsanNlaW5laGx4cnZsZ2h4Y3lrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUzMTc2MTQsImV4cCI6MjA2MDg5MzYxNH0.n-JRSlefofQkWdBKFKZ6uLV7kaZ1IsJmR-ytysQCFmg";
const SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZsanNlaW5laGx4cnZsZ2h4Y3lrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTMxNzYxNCwiZXhwIjoyMDYwODkzNjE0fQ.ZVOnRDiDs5OgoVTQT7_KaCexeT2ZpmX4ANBRtBb9OoE";
const GEMINI_API_KEY = "AIzaSyDTy4EX8f-GNIJJi1mSr5qHKtIgmPTtNYA";

// Datos de usuario real
const TEST_USER_EMAIL = "4zgz2000@gmail.com";
const TEST_USER_PASSWORD = "mtf2000";

// Cliente Supabase para autenticación
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Colores para output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

const log = {
  info: (msg) => console.log(`${colors.blue}ℹ️  ${msg}${colors.reset}`),
  success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
  warning: (msg) => console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
  header: (msg) => console.log(`\n${colors.bright}${colors.cyan}🚀 ${msg}${colors.reset}\n`),
  separator: () => console.log(`${colors.cyan}${'='.repeat(80)}${colors.reset}`)
};

// Función para crear token de usuario test
async function createTestUserToken() {
  log.info('Obteniendo token de usuario test...');
  
  try {
    // Usuario real de la aplicación
    const testUsers = [
      { email: TEST_USER_EMAIL, password: TEST_USER_PASSWORD }
    ];

    for (const testUser of testUsers) {
      log.info(`Intentando autenticación con: ${testUser.email}`);
      
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: testUser.email,
        password: testUser.password,
      });

      if (!signInError && signInData.session?.access_token) {
        log.success(`Token obtenido exitosamente para: ${testUser.email}`);
        return signInData.session.access_token;
      } else {
        log.warning(`Sign in falló para ${testUser.email}: ${signInError?.message}`);
      }
    }

    // Si todos los sign in fallan, intentar crear un usuario con timestamp para evitar rate limits
    const uniqueEmail = `testuser${Date.now() % 10000}@temp.com`;
    log.info(`Intentando crear nuevo usuario: ${uniqueEmail}`);
    
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: uniqueEmail,
      password: TEST_USER_PASSWORD,
    });

    if (signUpError) {
      // Si falla la creación, usamos el Service Role Key como fallback
      log.warning(`Creación de usuario falló: ${signUpError.message}`);
      log.warning('Usando Service Role Key como fallback para testing...');
      return SUPABASE_SERVICE_ROLE_KEY;
    }

    if (!signUpData.session?.access_token) {
      log.warning('No se pudo obtener token de sesión, usando Service Role Key...');
      return SUPABASE_SERVICE_ROLE_KEY;
    }

    log.success(`Token obtenido para nuevo usuario: ${uniqueEmail}`);
    return signUpData.session.access_token;

  } catch (error) {
    log.warning(`Error en autenticación: ${error.message}`);
    log.warning('Usando Service Role Key como fallback...');
    return SUPABASE_SERVICE_ROLE_KEY;
  }
}

// Función para hacer request a Edge Function
async function callEdgeFunction(functionName, payload, userToken, verbose = false) {
  const url = `${SUPABASE_URL}/functions/v1/${functionName}`;
  
  // Si el token es el Service Role Key, usar configuración diferente
  const isServiceRoleKey = userToken === SUPABASE_SERVICE_ROLE_KEY;
  const headers = {
    'Authorization': `Bearer ${userToken}`,
    'Content-Type': 'application/json',
    'apikey': isServiceRoleKey ? SUPABASE_SERVICE_ROLE_KEY : SUPABASE_ANON_KEY
  };
  
  if (verbose) {
    log.info(`🌐 URL: ${url}`);
    log.info(`📤 Payload completo: ${JSON.stringify(payload, null, 2)}`);
    log.info(`🔐 Headers: ${JSON.stringify(headers, null, 2)}`);
  } else {
    // Mostrar siempre información clave del payload
    console.log(`\n${colors.bright}📤 Payload enviado:${colors.reset}`);
    console.log(`   Language: ${payload.language}`);
    console.log(`   Child Age: ${payload.childAge}`);
    console.log(`   Genre: ${payload.options?.genre}`);
    console.log(`   Duration: ${payload.options?.duration}`);
    console.log(`   Moral: ${payload.options?.moral}`);
    
    if (payload.options?.characters) {
      console.log(`   Multiple Characters (${payload.options.characters.length}):`);
      payload.options.characters.forEach((char, i) => {
        console.log(`     ${i + 1}. ${char.name} (${char.profession}) - ${char.personality}`);
        console.log(`        Hobbies: ${char.hobbies.join(', ')}`);
      });
    }
    
    if (payload.options?.character) {
      console.log(`   Single Character: ${payload.options.character.name} (${payload.options.character.profession})`);
    }
    
    if (payload.additionalDetails) {
      console.log(`   Additional Details: ${payload.additionalDetails}`);
    }
    console.log('');
  }
  
  const startTime = Date.now();
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });
    
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    
    const data = await response.json();
    
    // Logging de respuesta
    if (verbose) {
      log.info(`📥 Respuesta completa: ${JSON.stringify(data, null, 2)}`);
    } else {
      console.log(`\n${colors.bright}📥 Respuesta recibida:${colors.reset}`);
      console.log(`   Título: ${data.title || 'N/A'}`);
      console.log(`   Contenido (primeras 200 chars): ${(data.content || 'N/A').substring(0, 200)}...`);
      if (data.options) {
        console.log(`   Opciones: ${data.options.length || 0}`);
      }
      console.log('');
    }
    
    return {
      success: true,
      data,
      responseTime,
      status: response.status
    };
    
  } catch (error) {
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    return {
      success: false,
      error: error.message,
      responseTime,
      status: null
    };
  }
}

// Test 1: Generación de historia con múltiples personajes
async function testMultipleCharacters(userToken, verbose = false) {
  log.header('Test 1: Generación con 3 Personajes');
  
  log.info(`Personajes: ${testCharacters.map(c => `${c.name} (${c.profession})`).join(', ')}`);
  
  const result = await callEdgeFunction('generate-story', multipleCharactersPayload, userToken, verbose);
  
  if (!result.success) {
    log.error(`Error: ${result.error}`);
    return null;
  }
  
  log.success(`✅ Historia generada en ${result.responseTime}ms`);
  
  // Validar estructura
  const validation = validateStoryResponse(result.data);
  if (!validation.isValid) {
    log.error(`Validación fallida: ${validation.errors.join(', ')}`);
    return null;
  }
  
  // Análisis de personajes
  const characterAnalysis = analyzeCharacterPresence(result.data.content, testCharacters);
  
  console.log(`\n${colors.bright}📊 Análisis de Personajes:${colors.reset}`);
  Object.entries(characterAnalysis).forEach(([name, analysis]) => {
    const status = analysis.mentions > 0 ? '✅' : '❌';
    console.log(`  ${status} ${name}: ${analysis.mentions} menciones`);
  });
  
  console.log(`\n${colors.bright}📖 Historia:${colors.reset}`);
  console.log(`${colors.bright}Título:${colors.reset} ${result.data.title}`);
  console.log(`\n${colors.bright}Contenido:${colors.reset}`);
  console.log(result.data.content);
  
  return result.data;
}

// testSingleCharacter removed - now using unified multiple character system

// Test 3: Opciones de continuación
async function testContinuationOptions(userToken, verbose = false) {
  log.header('Test 3: Opciones de Continuación');
  
  const payload = {
    action: 'generateOptions',
    story: mockStory,
    chapters: mockChapters,
    language: 'es',
    childAge: 7
  };
  
  const result = await callEdgeFunction('story-continuation', payload, userToken, verbose);
  
  if (!result.success) {
    log.error(`Error: ${result.error}`);
    return null;
  }
  
  log.success(`✅ Opciones generadas en ${result.responseTime}ms`);
  
  const validation = validateContinuationOptionsResponse(result.data);
  if (!validation.isValid) {
    log.error(`Validación fallida: ${validation.errors.join(', ')}`);
    return null;
  }
  
  console.log(`\n${colors.bright}🎯 Opciones:${colors.reset}`);
  result.data.options.forEach((option, index) => {
    console.log(`  ${index + 1}. ${option.summary}`);
  });
  
  return result.data;
}

// Test 4: Continuación con opción seleccionada
async function testOptionContinuation(userToken, verbose = false) {
  log.header('Test 4: Continuación con Opción Seleccionada');
  
  const result = await callEdgeFunction('story-continuation', optionContinuationPayload, userToken, verbose);
  
  if (!result.success) {
    log.error(`Error: ${result.error}`);
    return null;
  }
  
  log.success(`✅ Capítulo generado en ${result.responseTime}ms`);
  
  const validation = validateStoryResponse(result.data);
  if (!validation.isValid) {
    log.error(`Validación fallida: ${validation.errors.join(', ')}`);
    return null;
  }
  
  // Análisis de personajes en el capítulo generado
  const characterAnalysis = analyzeCharacterPresence(result.data.content, testCharacters);
  const charactersPresent = Object.values(characterAnalysis).filter(a => a.mentions > 0).length;
  
  console.log(`\n${colors.bright}📊 Análisis de Personajes en Capítulo:${colors.reset}`);
  Object.entries(characterAnalysis).forEach(([name, analysis]) => {
    const status = analysis.mentions > 0 ? '✅' : '❌';
    console.log(`  ${status} ${name}: ${analysis.mentions} menciones`);
  });
  
  console.log(`\n${colors.bright}📖 Capítulo Generado:${colors.reset}`);
  console.log(`${colors.bright}Título:${colors.reset} ${result.data.title}`);
  console.log(`\n${colors.bright}Contenido:${colors.reset}`);
  console.log(result.data.content);
  
  if (charactersPresent >= 2) {
    log.success(`Consistencia de personajes mantenida (${charactersPresent}/3 personajes presentes)`);
  } else {
    log.warning(`Algunos personajes podrían haberse perdido (${charactersPresent}/3 presentes)`);
  }
  
  return result.data;
}

// Test 5: Continuación libre
async function testFreeContinuation(userToken, verbose = false) {
  log.header('Test 5: Continuación Libre');
  
  const result = await callEdgeFunction('story-continuation', freeContinuationPayload, userToken, verbose);
  
  if (!result.success) {
    log.error(`Error: ${result.error}`);
    return null;
  }
  
  log.success(`✅ Capítulo libre generado en ${result.responseTime}ms`);
  
  const validation = validateStoryResponse(result.data);
  if (!validation.isValid) {
    log.error(`Validación fallida: ${validation.errors.join(', ')}`);
    return null;
  }
  
  // Análisis de personajes
  const characterAnalysis = analyzeCharacterPresence(result.data.content, testCharacters);
  const charactersPresent = Object.values(characterAnalysis).filter(a => a.mentions > 0).length;
  
  console.log(`\n${colors.bright}📊 Análisis de Personajes:${colors.reset}`);
  Object.entries(characterAnalysis).forEach(([name, analysis]) => {
    const status = analysis.mentions > 0 ? '✅' : '❌';
    console.log(`  ${status} ${name}: ${analysis.mentions} menciones`);
  });
  
  console.log(`\n${colors.bright}📖 Continuación Libre:${colors.reset}`);
  console.log(`${colors.bright}Título:${colors.reset} ${result.data.title}`);
  console.log(`\n${colors.bright}Contenido (primeras 400 chars):${colors.reset}`);
  console.log(result.data.content.substring(0, 400) + '...');
  
  return result.data;
}

// Test 6: Continuación dirigida
async function testDirectedContinuation(userToken, verbose = false) {
  log.header('Test 6: Continuación Dirigida');
  
  log.info(`Dirección: "${directedContinuationPayload.userDirection}"`);
  
  const result = await callEdgeFunction('story-continuation', directedContinuationPayload, userToken, verbose);
  
  if (!result.success) {
    log.error(`Error: ${result.error}`);
    return null;
  }
  
  log.success(`✅ Capítulo dirigido generado en ${result.responseTime}ms`);
  
  const validation = validateStoryResponse(result.data);
  if (!validation.isValid) {
    log.error(`Validación fallida: ${validation.errors.join(', ')}`);
    return null;
  }
  
  // Análisis de personajes
  const characterAnalysis = analyzeCharacterPresence(result.data.content, testCharacters);
  const charactersPresent = Object.values(characterAnalysis).filter(a => a.mentions > 0).length;
  
  console.log(`\n${colors.bright}📊 Análisis de Personajes:${colors.reset}`);
  Object.entries(characterAnalysis).forEach(([name, analysis]) => {
    const status = analysis.mentions > 0 ? '✅' : '❌';
    console.log(`  ${status} ${name}: ${analysis.mentions} menciones`);
  });
  
  console.log(`\n${colors.bright}📖 Continuación Dirigida:${colors.reset}`);
  console.log(`${colors.bright}Título:${colors.reset} ${result.data.title}`);
  console.log(`\n${colors.bright}Contenido (primeras 400 chars):${colors.reset}`);
  console.log(result.data.content.substring(0, 400) + '...');
  
  return result.data;
}

// Función principal
async function main() {
  const args = Deno.args;
  const verbose = args.includes('--verbose') || args.includes('-v');
  const testType = args[0];
  
  log.separator();
  console.log(`${colors.bright}${colors.magenta}🧪 Test Edge Functions TaleMe${colors.reset}`);
  log.separator();
  
  try {
    // Crear token de usuario test
    const userToken = await createTestUserToken();
    log.separator();
    
    // Story Generation Tests
    if (testType === 'multiple' || !testType) {
      await testMultipleCharacters(userToken, verbose);
      log.separator();
    }
    
    // single character test removed - unified system handles 1-4 characters
    
    // Story Continuation Tests
    if (testType === 'continue' || testType === 'continue-options' || !testType) {
      await testContinuationOptions(userToken, verbose);
      log.separator();
    }
    
    if (testType === 'continue-selected') {
      await testOptionContinuation(userToken, verbose);
      log.separator();
    }
    
    if (testType === 'continue-free') {
      await testFreeContinuation(userToken, verbose);
      log.separator();
    }
    
    if (testType === 'continue-directed') {
      await testDirectedContinuation(userToken, verbose);
      log.separator();
    }
    
    if (testType === 'continue-all') {
      await testContinuationOptions(userToken, verbose);
      log.separator();
      await testOptionContinuation(userToken, verbose);
      log.separator();
      await testFreeContinuation(userToken, verbose);
      log.separator();
      await testDirectedContinuation(userToken, verbose);
      log.separator();
    }
    
    log.success('🎉 Tests completados!');
    
  } catch (error) {
    log.error(`Error: ${error.message}`);
    if (verbose) {
      console.error(error.stack);
    }
    Deno.exit(1);
  }
}

// Ayuda
if (Deno.args.includes('--help') || Deno.args.includes('-h')) {
  console.log(`
${colors.bright}🧪 Test Edge Functions TaleMe${colors.reset}

${colors.bright}Uso:${colors.reset}
  deno run --allow-env --allow-net test-simple.js [tipo] [opciones]

${colors.bright}📖 Story Generation:${colors.reset}
  multiple              Test múltiples personajes (3 personajes)
  // single command removed - unified system handles 1-4 characters

${colors.bright}📚 Story Continuation:${colors.reset}
  continue              Generar opciones de continuación (legacy)
  continue-options      Generar opciones de continuación
  continue-selected     Continuar con opción seleccionada
  continue-free         Continuación libre
  continue-directed     Continuación dirigida por usuario
  continue-all          Todos los tests de continuación

${colors.bright}🔍 Tests Completos:${colors.reset}
  (vacío)               Todos los tests básicos
  
${colors.bright}Opciones:${colors.reset}
  --verbose, -v         Output completo con payloads y respuestas
  --help, -h            Esta ayuda

${colors.bright}🔧 Debugging - Para diagnosticar problemas:${colors.reset}
  deno run --allow-env --allow-net test-simple.js multiple --verbose
  deno run --allow-env --allow-net test-simple.js continue-selected --verbose
  
  Esto muestra:
  • Payload completo enviado a la Edge Function
  • Headers de autenticación
  • Respuesta completa del modelo de lenguaje
  • Análisis detallado de personajes

${colors.bright}📋 Ejemplos por Funcionalidad:${colors.reset}

  ${colors.bright}Story Generation:${colors.reset}
  deno run --allow-env --allow-net test-simple.js multiple
  deno run --allow-env --allow-net test-simple.js multiple --verbose

  ${colors.bright}Story Continuation:${colors.reset}
  deno run --allow-env --allow-net test-simple.js continue-options
  deno run --allow-env --allow-net test-simple.js continue-selected
  deno run --allow-env --allow-net test-simple.js continue-all --verbose

  ${colors.bright}Testing Completo:${colors.reset}
  deno run --allow-env --allow-net test-simple.js
`);
  Deno.exit(0);
}

if (import.meta.main) {
  main();
}