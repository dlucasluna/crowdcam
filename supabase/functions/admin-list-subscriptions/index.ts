import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    // Verify auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !userData.user) throw new Error("Not authenticated");

    // Check admin role
    const { data: roleData } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) throw new Error("Not authorized - admin role required");

    // Get all profiles
    const { data: profiles } = await supabaseClient.from("profiles").select("user_id, display_name");

    // Get all user emails from auth
    const { data: { users } } = await supabaseClient.auth.admin.listUsers({ perPage: 1000 });

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2025-08-27.basil" });

    // Get all active/trialing subscriptions
    const activeSubs = await stripe.subscriptions.list({ status: "active", limit: 100 });
    const trialingSubs = await stripe.subscriptions.list({ status: "trialing", limit: 100 });
    const allSubs = [...activeSubs.data, ...trialingSubs.data];

    // Map customer IDs to subscriptions
    const customerSubMap = new Map<string, any>();
    for (const sub of allSubs) {
      const custId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
      customerSubMap.set(custId, sub);
    }

    // Get customer emails
    const customerIds = Array.from(customerSubMap.keys());
    const customerEmailMap = new Map<string, string>();
    for (const cid of customerIds) {
      const cust = await stripe.customers.retrieve(cid);
      if (!cust.deleted && cust.email) {
        customerEmailMap.set(cust.email, cid);
      }
    }

    // Build result per user email
    const subscriptions = (users || []).map((u) => {
      const email = u.email || "";
      const custId = customerEmailMap.get(email);
      const sub = custId ? customerSubMap.get(custId) : null;

      return {
        email,
        display_name: profiles?.find((p) => p.user_id === u.id)?.display_name || email,
        subscribed: !!sub,
        status: sub?.status || null,
        subscription_end: sub ? new Date(sub.current_period_end * 1000).toISOString() : null,
        trial_end: sub?.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
      };
    });

    return new Response(JSON.stringify({ subscriptions }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 403,
    });
  }
});
