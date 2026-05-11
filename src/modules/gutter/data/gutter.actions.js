/**
 * Server Actions — gutter.actions.js
 *
 * Runs on the server. This is the ONLY place you talk to the database.
 *
 * WHAT TO DO:
 *   1. Import getSupabaseAdmin from "@/core/supabase/admin"
 *   2. Write one async function per operation:
 *        load___()   → SELECT
 *        create___() → INSERT
 *        update___() → UPDATE
 *        delete___() → DELETE or soft-delete
 *   3. Return clean objects — no raw DB internals.
 *
 * EXAMPLE:
 *   export async function loadGutterData() {
 *     const supabase = getSupabaseAdmin();
 *     const { data, error } = await supabase
 *       .from("your_table_name")
 *       .select("*")
 *       .order("created_at", { ascending: false });
 *     if (error) throw new Error(error.message);
 *     return { items: data ?? [] };
 *   }
 */
"use server";

// import { getSupabaseAdmin } from "@/core/supabase/admin";
