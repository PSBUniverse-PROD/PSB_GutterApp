import { createClient } from "@supabase/supabase-js";
import { calculateQuote } from "./gutter.data";

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase admin configuration");
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// ─── Helpers ───────────────────────────────────────────────

function hasValue(v) {
  return v !== undefined && v !== null && String(v).trim() !== "";
}

function toIntOrNull(v) {
  if (!hasValue(v)) return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function toNumOrNull(v) {
  if (!hasValue(v)) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function toUserDisplayName(u) {
  if (!u || typeof u !== "object") return "";
  const c = [u.full_name, u.display_name, u.username, u.user_name, u.name, u.email];
  const found = c.find(hasValue);
  return hasValue(found) ? String(found).trim() : "";
}

// ─── Setup ─────────────────────────────────────────────────

export async function loadGutterSetup() {
  const supabase = getSupabaseAdmin();

  const queries = {
    statuses:      supabase.from("gtr_s_statuses").select("*").order("status_id"),
    colors:        supabase.from("gtr_s_colors").select("*").order("color_id"),
    manufacturers: supabase.from("gtr_s_manufacturers").select("*").order("manufacturer_id"),
    leafGuards:    supabase.from("gtr_s_leaf_guards").select("*").order("leaf_guard_id"),
    tripRates:     supabase.from("gtr_s_trip_rates").select("*").order("trip_id"),
    discounts:     supabase.from("gtr_s_discounts").select("*").order("discount_id"),
    company:       supabase.from("psb_s_company").select("comp_id,comp_name,short_name,comp_email,comp_phone").order("comp_id").limit(1),
  };

  const keys = Object.keys(queries);
  const settled = await Promise.allSettled(Object.values(queries));
  const result = {};
  const errors = [];

  settled.forEach((r, i) => {
    const key = keys[i];
    if (r.status === "fulfilled" && !r.value.error) {
      result[key] = r.value.data || [];
    } else {
      result[key] = [];
      errors.push(key);
    }
  });

  return { ...result, sourceErrors: errors };
}

// ─── Project List ──────────────────────────────────────────

export async function loadGutterProjects() {
  const supabase = getSupabaseAdmin();

  const [projectsResult, statusesResult] = await Promise.all([
    supabase
      .from("gtr_t_projects")
      .select(
        "proj_id, project_name, customer, project_address, status_id, date, " +
        "created_at, updated_at, manufacturer_id, trip_id, discount_id, leaf_guard_id, " +
        "request_link, deposit_percent, total_project_price, created_by, updated_by, " +
        "gtr_s_statuses(name), gtr_s_manufacturers(name,rate), " +
        "gtr_s_trip_rates(label,rate), gtr_s_discounts(percentage,description), " +
        "gtr_s_leaf_guards(name,price)"
      )
      .order("updated_at", { ascending: false }),
    supabase.from("gtr_s_statuses").select("status_id, name").order("status_id"),
  ]);

  if (projectsResult.error) throw new Error(projectsResult.error.message);
  if (statusesResult.error) throw new Error(statusesResult.error.message);

  const projects = projectsResult.data || [];

  const userIds = Array.from(
    new Set(
      projects
        .flatMap((p) => [toIntOrNull(p.created_by), toIntOrNull(p.updated_by)])
        .filter((v) => v !== null)
    )
  );

  let userById = new Map();
  if (userIds.length > 0) {
    const { data: users } = await supabase
      .from("psb_s_user")
      .select("*")
      .in("user_id", userIds);
    userById = (users || []).reduce((m, u) => {
      m.set(String(u.user_id), u);
      return m;
    }, new Map());
  }

  const enriched = projects.map((p) => {
    const createdUser = userById.get(String(toIntOrNull(p.created_by)));
    const updatedUser = userById.get(String(toIntOrNull(p.updated_by)));
    return {
      ...p,
      created_by_name: toUserDisplayName(createdUser) || (p.created_by ? `User #${p.created_by}` : "--"),
      updated_by_name: toUserDisplayName(updatedUser) || (p.updated_by ? `User #${p.updated_by}` : "--"),
    };
  });

  return { projects: enriched, statuses: statusesResult.data || [] };
}

// ─── Single Project ────────────────────────────────────────

export async function loadGutterProject(projId) {
  const id = toIntOrNull(projId);
  if (id === null) throw new Error("projId is required");

  const supabase = getSupabaseAdmin();

  const [headerResult, sidesResult, extrasResult, colorsResult] = await Promise.all([
    supabase.from("gtr_t_projects").select("*").eq("proj_id", id).maybeSingle(),
    supabase.from("gtr_m_project_sides").select("*").eq("proj_id", id).order("side_index"),
    supabase.from("gtr_m_project_extras").select("*").eq("proj_id", id).order("extra_id"),
    supabase.from("gtr_s_colors").select("color_id, name").order("color_id"),
  ]);

  if (headerResult.error) throw new Error(headerResult.error.message);
  if (sidesResult.error) throw new Error(sidesResult.error.message);
  if (extrasResult.error) throw new Error(extrasResult.error.message);
  if (colorsResult.error) throw new Error(colorsResult.error.message);

  return {
    projectHeader: headerResult.data || null,
    projectSides: sidesResult.data || [],
    projectExtras: extrasResult.data || [],
    colors: colorsResult.data || [],
  };
}

// ─── Purchase Order ────────────────────────────────────────

export async function loadPurchaseOrder(projId) {
  const id = toIntOrNull(projId);
  if (id === null) throw new Error("projId is required");

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("gtr_m_purchorder")
    .select("*")
    .eq("proj_id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data || null;
}

export async function loadGutterWorkOrder(projId) {
  const id = toIntOrNull(projId);
  if (id === null) throw new Error("projId is required");

  const supabase = getSupabaseAdmin();

  const { data: workOrderRow, error: workOrderError } = await supabase
    .from("gtr_t_workorders")
    .select("*")
    .eq("proj_id", id)
    .maybeSingle();

  if (workOrderError) throw new Error(workOrderError.message);
  if (!workOrderRow) return null;

  const [{ data: dspRows, error: dspError }, { data: zipRows, error: zipError }] = await Promise.all([
    supabase
      .from("gtr_t_workorder_dsp")
      .select("dsp_no, assigned_value")
      .eq("workorder_id", workOrderRow.workorder_id)
      .order("dsp_no", { ascending: true }),
    supabase
      .from("gtr_t_workorder_zip_screws")
      .select("color, qty")
      .eq("workorder_id", workOrderRow.workorder_id)
      .order("workorder_zip_screw_id", { ascending: true }),
  ]);

  if (dspError) throw new Error(dspError.message);
  if (zipError) throw new Error(zipError.message);

  const assignments = Array.from({ length: 8 }, (_, index) => {
    const row = (dspRows || []).find((r) => Number(r.dsp_no) === index + 1);
    return row ? String(row.assigned_value || "") : "";
  });

  const zipScrewsBags = (zipRows || []).map((row) => ({
    qty: row.qty !== null && row.qty !== undefined ? String(row.qty) : "1",
    color: row.color !== null && row.color !== undefined ? String(row.color) : "",
  }));

  return {
    ...workOrderRow,
    downspoutAssignments: assignments,
    zipScrewsBags,
  };
}

export async function loadProjectSnapshots(projId) {
  const id = toIntOrNull(projId);
  if (id === null) throw new Error("projId is required");

  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("gtr_t_project_snapshots")
    .select("snapshot_id, version_number, reason, created_at, created_by")
    .eq("proj_id", id)
    .order("version_number", { ascending: true });

  if (error) throw new Error(error.message);

  const userIds = Array.from(
    new Set((data || []).map((s) => toIntOrNull(s.created_by)).filter((v) => v !== null))
  );

  let userById = new Map();
  if (userIds.length > 0) {
    const { data: users } = await supabase
      .from("psb_s_user")
      .select("*")
      .in("user_id", userIds);
    userById = (users || []).reduce((m, u) => {
      m.set(String(u.user_id), u);
      return m;
    }, new Map());
  }

  return (data || []).map((s) => {
    const user = userById.get(String(toIntOrNull(s.created_by)));
    return {
      ...s,
      created_by_name: toUserDisplayName(user) || (s.created_by ? `User #${s.created_by}` : "System"),
    };
  });
}
