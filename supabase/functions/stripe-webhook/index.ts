// supabase/functions/stripe-webhook/index.ts

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';
import Stripe from 'https://esm.sh/stripe@14.13.0?target=deno';
// Asegúrate que la ruta es correcta para tu estructura
import { corsHeaders } from '../_shared/cors.ts'; // Ajusta si moviste cors.ts

// --- Constantes y Configuración ---
console.log(`[WEBHOOK_DEBUG] Stripe Webhook Function Initializing...`);

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');
const STRIPE_SIGNING_SECRET = Deno.env.get('STRIPE_SIGNING_SECRET');
const APP_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'); // O el nombre que uses
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');

if (!STRIPE_SECRET_KEY || !STRIPE_SIGNING_SECRET || !SUPABASE_URL || !APP_SERVICE_ROLE_KEY) {
  console.error('[WEBHOOK_ERROR] CRITICAL: Missing environment variables. Check STRIPE_SECRET_KEY, STRIPE_SIGNING_SECRET, SUPABASE_SERVICE_ROLE_KEY.');
  // Considera lanzar un error
}

const stripe = new Stripe(STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
});

const cryptoProvider = Stripe.createSubtleCryptoProvider();

const supabaseAdmin = createClient(SUPABASE_URL!, APP_SERVICE_ROLE_KEY!);

console.log('[WEBHOOK_DEBUG] Stripe Webhook Function Initialized successfully.');

