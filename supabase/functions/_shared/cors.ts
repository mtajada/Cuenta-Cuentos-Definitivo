// supabase/functions/_shared/cors.ts

export const corsHeaders = {
  // Allow all origins for development (specifically including localhost)
  'Access-Control-Allow-Origin': '*',
  
  // Allow all necessary headers including custom ones
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-requested-with, accept, origin, referer, user-agent, access-control-allow-origin',
  
  // Allow all HTTP methods
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH, HEAD',
  
  // Cache preflight for shorter time during development
  'Access-Control-Max-Age': '3600',
  
  // Expose headers that might be needed
  'Access-Control-Expose-Headers': 'content-length, content-type, authorization',
  
  // Vary header to handle different request origins
  'Vary': 'Origin, Access-Control-Request-Method, Access-Control-Request-Headers',
};

/**
 * Get CORS headers with dynamic origin support for development
 */
export const getCorsHeaders = (request?: Request) => {
  const origin = request?.headers.get('origin');
  
  // Allow localhost and common development domains
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001', 
    'http://localhost:8080',
    'http://localhost:8888',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:8080',
    'http://127.0.0.1:8888'
  ];
  
  const isAllowedOrigin = origin && (
    allowedOrigins.includes(origin) || 
    origin.includes('localhost') ||
    origin.includes('127.0.0.1')
  );
  
  return {
    ...corsHeaders,
    'Access-Control-Allow-Origin': isAllowedOrigin ? origin : '*',
    'Access-Control-Allow-Credentials': isAllowedOrigin ? 'true' : 'false',
  };
};