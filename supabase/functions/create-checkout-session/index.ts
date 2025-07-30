// supabase/functions/create-checkout-session/index.ts

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';
import Stripe from 'https://esm.sh/stripe@14.13.0?target=deno';
import { corsHeaders } from '../_shared/cors.ts'; // Ruta corregida

console.log(`[CREATE_CHECKOUT_DEBUG] Function create-checkout-session initializing...`);

// Inicializa Stripe
const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
if (!stripeSecretKey) {
  console.error("[CREATE_CHECKOUT_ERROR] CRITICAL: STRIPE_SECRET_KEY environment variable is not set.");
  throw new Error("STRIPE_SECRET_KEY environment variable is required");
}
const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
});

// Obtén la URL base
const appBaseUrl = Deno.env.get('APP_BASE_URL');
if (!appBaseUrl) {
  console.error("[CREATE_CHECKOUT_ERROR] APP_BASE_URL environment variable is not set.");
  throw new Error("APP_BASE_URL environment variable is required");
}

serve(async (req: Request) => {
  // Gestiona preflight CORS
  if (req.method === 'OPTIONS') {
    console.log('[CREATE_CHECKOUT_DEBUG] Handling OPTIONS preflight request');
    return new Response('ok', { headers: corsHeaders });
  }

  console.log(`[CREATE_CHECKOUT_DEBUG] Handling ${req.method} request`);

  try {
    // 1. Inicializa cliente Supabase
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    // 2. Verifica autenticación
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      console.error('[CREATE_CHECKOUT_ERROR] Authentication error:', userError?.message || 'No user found');
      return new Response(JSON.stringify({ error: 'Usuario no autenticado o inválido.' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    console.log(`[CREATE_CHECKOUT_DEBUG] Authenticated user ID: ${user.id}`);

    // 3. Parsea el cuerpo y determina el item
    let priceId: string | null = null;
    let mode: 'payment' | 'subscription' = 'payment';
    let finalMetadata = {}; // Usamos un nombre diferente para claridad

    const requestBody = await req.json();
    const item = requestBody.item;
    console.log(`[CREATE_CHECKOUT_DEBUG] Received request to purchase item: "${item}"`);

    if (item === 'premium') {
      priceId = Deno.env.get('PREMIUM_PLAN_PRICE_ID') || null;
      mode = 'subscription';
      finalMetadata = { supabase_user_id: user.id };
      console.log(`[CREATE_CHECKOUT_DEBUG] Mode set to 'subscription'. Metadata for subscription_data: ${JSON.stringify(finalMetadata)}`);
    } else if (item === 'credits') {
      priceId = Deno.env.get('VOICE_CREDITS_PRICE_ID') || null;
      mode = 'payment';
      // !! VERIFICACIÓN CLAVE !!
      finalMetadata = { supabase_user_id: user.id, item_purchased: 'voice_credits' };
      console.log(`[CREATE_CHECKOUT_DEBUG] Mode set to 'payment'. Metadata for payment_intent_data: ${JSON.stringify(finalMetadata)}`);
    } else if (item === 'illustrated_story') {
      priceId = Deno.env.get('ILLUSTRATED_STORY_PRICE_ID') || null;
      mode = 'payment';
      // Metadata for illustrated story purchase (without content to avoid Stripe metadata limit)
      finalMetadata = { 
        supabase_user_id: user.id, 
        item_purchased: 'illustrated_story',
        story_id: requestBody.storyId,
        chapter_id: requestBody.chapterId,
        story_title: requestBody.title,
        story_author: 'TaleMe App'
        // Removed story_content to avoid Stripe metadata 500 character limit
      };
      console.log(`[CREATE_CHECKOUT_DEBUG] Mode set to 'payment' for illustrated story. Metadata: ${JSON.stringify(finalMetadata)}`);
    } else {
      console.error(`[CREATE_CHECKOUT_ERROR] Invalid item requested: ${item}`);
      return new Response(JSON.stringify({ error: 'Artículo solicitado inválido.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!priceId) {
      console.error(`[CREATE_CHECKOUT_ERROR] Stripe Price ID is not configured in env variables for item: ${item}. Check PREMIUM_PLAN_PRICE_ID or VOICE_CREDITS_PRICE_ID.`);
      throw new Error('Error de configuración del servidor: falta el ID de precio.');
    }
    console.log(`[CREATE_CHECKOUT_DEBUG] Resolved Price ID: ${priceId}, Mode: ${mode}`);

    // 4. Busca o crea cliente Stripe
    let stripeCustomerId: string;
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('stripe_customer_id, subscription_status')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      console.error('[CREATE_CHECKOUT_ERROR] Database error fetching profile:', profileError);
      throw new Error('Error al consultar el perfil del usuario.');
    }

    // Validar si ya tiene suscripción activa para premium
    if (item === 'premium' && profile?.subscription_status === 'active') {
      console.log(`[CREATE_CHECKOUT_DEBUG] User ${user.id} already has active subscription`);
      return new Response(JSON.stringify({ error: 'Ya tienes una suscripción premium activa.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (profile?.stripe_customer_id) {
      stripeCustomerId = profile.stripe_customer_id;
      console.log(`[CREATE_CHECKOUT_DEBUG] Found existing Stripe Customer ID: ${stripeCustomerId}`);
    } else {
      console.log(`[CREATE_CHECKOUT_DEBUG] Stripe Customer ID not found for user ${user.id}. Creating new Stripe Customer...`);
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { supabase_user_id: user.id }, // Metadata en el cliente Stripe
      });
      stripeCustomerId = customer.id;
      console.log(`[CREATE_CHECKOUT_DEBUG] Created new Stripe Customer ID: ${stripeCustomerId}. Updating profile...`);

      const { error: updateError } = await supabaseClient
        .from('profiles')
        .update({ stripe_customer_id: stripeCustomerId })
        .eq('id', user.id);

      if (updateError) {
        console.error('[CREATE_CHECKOUT_ERROR] Failed to update profile with Stripe Customer ID:', updateError);
        throw new Error('No se pudo actualizar el perfil del usuario con la información de Stripe.');
      }
      console.log(`[CREATE_CHECKOUT_DEBUG] Profile updated successfully with Stripe Customer ID.`);
    }

    // 6. Prepara y crea la sesión de Stripe Checkout
    console.log(`[CREATE_CHECKOUT_DEBUG] Preparing Stripe Checkout session for Customer ${stripeCustomerId}...`);
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      customer: stripeCustomerId,
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: mode,
      success_url: item === 'illustrated_story' 
        ? `${appBaseUrl}/story/${requestBody.storyId}?payment_success=true&session_id={CHECKOUT_SESSION_ID}&chapter_id=${requestBody.chapterId}`
        : `${appBaseUrl}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appBaseUrl}/payment-cancel`,
      metadata: finalMetadata, // 🔥 CRÍTICO: Metadata en el checkout session
      // Adjunta metadata relevante según el modo
      ...(mode === 'subscription' && {
        subscription_data: { metadata: finalMetadata } // Metadata para suscripciones
      }),
      ...(mode === 'payment' && {
        payment_intent_data: { metadata: finalMetadata } // !! Metadata para pagos únicos (créditos) !!
      }),
    };

    // !! LOG ANTES DE CREAR !!
    console.log(`[CREATE_CHECKOUT_DEBUG] Session parameters being sent to Stripe: ${JSON.stringify(sessionParams)}`);

    const session = await stripe.checkout.sessions.create(sessionParams);
    console.log(`[CREATE_CHECKOUT_DEBUG] Stripe Checkout session created: ${session.id}, URL: ${session.url}`);

    // 7. Devuelve la URL
    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: unknown) {
    console.error('[CREATE_CHECKOUT_ERROR] Unhandled error in create-checkout-session:', error);
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    return new Response(JSON.stringify({ error: `Error interno del servidor: ${errorMessage}` }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});