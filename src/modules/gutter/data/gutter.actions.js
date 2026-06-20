import { cookies } from "next/headers";
import { getSupabaseAdmin } from "@/core/supabase/admin";
import { calculateQuote, calculateMaterials } from "./gutter.data";

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

// ─── Save Project (Create / Edit) ─────────────────────────

async function fetchQuoteSetupByHeader(supabase, header) {
  const [mfr, trip, disc, lg] = await Promise.all([
    hasValue(header.manufacturer_id)
      ? supabase.from("gtr_s_manufacturers").select("manufacturer_id, name, rate").eq("manufacturer_id", header.manufacturer_id).maybeSingle()
      : { data: null, error: null },
    hasValue(header.trip_id)
      ? supabase.from("gtr_s_trip_rates").select("trip_id, label, rate").eq("trip_id", header.trip_id).maybeSingle()
      : { data: null, error: null },
    hasValue(header.discount_id)
      ? supabase.from("gtr_s_discounts").select("discount_id, percentage").eq("discount_id", header.discount_id).maybeSingle()
      : { data: null, error: null },
    hasValue(header.leaf_guard_id)
      ? supabase.from("gtr_s_leaf_guards").select("leaf_guard_id, name, price").eq("leaf_guard_id", header.leaf_guard_id).maybeSingle()
      : { data: null, error: null },
  ]);

  for (const r of [mfr, trip, disc, lg]) {
    if (r.error) throw new Error(r.error.message);
  }

  return {
    materialManufacturer: mfr.data ? [{ id: header.manufacturer_id, name: mfr.data.name || "", rate: mfr.data.rate ?? 0 }] : [],
    leafGuard: lg.data ? [{ id: header.leaf_guard_id, name: lg.data.name || "", price: lg.data.price ?? 0 }] : [],
    tripRates: trip.data ? [{ id: header.trip_id, label: trip.data.label || "", rate: trip.data.rate ?? 0 }] : [],
    discounts: disc.data ? [{ id: header.discount_id, percent: disc.data.percentage ?? 0 }] : [],
  };
}

function computeProjectTotalPrice(header, sides, extras, quoteSetup) {
  try {
    const input = {
      manufacturerId: header.manufacturer_id,
      tripId: header.trip_id,
      discountId: header.discount_id,
      leafGuardId: header.leaf_guard_id,
      cstm_trip_rate: header.cstm_trip_rate,
      cstm_manufacturer_rate: header.cstm_manufacturer_rate,
      cstm_discount_percentage: header.cstm_discount_percentage,
      cstm_leaf_guard_price: header.cstm_leaf_guard_price,
      deposit_percent: header.deposit_percent,
      discountIncluded: Boolean(header.discount_id || hasValue(header.cstm_discount_percentage)),
      leafGuardIncluded: Boolean(header.leaf_guard_id || hasValue(header.cstm_leaf_guard_price)),
      extrasIncluded: Array.isArray(extras) && extras.length > 0,
      depositIncluded: hasValue(header.deposit_percent) && Number(header.deposit_percent) > 0,
      sections: (sides || []).map((r) => ({ sides: r.segments, length: r.length, height: r.height, downspoutQty: r.downspout_qty })),
      extras: (extras || []).map((r) => ({ description: r.name || "", qty: r.quantity, unitPrice: r.unit_price })),
    };
    const result = calculateQuote(input, quoteSetup);
    const total = Number(result?.pricing?.projectTotal);
    return Number.isFinite(total) ? total : null;
  } catch {
    return null;
  }
}

