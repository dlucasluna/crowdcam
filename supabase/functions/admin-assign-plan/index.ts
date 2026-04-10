import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  console.log(`[ADMIN-ASSIGN-PLAN] ${step}${details ? ` - ${JSON.stringify(details)}` : ''}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const token = authHeader.replace("Bearer ", "");

    // Use getClaims for auth
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: claimsData, error: claimsError } = await supabaseClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) throw new Error("Not authenticated");
    const userId = claimsData.claims.sub as string;

    // Check admin role with service role client
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleData) throw new Error("Not authorized - admin role required");

    const { email, action } = await req.json();
    if (!email) throw new Error("Email is required");
    logStep("Request received", { email, action });

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2025-08-27.basil" });
    const priceId = "price_1TKgvHAj2Jw5RGkh6ZW10OzL";

    if (action === "remove") {
      const customers = await stripe.customers.list({ email, limit: 1 });
      if (customers.data.length === 0) throw new Error("No Stripe customer found");

      const subs = await stripe.subscriptions.list({ customer: customers.data[0].id, status: "active", limit: 1 });
      const trialSubs = await stripe.subscriptions.list({ customer: customers.data[0].id, status: "trialing", limit: 1 });
      const allSubs = [...subs.data, ...trialSubs.data];
      if (allSubs.length === 0) throw new Error("No active subscription found");

      await stripe.subscriptions.cancel(allSubs[0].id);
      logStep("Subscription cancelled", { subscriptionId: allSubs[0].id });

      return new Response(JSON.stringify({ success: true, action: "removed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Assign plan
    let customerId: string;
    const customers = await stripe.customers.list({ email, limit: 1 });
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Existing customer found", { customerId });

      const existingSubs = await stripe.subscriptions.list({ customer: customerId, status: "active", limit: 1 });
      const existingTrials = await stripe.subscriptions.list({ customer: customerId, status: "trialing", limit: 1 });
      if (existingSubs.data.length > 0 || existingTrials.data.length > 0) {
        throw new Error("User already has an active subscription");
      }
    } else {
      const customer = await stripe.customers.create({ email });
      customerId = customer.id;
      logStep("Customer created", { customerId });
    }

    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      payment_behavior: "default_incomplete",
      collection_method: "send_invoice",
      days_until_due: 365,
    });
    logStep("Subscription created", { subscriptionId: subscription.id });

    return new Response(JSON.stringify({ success: true, action: "assigned", subscriptionId: subscription.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: msg });
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