// --- Lógica Principal del Servidor ---
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    console.log('[WEBHOOK_DEBUG] Handling OPTIONS preflight request');
    return new Response('ok', { headers: corsHeaders });
  }

  const signature = req.headers.get('Stripe-Signature');
  if (!signature) {
    console.error('[WEBHOOK_ERROR] FAIL: Missing Stripe-Signature header');
    return new Response('Missing Stripe-Signature header', { status: 400 });
  }

  const body = await req.text();

  try {
    // 1. Verifica la firma
    console.log('[WEBHOOK_DEBUG] Verifying webhook signature...');
    const event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      STRIPE_SIGNING_SECRET!,
      undefined,
      cryptoProvider
    );
    console.log(`[WEBHOOK_INFO] Webhook event received: ${event.id}, Type: ${event.type}`);

    // 2. Maneja el evento
    const eventObject = event.data.object as any;
    let supabaseUserId: string | null = null;
    let stripeCustomerId: string | null = null;

    // --- Inicio: Lógica robusta para identificar al usuario ---
    console.log('[WEBHOOK_DEBUG] Attempting to identify user...');
    if (eventObject.customer) {
      stripeCustomerId = eventObject.customer;
      console.log(`[WEBHOOK_DEBUG] Found stripeCustomerId from event object: ${stripeCustomerId}`);
    }

    if (eventObject.metadata?.supabase_user_id) {
      supabaseUserId = eventObject.metadata.supabase_user_id;
      console.log(`[WEBHOOK_DEBUG] Found supabaseUserId from event metadata: ${supabaseUserId}`);
    }
    else if (stripeCustomerId) {
      console.log(`[WEBHOOK_DEBUG] supabaseUserId not in event metadata, trying customer metadata for ${stripeCustomerId}...`);
      try {
        const customer = await stripe.customers.retrieve(stripeCustomerId) as Stripe.Customer;
        if (!customer.deleted && customer.metadata?.supabase_user_id) {
          supabaseUserId = customer.metadata.supabase_user_id;
          console.log(`[WEBHOOK_DEBUG] Found supabaseUserId from customer metadata: ${supabaseUserId}`);
        } else {
          console.log(`[WEBHOOK_DEBUG] supabase_user_id not found in customer metadata or customer deleted.`);
        }
      } catch (customerError) { console.warn(`[WEBHOOK_WARN] Error retrieving customer ${stripeCustomerId}:`, customerError.message); }
    }

    if (!supabaseUserId && stripeCustomerId) {
      console.log(`[WEBHOOK_DEBUG] supabaseUserId not found yet, querying profiles table for customer ${stripeCustomerId}...`);
      try {
        const { data: profile, error: profileError } = await supabaseAdmin
          .from('profiles').select('id').eq('stripe_customer_id', stripeCustomerId).single();
        if (profileError && profileError.code !== 'PGRST116') { // Ignore 'not found' error, log others
          console.error(`[WEBHOOK_ERROR] DB error querying profiles for ${stripeCustomerId}:`, profileError);
        } else if (profile) {
          supabaseUserId = profile.id;
          console.log(`[WEBHOOK_DEBUG] Found supabaseUserId ${supabaseUserId} from profiles table.`);
        } else {
          console.log(`[WEBHOOK_DEBUG] Profile not found for stripe_customer_id ${stripeCustomerId}.`);
        }
      } catch (dbError) {
        console.error(`[WEBHOOK_ERROR] Exception querying profiles table for customer ${stripeCustomerId}:`, dbError.message);
      }
    }

    if (!supabaseUserId && !['customer.subscription.deleted', 'customer.deleted'].includes(event.type)) {
      console.error(`[WEBHOOK_ERROR] CRITICAL FAIL: Could not determine supabase_user_id for event ${event.id} (Type: ${event.type}). Customer: ${stripeCustomerId}. Cannot process update.`);
      return new Response(JSON.stringify({ received: true, error: 'Webhook Error: User identification failed.' }), { status: 200 });
    } else if (supabaseUserId) {
      console.log(`[WEBHOOK_DEBUG] User identified successfully: supabaseUserId=${supabaseUserId}`);
    } else {
      console.log(`[WEBHOOK_DEBUG] Proceeding without supabaseUserId (likely a customer deletion event).`);
    }
    // --- Fin: Lógica robusta para identificar al usuario ---

    // --- Manejadores de Eventos Específicos ---
    switch (event.type) {

      case 'checkout.session.completed': {
        const session = eventObject as Stripe.Checkout.Session;
        console.log(`[WEBHOOK_INFO] Processing checkout.session.completed for session ${session.id}, Mode: ${session.mode}`);

        // --- Suscripción Iniciada ---
        if (session.mode === 'subscription') {
          if (!supabaseUserId) throw new Error(`[WEBHOOK_ERROR] Cannot process subscription checkout ${session.id}: missing supabase_user_id.`);

          const subscriptionId = session.subscription as string;
          console.log(`[WEBHOOK_DEBUG] Retrieving subscription ${subscriptionId}`);
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          
          const status = subscription.status;
          const currentPeriodStart = new Date(subscription.current_period_start * 1000);
          const currentPeriodEnd = new Date(subscription.current_period_end * 1000);
          
          console.log(`[WEBHOOK_INFO] Updating profile for new subscription ${subscription.id} for user ${supabaseUserId}`);
          console.log(`[WEBHOOK_DEBUG] Subscription details: Status=${status}, Period=${currentPeriodStart.toISOString()} to ${currentPeriodEnd.toISOString()}`);
          
          const { error } = await supabaseAdmin
            .from('profiles')
            .update({
              subscription_id: subscription.id, // También mantener este campo si existe en tu esquema
              subscription_status: status === 'active' ? 'active' : status, // Asegurar que sea 'active' para suscripciones activas
              stripe_customer_id: stripeCustomerId,
              period_start_date: currentPeriodStart.toISOString(), // 1. Fecha de inicio del periodo
              current_period_end: currentPeriodEnd.toISOString(), // 4. Fecha de fin del periodo
              voice_credits: 10, // 3. Dar 10 créditos de voz al activar premium
              monthly_voice_generations_used: 0, // Resetear contador mensual
            })
            .eq('id', supabaseUserId);

          if (error) {
            console.error(`[WEBHOOK_ERROR] FAIL: Error updating profile for subscription ${subscription.id}:`, error);
            throw error; // Relanza para el catch general
          } else {
            console.log(`[WEBHOOK_INFO] OK: Profile updated for new subscription ${subscription.id}. User now has premium with 10 voice credits.`);
          }

          // --- Compra Única (Créditos) - CÓDIGO CORREGIDO + DEBUGGING ---
        } else if (session.mode === 'payment') {
          console.log(`[WEBHOOK_DEBUG] Handling checkout.session.completed for one-time payment: ${session.id}`);

          const paymentIntentId = session.payment_intent as string;
          if (!paymentIntentId) {
            console.error(`[WEBHOOK_ERROR] FAIL: Payment Intent ID missing in session ${session.id} for mode=payment.`);
            return new Response(JSON.stringify({ received: true, error: 'Missing payment intent ID' }), { status: 200 });
          }
          console.log(`[WEBHOOK_DEBUG] Found PaymentIntent ID from session: ${paymentIntentId}`);

          let paymentIntent: Stripe.PaymentIntent;
          try {
            console.log(`[WEBHOOK_DEBUG] Retrieving PaymentIntent ${paymentIntentId}...`);
            paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
            console.log(`[WEBHOOK_DEBUG] Retrieved PaymentIntent ${paymentIntent.id}. Status: ${paymentIntent.status}`);
          } catch (piError) {
            console.error(`[WEBHOOK_ERROR] FAIL: Could not retrieve PaymentIntent ${paymentIntentId}:`, piError);
            return new Response(JSON.stringify({ received: true, error: 'Failed to retrieve payment intent' }), { status: 200 });
          }

          // !! LEER METADATA DEL PAYMENT INTENT RECUPERADO !!
          const piMetadata = paymentIntent.metadata; // Objeto metadata completo
          const itemPurchased = piMetadata?.item_purchased;
          const userIdFromMetadata = piMetadata?.supabase_user_id;

          // -------- AÑADIR ESTOS LOGS --------
          console.log(`[WEBHOOK_DEBUG] Retrieved PaymentIntent Metadata: ${JSON.stringify(piMetadata)}`);
          console.log(`[WEBHOOK_DEBUG] Value read for itemPurchased: "${itemPurchased}" (Type: ${typeof itemPurchased})`);
          // -----------------------------------

          // Re-verificar supabaseUserId si no se obtuvo antes
          if (!supabaseUserId && userIdFromMetadata) {
            supabaseUserId = userIdFromMetadata;
            console.log(`[WEBHOOK_DEBUG] supabaseUserId updated from PaymentIntent metadata: ${supabaseUserId}`);
          }

          if (!supabaseUserId) {
            console.error(`[WEBHOOK_ERROR] FAIL: Cannot process payment intent ${paymentIntent.id}: missing supabase_user_id after all checks.`);
            return new Response(JSON.stringify({ received: true, error: 'User identification failed for payment' }), { status: 200 });
          }

          // Comparar con la cadena EXACTA 'voice_credits'
          if (itemPurchased === 'voice_credits') {
            console.log(`[WEBHOOK_DEBUG] Condition 'itemPurchased === "voice_credits"' is TRUE.`);

            if (paymentIntent.status !== 'succeeded') {
              console.warn(`[WEBHOOK_WARN] PaymentIntent ${paymentIntent.id} status is ${paymentIntent.status}, not 'succeeded'. Skipping credit increment.`);
              return new Response(JSON.stringify({ received: true, status: 'payment_not_succeeded' }), { status: 200 });
            }

            // ¡¡¡ VERIFICA ESTE NÚMERO !!!
            const creditsToAdd = 10; // 10 créditos por compra
            console.log(`[WEBHOOK_INFO] Attempting to add ${creditsToAdd} voice credits to user ${supabaseUserId} via RPC.`);

            const { error: creditError } = await supabaseAdmin.rpc('increment_voice_credits', {
              user_uuid: supabaseUserId,
              credits_to_add: creditsToAdd
            });

            if (creditError) {
              console.error(`[WEBHOOK_ERROR] FAIL: Error adding voice credits via RPC for user ${supabaseUserId} from PI ${paymentIntent.id}:`, creditError);
              return new Response(JSON.stringify({ received: true, error: 'Failed to update credits in DB' }), { status: 200 });
            } else {
              console.log(`[WEBHOOK_INFO] OK: Added ${creditsToAdd} voice credits via RPC for user ${supabaseUserId} from PI ${paymentIntent.id}.`);
            }
          } else if (itemPurchased === 'illustrated_story') {
            console.log(`[WEBHOOK_DEBUG] Condition 'itemPurchased === "illustrated_story"' is TRUE.`);

            if (paymentIntent.status !== 'succeeded') {
              console.warn(`[WEBHOOK_WARN] PaymentIntent ${paymentIntent.id} status is ${paymentIntent.status}, not 'succeeded'. Skipping illustrated story generation.`);
              return new Response(JSON.stringify({ received: true, status: 'payment_not_succeeded' }), { status: 200 });
            }

            // Extract story data from metadata (content will be fetched from database)
            const storyId = piMetadata?.story_id;
            const chapterId = piMetadata?.chapter_id;
            const storyTitle = piMetadata?.story_title;
            const _storyAuthor = piMetadata?.story_author; // Prefixed with underscore as it's not used

            if (!storyId || !chapterId || !storyTitle) {
              console.error(`[WEBHOOK_ERROR] FAIL: Missing required story data in metadata for illustrated story generation.`);
              return new Response(JSON.stringify({ received: true, error: 'Missing story data for generation' }), { status: 200 });
            }

            console.log(`[WEBHOOK_INFO] Illustrated story payment processed successfully for user ${supabaseUserId}, story ${storyId}, chapter ${chapterId}`);
            console.log(`[WEBHOOK_INFO] User will be able to generate illustrated story manually on story page.`);
          } else {
            // Este log ahora nos dirá por qué falló la comparación
            console.log(`[WEBHOOK_INFO] Condition 'itemPurchased === "voice_credits"' or 'illustrated_story' is FALSE. Actual value: "${itemPurchased}". No action taken.`);
          }
        }
        break;
      } // Fin case 'checkout.session.completed'

      case 'invoice.paid': {
        const invoice = eventObject as Stripe.Invoice;
        console.log(`[WEBHOOK_INFO] Processing invoice.paid for invoice ${invoice.id}, Billing Reason: ${invoice.billing_reason}`);
        if (!supabaseUserId) throw new Error(`[WEBHOOK_ERROR] Cannot process invoice ${invoice.id}: missing supabase_user_id.`);

        if (invoice.paid && invoice.subscription && invoice.billing_reason === 'subscription_cycle') { // Procesar solo renovaciones aquí
          const subscriptionId = invoice.subscription as string;
          console.log(`[WEBHOOK_DEBUG] Retrieving subscription ${subscriptionId} for renewal.`);
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          console.log('Subscription:', subscription);
          console.log('Periodo actual:', 
            new Date(subscription.current_period_start * 1000).toISOString(),
            '→',
            new Date(subscription.current_period_end   * 1000).toISOString()
          );
          const currentPeriodEnd = new Date(subscription.current_period_end * 1000);

          console.log(`[WEBHOOK_INFO] Resetting monthly usage for user ${supabaseUserId} due to subscription renewal.`);
          const { error } = await supabaseAdmin
            .from('profiles')
            .update({
              subscription_status: subscription.status,
              current_period_end: currentPeriodEnd.toISOString(),
              monthly_voice_generations_used: 0, // Resetear uso mensual
            })
            .eq('id', supabaseUserId);

          if (error) {
            console.error(`[WEBHOOK_ERROR] FAIL: Error updating profile for invoice.paid ${invoice.id}:`, error);
            throw error;
          } else {
            console.log(`[WEBHOOK_INFO] OK: Profile updated (monthly usage reset) for invoice.paid ${invoice.id} (User: ${supabaseUserId}).`);
          }
        } else {
          console.log(`[WEBHOOK_INFO] Invoice ${invoice.id} paid, but not a subscription renewal or already handled.`);
        }
        break;
      } // Fin case 'invoice.paid'

      case 'customer.subscription.updated': {
        const subscription = eventObject as Stripe.Subscription;
        console.log(`[WEBHOOK_INFO] Processing customer.subscription.updated for subscription ${subscription.id}, Status: ${subscription.status}`);
        if (!supabaseUserId) throw new Error(`[WEBHOOK_ERROR] Cannot process subscription update ${subscription.id}: missing supabase_user_id.`);

        const status = subscription.status;
        const currentPeriodEnd = new Date(subscription.current_period_end * 1000);

        const updatePayload: { [key: string]: any } = {
          subscription_status: status,
          current_period_end: currentPeriodEnd.toISOString(),
        };

        if (subscription.cancel_at_period_end) {
          console.log(`[WEBHOOK_INFO] Subscription ${subscription.id} scheduled for cancellation at period end.`);
        }

        console.log(`[WEBHOOK_INFO] Updating profile for customer.subscription.updated ${subscription.id}`);
        const { error } = await supabaseAdmin
          .from('profiles')
          .update(updatePayload)
          .eq('id', supabaseUserId);

        if (error) {
          console.error(`[WEBHOOK_ERROR] FAIL: Error updating profile for customer.subscription.updated ${subscription.id}:`, error);
          throw error;
        } else {
          console.log(`[WEBHOOK_INFO] OK: Profile updated for customer.subscription.updated ${subscription.id}.`);
        }
        break;
      } // Fin case 'customer.subscription.updated'

      case 'customer.subscription.deleted': {
        const subscription = eventObject as Stripe.Subscription;
        console.log(`[WEBHOOK_INFO] Processing customer.subscription.deleted for subscription ${subscription.id}`);

        if (!stripeCustomerId) throw new Error(`[WEBHOOK_ERROR] Cannot process subscription delete ${subscription.id}: missing stripe_customer_id.`);

        console.log(`[WEBHOOK_INFO] Updating profile for customer.subscription.deleted using customer ID ${stripeCustomerId}`);
        const { error } = await supabaseAdmin
          .from('profiles')
          .update({
            subscription_status: 'canceled',
            current_period_end: null,
            monthly_voice_generations_used: 0,
            // voice_credits: 0, // Comentado para conservar créditos comprados
          })
          .eq('stripe_customer_id', stripeCustomerId);

        if (error) {
          console.error(`[WEBHOOK_ERROR] FAIL: Error updating profile for customer.subscription.deleted ${subscription.id}:`, error);
        } else {
          console.log(`[WEBHOOK_INFO] OK: Profile updated for customer.subscription.deleted ${subscription.id}.`);
        }
        break;
      } // Fin case 'customer.subscription.deleted'

      default:
        console.log(`[WEBHOOK_INFO] Unhandled event type: ${event.type}. ID: ${event.id}`);
    }

    // 3. Responde a Stripe
    console.log(`[WEBHOOK_INFO] Webhook processed successfully for event: ${event.id}`);
    return new Response(JSON.stringify({ received: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err) {
    console.error('[WEBHOOK_ERROR] FATAL: Webhook handler error:', err);
    const isSignatureError = err.type === 'StripeSignatureVerificationError';
    const status = isSignatureError ? 400 : 500;
    return new Response(`Webhook Error: ${err.message}`, { status: status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});