export async function saveGutterProject({ isEdit, projectId, header, sides, extras }) {
  const supabase = getSupabaseAdmin();
  const editMode = isEdit === true;
  const existingId = toIntOrNull(projectId);

  if (editMode && existingId === null) {
    throw new Error("A valid project id is required for edit saves");
  }

  const h = {
    project_name: hasValue(header.project_name) ? String(header.project_name).trim() : "",
    customer: hasValue(header.customer) ? String(header.customer).trim() : "",
    project_address: hasValue(header.project_address) ? String(header.project_address).trim() : "",
    status_id: toIntOrNull(header.status_id),
    date: hasValue(header.date) ? String(header.date) : null,
    trip_id: toIntOrNull(header.trip_id),
    manufacturer_id: toIntOrNull(header.manufacturer_id),
    discount_id: toIntOrNull(header.discount_id),
    request_link: hasValue(header.request_link) ? String(header.request_link).trim() : "",
    leaf_guard_id: toIntOrNull(header.leaf_guard_id),
    cstm_trip_rate: toNumOrNull(header.cstm_trip_rate),
    cstm_manufacturer_rate: toNumOrNull(header.cstm_manufacturer_rate),
    cstm_discount_percentage: toNumOrNull(header.cstm_discount_percentage),
    cstm_leaf_guard_price: toNumOrNull(header.cstm_leaf_guard_price),
    deposit_percent: toNumOrNull(header.deposit_percent),
  };

  if (!h.status_id || !h.manufacturer_id || !h.trip_id) {
    throw new Error("Status, Manufacturer, and Trip Rate are required");
  }

  const sideRows = (Array.isArray(sides) ? sides : [])
    .map((row, i) => {
      const segments = toIntOrNull(row.segments);
      const length = toNumOrNull(row.length);
      const height = toNumOrNull(row.height);
      const dsQty = toIntOrNull(row.downspout_qty);
      const gc = toIntOrNull(row.gutter_color_id);
      const dc = toIntOrNull(row.downspout_color_id);
      if (segments === null && length === null && height === null && dsQty === null && gc === null && dc === null) return null;
      return { side_index: toIntOrNull(row.side_index) ?? i + 1, segments, length, height, downspout_qty: dsQty, gutter_color_id: gc, downspout_color_id: dc };
    })
    .filter(Boolean);

  const extraRows = (Array.isArray(extras) ? extras : [])
    .map((row) => {
      const name = hasValue(row.name) ? String(row.name).trim() : "";
      const qty = toIntOrNull(row.quantity);
      const price = toNumOrNull(row.unit_price);
      if (!name && qty === null && price === null) return null;
      return { name, quantity: qty, unit_price: price };
    })
    .filter(Boolean);

  const now = new Date().toISOString();
  const quoteSetup = await fetchQuoteSetupByHeader(supabase, h);
  const totalPrice = computeProjectTotalPrice(h, sideRows, extraRows, quoteSetup);

  let currentProjId = existingId;

  if (editMode) {
    const { error } = await supabase
      .from("gtr_t_projects")
      .update({ ...h, total_project_price: totalPrice, updated_at: now })
      .eq("proj_id", currentProjId);
    if (error) throw new Error("Error saving project: " + error.message);

    const { error: e1 } = await supabase.from("gtr_m_project_sides").delete().eq("proj_id", currentProjId);
    if (e1) throw new Error("Error clearing sides: " + e1.message);
    const { error: e2 } = await supabase.from("gtr_m_project_extras").delete().eq("proj_id", currentProjId);
    if (e2) throw new Error("Error clearing extras: " + e2.message);
  } else {
    const { data: inserted, error } = await supabase
      .from("gtr_t_projects")
      .insert({ ...h, total_project_price: totalPrice, created_at: now, updated_at: now })
      .select("proj_id")
      .single();
    if (error || !inserted?.proj_id) throw new Error("Error saving project: " + (error?.message || "Unknown error"));
    currentProjId = inserted.proj_id;
  }

  if (sideRows.length > 0) {
    const { error } = await supabase.from("gtr_m_project_sides").insert(sideRows.map((r) => ({ proj_id: currentProjId, ...r })));
    if (error) throw new Error("Error saving sides: " + error.message);
  }

  if (extraRows.length > 0) {
    const { error } = await supabase.from("gtr_m_project_extras").insert(extraRows.map((r) => ({ proj_id: currentProjId, ...r })));
    if (error) throw new Error("Error saving extras: " + error.message);
  }

  // ─── Auto-sync Work Order & Purchase Order ──────────────
  try {
    const sectionData = sideRows.map((r) => ({
      sides: r.segments,
      length: r.length,
      height: r.height,
      downspoutQty: r.downspout_qty,
      gutterColor: "",
      downspoutColor: "",
    }));

    const materials = calculateMaterials({ sections: sectionData });

    // Resolve current user for audit fields
    let userId = null;
    try {
      const cookieStore = await cookies();
      const accessToken = cookieStore.get("sb-access-token")?.value;
      if (accessToken) {
        const { data: authData } = await supabase.auth.getUser(accessToken);
        if (authData?.user) {
          const { data: dbUser } = await supabase
            .from("psb_s_user")
            .select("user_id")
            .eq("auth_user_id", authData.user.id)
            .maybeSingle();
          userId = dbUser?.user_id || null;
        }
      }
    } catch {
      // If user resolution fails, continue without user tracking
    }

    // Auto-save / update Purchase Order
    const { data: existingPO } = await supabase
      .from("gtr_m_purchorder")
      .select("purch_order_id")
      .eq("proj_id", currentProjId)
      .maybeSingle();

    const poPayload = {
      k_style_gutter_color: null,
      downspout_color: null,
      gutter_coil_total_ft: materials?.gutterCoil?.totalFt ?? 0,
      gutter_coil_total_lbs: materials?.gutterCoil?.totalLbs ?? 0,
      right_end_caps_qty: Math.round(materials?.endCaps?.right?.qty ?? 0),
      left_end_caps_qty: Math.round(materials?.endCaps?.left?.qty ?? 0),
      downpipe_qty: Math.round(materials?.downpipe?.qty ?? 0),
      one_piece_offset_qty: Math.round(materials?.onePieceOffset?.qty ?? 0),
      elbow_a_qty: Math.round(materials?.elbow?.qty ?? 0),
      spray_paint_qty: 0,
      zip_screws_qty: 0,
      zip_screws_internal_qty: Math.round(materials?.internal?.internalScrews ?? 0),
      total_downspouts: Math.round(materials?.internal?.totalDownspouts ?? 0),
      total_endcaps: Math.round(materials?.internal?.totalEndcaps ?? 0),
      rectangular_outlets: Math.round(materials?.internal?.rectangularOutlets ?? 0),
      internal_screws: Math.round(materials?.internal?.internalScrews ?? 0),
      hidden_hangers_qty: Math.round(materials?.internal?.hiddenHangers ?? 0),
      box_screws_qty: Math.round(materials?.internal?.boxScrews ?? 0),
    };

    if (existingPO?.purch_order_id) {
      await supabase
        .from("gtr_m_purchorder")
        .update({ ...poPayload, updated_by: userId, updated_at: now })
        .eq("proj_id", currentProjId);
    } else {
      await supabase
        .from("gtr_m_purchorder")
        .insert({ proj_id: currentProjId, ...poPayload, created_by: userId, updated_by: userId, created_at: now, updated_at: now });
    }

    // Auto-save / update Work Order (basic info only)
    const { data: existingWO } = await supabase
      .from("gtr_t_workorders")
      .select("workorder_id")
      .eq("proj_id", currentProjId)
      .maybeSingle();

    if (!existingWO?.workorder_id) {
      await supabase
        .from("gtr_t_workorders")
        .insert({ proj_id: currentProjId, created_by: userId, updated_by: userId, created_at: now, updated_at: now });
    }
  } catch {
    // Non-blocking: project save succeeded, sync failure is secondary
  }

  return { projId: currentProjId };
}

