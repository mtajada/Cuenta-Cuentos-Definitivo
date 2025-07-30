// supabase/functions/get-checkout-session/index.ts

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';
import Stripe from 'https://esm.sh/stripe@14.13.0?target=deno';
import { corsHeaders } from '../_shared/cors.ts';

console.log(`[GET_CHECKOUT_SESSION_DEBUG] Function get-checkout-session initializing...`);

// Initialize Stripe
const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
if (!stripeSecretKey) {
  console.error("[GET_CHECKOUT_SESSION_ERROR] CRITICAL: STRIPE_SECRET_KEY environment variable is not set.");
  throw new Error("STRIPE_SECRET_KEY environment variable is required");
}
const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
});

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    console.log('[GET_CHECKOUT_SESSION_DEBUG] Handling OPTIONS preflight request');
    return new Response('ok', { headers: corsHeaders });
  }

  console.log(`[GET_CHECKOUT_SESSION_DEBUG] Handling ${req.method} request`);

  try {
    // 1. Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    // 2. Verify authentication
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      console.error('[GET_CHECKOUT_SESSION_ERROR] Authentication error:', userError?.message || 'No user found');
      return new Response(JSON.stringify({ error: 'Usuario no autenticado o inválido.' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    console.log(`[GET_CHECKOUT_SESSION_DEBUG] Authenticated user ID: ${user.id}`);

    // 3. Parse request body
    const requestBody = await req.json();
    const { sessionId } = requestBody;

    if (!sessionId) {
      console.error('[GET_CHECKOUT_SESSION_ERROR] Missing sessionId parameter');
      return new Response(JSON.stringify({ error: 'Session ID is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[GET_CHECKOUT_SESSION_DEBUG] Retrieving session: ${sessionId}`);

    // 4. Retrieve session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['payment_intent', 'customer']
    });

    if (!session) {
      console.error('[GET_CHECKOUT_SESSION_ERROR] Session not found');
      return new Response(JSON.stringify({ error: 'Session not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[GET_CHECKOUT_SESSION_DEBUG] Session retrieved successfully. Status: ${session.status}`);

    // 5. Return session data
    return new Response(JSON.stringify({
      id: session.id,
      status: session.status,
      customer: session.customer,
      metadata: session.metadata,
      payment_status: session.payment_status,
      created: session.created,
      customer_email: session.customer_details?.email
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: unknown) {
    console.error('[GET_CHECKOUT_SESSION_ERROR] Unhandled error in get-checkout-session:', error);
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    return new Response(JSON.stringify({ error: `Error interno del servidor: ${errorMessage}` }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}); 