// ─── Update Status ─────────────────────────────────────────

export async function updateGutterProjectStatus(projId, statusId) {
  const id = toIntOrNull(projId);
  const sid = toIntOrNull(statusId);
  if (id === null || sid === null) throw new Error("projId and statusId are required");

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("gtr_t_projects")
    .update({ status_id: sid, updated_at: new Date().toISOString() })
    .eq("proj_id", id);

  if (error) throw new Error(error.message);
  return { success: true };
}

// ─── Delete Project ────────────────────────────────────────

export async function deleteGutterProject(projId) {
  const id = toIntOrNull(projId);
  if (id === null) throw new Error("projId is required");

  const supabase = getSupabaseAdmin();

  const { error: e1 } = await supabase.from("gtr_m_project_sides").delete().eq("proj_id", id);
  if (e1) throw new Error(e1.message);
  const { error: e2 } = await supabase.from("gtr_m_project_extras").delete().eq("proj_id", id);
  if (e2) throw new Error(e2.message);
  const { error: e3 } = await supabase.from("gtr_t_projects").delete().eq("proj_id", id);
  if (e3) throw new Error(e3.message);

  return { success: true };
}

// ─── Purchase Order ────────────────────────────────────────

export async function savePurchaseOrder(projId, purchaseOrder) {
  const id = toIntOrNull(projId);
  if (id === null) throw new Error("projId is required");
  const po = purchaseOrder && typeof purchaseOrder === "object" ? purchaseOrder : {};
  const toInt = (v) => { const n = toIntOrNull(v); return n === null ? 0 : Math.max(0, n); };
  const toNum = (v) => { if (!hasValue(v)) return 0; const n = Number(v); return Number.isFinite(n) && n >= 0 ? n : 0; };
  const normalizeColor = (v) => { const t = String(v ?? "").trim(); return (!t || t === "--") ? null : t; };

  const normalized = {
    k_style_gutter_color: normalizeColor(po.k_style_gutter_color),
    downspout_color: normalizeColor(po.downspout_color),
    gutter_coil_total_ft: toNum(po.gutter_coil_total_ft),
    gutter_coil_total_lbs: toNum(po.gutter_coil_total_lbs),
    right_end_caps_qty: toInt(po.right_end_caps_qty),
    left_end_caps_qty: toInt(po.left_end_caps_qty),
    downpipe_qty: toInt(po.downpipe_qty),
    one_piece_offset_qty: toInt(po.one_piece_offset_qty),
    elbow_a_qty: toInt(po.elbow_a_qty),
    spray_paint_qty: toInt(po.spray_paint_qty),
    zip_screws_qty: toInt(po.zip_screws_qty),
    zip_screws_internal_qty: toInt(po.zip_screws_internal_qty),
    total_downspouts: toInt(po.total_downspouts),
    total_endcaps: toInt(po.total_endcaps),
    rectangular_outlets: toInt(po.rectangular_outlets),
    internal_screws: toInt(po.internal_screws),
    hidden_hangers_qty: toInt(po.hidden_hangers_qty),
    box_screws_qty: toInt(po.box_screws_qty),
  };

  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  // Resolve current user for audit fields
  let userId = null;
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("sb-access-token")?.value;
    if (accessToken) {
      const { data: authData } = await supabase.auth.getUser(accessToken);
      if (authData?.user) {
        const { data: dbUser } = await supabase
          .from("psb_s_user")
          .select("user_id")
          .eq("auth_user_id", authData.user.id)
          .maybeSingle();
        userId = dbUser?.user_id || null;
      }
    }
  } catch {
    // Continue without user tracking if resolution fails
  }

  const { data: existing } = await supabase
    .from("gtr_m_purchorder")
    .select("purch_order_id")
    .eq("proj_id", id)
    .maybeSingle();

  if (existing?.purch_order_id) {
    const { data, error } = await supabase
      .from("gtr_m_purchorder")
      .update({ ...normalized, updated_by: userId, updated_at: now })
      .eq("proj_id", id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return data;
  }

  const { data, error } = await supabase
    .from("gtr_m_purchorder")
    .insert({ proj_id: id, ...normalized, created_by: userId, updated_by: userId, created_at: now, updated_at: now })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

// ─── Work Order ────────────────────────────────────────────

export async function saveGutterWorkOrder({ projectId, workOrder }) {
  const id = toIntOrNull(projectId);
  if (id === null) throw new Error("projId is required");
  if (!workOrder || typeof workOrder !== "object") throw new Error("Work order data is required");

  const normalize = (value) => {
    if (!hasValue(value)) return null;
    return String(value).trim();
  };

  const normalized = {
    work_order_no: normalize(workOrder.workOrderNo),
    po_number: normalize(workOrder.poNumber),
    work_order_date: normalize(workOrder.workOrderDate),
    installer_name: normalize(workOrder.installerName),
    installation_date: normalize(workOrder.installDate),
    signature_name: normalize(workOrder.installerSignature),
    signature_date: normalize(workOrder.signatureDate),
    notes: normalize(workOrder.notes),
  };

  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  const { data: existing, error: existingError } = await supabase
    .from("gtr_t_workorders")
    .select("workorder_id")
    .eq("proj_id", id)
    .maybeSingle();

  if (existingError) throw new Error(existingError.message);

  let workorderId;

  if (existing?.workorder_id) {
    workorderId = existing.workorder_id;
    const { error } = await supabase
      .from("gtr_t_workorders")
      .update({ ...normalized, updated_at: now })
      .eq("workorder_id", workorderId);
    if (error) throw new Error("Error saving work order: " + error.message);
  } else {
    const { data: inserted, error } = await supabase
      .from("gtr_t_workorders")
      .insert({ proj_id: id, ...normalized, created_at: now, updated_at: now })
      .select("workorder_id")
      .single();
    if (error || !inserted?.workorder_id) throw new Error("Error saving work order: " + (error?.message || "Unknown error"));
    workorderId = inserted.workorder_id;
  }

  const { error: dspDeleteError } = await supabase
    .from("gtr_t_workorder_dsp")
    .delete()
    .eq("workorder_id", workorderId);
  if (dspDeleteError) throw new Error("Error clearing work order DSP assignments: " + dspDeleteError.message);

  const dspRows = (Array.isArray(workOrder.downspoutAssignments) ? workOrder.downspoutAssignments : []).map((value, index) => ({
    workorder_id: workorderId,
    dsp_no: index + 1,
    assigned_value: normalize(value),
  }));

  if (dspRows.length > 0) {
    const { error } = await supabase.from("gtr_t_workorder_dsp").insert(dspRows);
    if (error) throw new Error("Error saving work order DSP assignments: " + error.message);
  }

  const zipRows = (Array.isArray(workOrder.zipScrewsBags) ? workOrder.zipScrewsBags : [])
    .map((row) => ({
      workorder_id: workorderId,
      qty: toIntOrNull(row.qty) ?? 0,
      color: normalize(row.color),
    }))
    .filter((row) => row.qty > 0 || hasValue(row.color));

  const { error: zipDeleteError } = await supabase
    .from("gtr_t_workorder_zip_screws")
    .delete()
    .eq("workorder_id", workorderId);
  if (zipDeleteError) throw new Error("Error clearing work order zip screws: " + zipDeleteError.message);

  if (zipRows.length > 0) {
    const { error } = await supabase.from("gtr_t_workorder_zip_screws").insert(zipRows);
    if (error) throw new Error("Error saving work order zip screws: " + error.message);
  }

  return { workorderId };
}

// ─── Setup Table CRUD ──────────────────────────────────────

const SETUP_TABLES = {
  statuses:      { table: "gtr_s_statuses",      pk: "status_id" },
  colors:        { table: "gtr_s_colors",        pk: "color_id" },
  manufacturers: { table: "gtr_s_manufacturers", pk: "manufacturer_id" },
  leafGuards:    { table: "gtr_s_leaf_guards",   pk: "leaf_guard_id" },
  tripRates:     { table: "gtr_s_trip_rates",    pk: "trip_id" },
  discounts:     { table: "gtr_s_discounts",     pk: "discount_id" },
};

function resolveSetupTable(key) {
  const entry = SETUP_TABLES[key];
  if (!entry) throw new Error(`Unknown setup table key: "${key}"`);
  return entry;
}

export async function createSetupRow(tableKey, row) {
  const { table, pk } = resolveSetupTable(tableKey);
  if (!row || typeof row !== "object") throw new Error("Row data is required.");

  const supabase = getSupabaseAdmin();
  const payload = { ...row };
  delete payload[pk];

  const { data, error } = await supabase.from(table).insert(payload).select("*").single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateSetupRow(tableKey, id, updates) {
  const { table, pk } = resolveSetupTable(tableKey);
  const rowId = toIntOrNull(id);
  if (rowId === null) throw new Error(`${pk} is required.`);
  if (!updates || typeof updates !== "object") throw new Error("Update data is required.");

  const supabase = getSupabaseAdmin();
  const payload = { ...updates };
  delete payload[pk];

  const { data, error } = await supabase.from(table).update(payload).eq(pk, rowId).select("*").single();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteSetupRow(tableKey, id) {
  const { table, pk } = resolveSetupTable(tableKey);
  const rowId = toIntOrNull(id);
  if (rowId === null) throw new Error(`${pk} is required.`);

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from(table).delete().eq(pk, rowId);
  if (error) throw new Error(error.message);
  return { success: true };
}