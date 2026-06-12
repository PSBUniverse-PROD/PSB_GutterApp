/**
 * Client Helpers — gutter.data.js
 *
 * Pure calculation engine, form helpers, normalizers, and formatters.
 * NO database calls here — those belong in gutter.actions.js.
 */

// ─── Basic Helpers ─────────────────────────────────────────

export function asNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function hasValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function sum(values) {
  return values.reduce((t, v) => t + asNumber(v), 0);
}

function normalizePercentRate(value) {
  if (!hasValue(value)) return 0;
  const n = asNumber(value);
  if (n <= 0) return 0;
  return clamp(n > 1 ? n / 100 : n, 0, 1);
}

// ─── Formatters ────────────────────────────────────────────

export function formatCurrency(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "--";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

export function toPercentLabel(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return "--";
  const pct = n > 1 ? n : n * 100;
  return `${Math.round(pct * 100) / 100}%`;
}

export function formatPercentLabel(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return "0";
  const pct = n > 1 ? n : n * 100;
  const r = Math.round(pct * 100) / 100;
  return Number.isInteger(r) ? String(r) : String(r).replace(/\.0+$/, "");
}

export function toDisplayPercentValue(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n > 1 ? n : n * 100;
}

export function statusToneClass(statusName) {
  const s = String(statusName ?? "").trim().toLowerCase();
  if (s.includes("await")) return "gutter-status-awaiting";
  if (s.includes("complete")) return "gutter-status-complete";
  if (s.includes("cancel")) return "gutter-status-cancelled";
  if (s.includes("draft")) return "gutter-status-draft";
  return "gutter-status-default";
}

// ─── Normalizers ───────────────────────────────────────────

function pickFirst(row, keys, fallback = "") {
  for (const k of keys) {
    const v = row?.[k];
    if (hasValue(v)) return v;
  }
  return fallback;
}

function toNumberOrZero(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function normalizeStatuses(rows) {
  return (rows || []).map((r, i) => {
    const id = pickFirst(r, ["status_id", "id"], null);
    if (!hasValue(id)) return null;
    return { ...r, status_id: id, name: String(pickFirst(r, ["name", "status_name", "status", "label"], `Status ${i + 1}`)) };
  }).filter(Boolean);
}

export function normalizeColors(rows) {
  return (rows || []).map((r, i) => {
    const id = pickFirst(r, ["color_id", "id"], null);
    if (!hasValue(id)) return null;
    return { ...r, color_id: id, name: String(pickFirst(r, ["name", "color_name", "color", "label"], `Color ${i + 1}`)) };
  }).filter(Boolean);
}

export function normalizeManufacturers(rows) {
  return (rows || []).map((r, i) => {
    const id = pickFirst(r, ["manufacturer_id", "id"], null);
    if (!hasValue(id)) return null;
    return { ...r, manufacturer_id: id, name: String(pickFirst(r, ["name", "manufacturer_name", "label"], `Manufacturer ${i + 1}`)), rate: toNumberOrZero(pickFirst(r, ["rate", "unit_rate", "price"], 0)) };
  }).filter(Boolean);
}

export function normalizeLeafGuards(rows) {
  return (rows || []).map((r, i) => {
    const id = pickFirst(r, ["leaf_guard_id", "id"], null);
    if (!hasValue(id)) return null;
    return { ...r, leaf_guard_id: id, name: String(pickFirst(r, ["name", "leaf_guard_name", "label"], `Leaf Guard ${i + 1}`)), price: toNumberOrZero(pickFirst(r, ["price", "rate", "unit_price"], 0)) };
  }).filter(Boolean);
}

export function normalizeTripRates(rows) {
  return (rows || []).map((r, i) => {
    const id = pickFirst(r, ["trip_id", "id"], null);
    if (!hasValue(id)) return null;
    return { ...r, trip_id: id, label: String(pickFirst(r, ["label", "trip", "name"], `Trip ${i + 1}`)), rate: toNumberOrZero(pickFirst(r, ["rate", "price", "amount"], 0)) };
  }).filter(Boolean);
}

export function normalizeDiscounts(rows) {
  return (rows || []).map((r, i) => {
    const id = pickFirst(r, ["discount_id", "id"], null);
    if (!hasValue(id)) return null;
    return { ...r, discount_id: id, percentage: toNumberOrZero(pickFirst(r, ["percentage", "percent", "rate"], 0)), description: String(pickFirst(r, ["description", "name", "label"], `Discount ${i + 1}`)) };
  }).filter(Boolean);
}

// ─── Form Helpers ──────────────────────────────────────────

export function emptySection() {
  return { colorId: "", downspoutColorId: "", sides: "", length: "", height: "", downspoutQty: "" };
}

export function emptyExtra() {
  return { description: "", qty: "", unitPrice: "" };
}

export function createInitialProject() {
  return {
    projId: null, statusId: "", requestLink: "", customer: "", date: "",
    projectName: "", projectAddress: "", manufacturerId: "",
    manualManufacturerRateEnabled: false, manualManufacturerRate: "",
    tripId: "", manualTripRateEnabled: false, manualTripRate: "",
    sections: [emptySection()],
    leafGuardIncluded: false, leafGuardId: "",
    manualLeafGuardRateEnabled: false, manualLeafGuardRate: "",
    extrasIncluded: false, extras: [emptyExtra()],
    discountIncluded: false, discountId: "",
    manualDiscountRateEnabled: false, manualDiscountPercent: "", discountPercent: "",
    depositIncluded: false, depositPercent: "",
  };
}

export function mapHeaderToProject(header, sides, extras) {
  const mappedSections = (sides || []).map((s) => ({
    colorId: s.gutter_color_id ? String(s.gutter_color_id) : "",
    downspoutColorId: s.downspout_color_id ? String(s.downspout_color_id) : s.gutter_color_id ? String(s.gutter_color_id) : "",
    sides: s.segments != null ? String(s.segments) : "",
    length: s.length != null ? String(s.length) : "",
    height: s.height != null ? String(s.height) : "",
    downspoutQty: s.downspout_qty != null ? String(s.downspout_qty) : "",
  }));

  const mappedExtras = (extras || []).map((e) => ({
    description: e.name || "",
    qty: e.quantity != null ? String(e.quantity) : "",
    unitPrice: e.unit_price != null ? String(e.unit_price) : "",
  }));

  const hasCstmMfr = header.cstm_manufacturer_rate != null;
  const hasCstmTrip = header.cstm_trip_rate != null;
  const hasCstmLg = header.cstm_leaf_guard_price != null;
  const hasCstmDisc = header.cstm_discount_percentage != null;

  const rawDeposit = header.deposit_percent != null ? Number(header.deposit_percent) : null;
  const depositDisplay = rawDeposit !== null && Number.isFinite(rawDeposit) ? (rawDeposit > 1 ? rawDeposit : rawDeposit * 100) : "";
  const hasDeposit = rawDeposit !== null && Number.isFinite(rawDeposit) && rawDeposit > 0;

  return {
    projId: header.proj_id,
    statusId: header.status_id ? String(header.status_id) : "",
    requestLink: header.request_link || "",
    customer: header.customer || "",
    date: header.date || "",
    projectName: header.project_name || "",
    projectAddress: header.project_address || "",
    manufacturerId: header.manufacturer_id ? String(header.manufacturer_id) : "",
    manualManufacturerRateEnabled: hasCstmMfr,
    manualManufacturerRate: hasCstmMfr ? String(header.cstm_manufacturer_rate) : "",
    tripId: header.trip_id ? String(header.trip_id) : "",
    manualTripRateEnabled: hasCstmTrip,
    manualTripRate: hasCstmTrip ? String(header.cstm_trip_rate) : "",
    sections: mappedSections.length > 0 ? mappedSections : [emptySection()],
    leafGuardIncluded: Boolean(header.leaf_guard_id || hasCstmLg),
    leafGuardId: header.leaf_guard_id ? String(header.leaf_guard_id) : "",
    manualLeafGuardRateEnabled: hasCstmLg,
    manualLeafGuardRate: hasCstmLg ? String(header.cstm_leaf_guard_price) : "",
    extrasIncluded: mappedExtras.length > 0,
    extras: mappedExtras.length > 0 ? mappedExtras : [emptyExtra()],
    discountIncluded: Boolean(header.discount_id || hasCstmDisc),
    discountId: header.discount_id ? String(header.discount_id) : "",
    manualDiscountRateEnabled: hasCstmDisc,
    manualDiscountPercent: hasCstmDisc ? String(toDisplayPercentValue(header.cstm_discount_percentage)) : "",
    discountPercent: "",
    depositIncluded: hasDeposit,
    depositPercent: depositDisplay === "" ? "" : String(depositDisplay),
  };
}

function normalizeSnapshotText(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function normalizeSnapshotNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function normalizeProjectForSnapshot(project) {
  const p = project || {};
  return {
    projId: normalizeSnapshotText(p.projId),
    statusId: normalizeSnapshotText(p.statusId),
    requestLink: normalizeSnapshotText(p.requestLink),
    customer: normalizeSnapshotText(p.customer),
    date: normalizeSnapshotText(p.date),
    projectName: normalizeSnapshotText(p.projectName),
    projectAddress: normalizeSnapshotText(p.projectAddress),
    manufacturerId: normalizeSnapshotText(p.manufacturerId),
    manualManufacturerRateEnabled: Boolean(p.manualManufacturerRateEnabled),
    manualManufacturerRate: normalizeSnapshotText(p.manualManufacturerRate),
    tripId: normalizeSnapshotText(p.tripId),
    manualTripRateEnabled: Boolean(p.manualTripRateEnabled),
    manualTripRate: normalizeSnapshotText(p.manualTripRate),
    sections: (Array.isArray(p.sections) ? p.sections : []).map((s) => ({
      colorId: normalizeSnapshotText(s?.colorId),
      downspoutColorId: normalizeSnapshotText(s?.downspoutColorId),
      sides: normalizeSnapshotText(s?.sides),
      length: normalizeSnapshotText(s?.length),
      height: normalizeSnapshotText(s?.height),
      downspoutQty: normalizeSnapshotText(s?.downspoutQty),
    })),
    leafGuardIncluded: Boolean(p.leafGuardIncluded),
    leafGuardId: normalizeSnapshotText(p.leafGuardId),
    manualLeafGuardRateEnabled: Boolean(p.manualLeafGuardRateEnabled),
    manualLeafGuardRate: normalizeSnapshotText(p.manualLeafGuardRate),
    extrasIncluded: Boolean(p.extrasIncluded),
    extras: (Array.isArray(p.extras) ? p.extras : []).map((e) => ({
      description: normalizeSnapshotText(e?.description),
      qty: normalizeSnapshotText(e?.qty),
      unitPrice: normalizeSnapshotText(e?.unitPrice),
    })),
    discountIncluded: Boolean(p.discountIncluded),
    discountId: normalizeSnapshotText(p.discountId),
    manualDiscountRateEnabled: Boolean(p.manualDiscountRateEnabled),
    manualDiscountPercent: normalizeSnapshotText(p.manualDiscountPercent),
    discountPercent: normalizeSnapshotText(p.discountPercent),
    depositIncluded: Boolean(p.depositIncluded),
    depositPercent: normalizeSnapshotText(p.depositPercent),
  };
}

function normalizePricingForSnapshot(pricing) {
  if (!pricing) return null;
  const derived = pricing.derivedEndCaps || {};
  return {
    manufacturerRate: normalizeSnapshotNumber(pricing.manufacturerRate),
    setupManufacturerRate: normalizeSnapshotNumber(pricing.setupManufacturerRate),
    totalGutter: normalizeSnapshotNumber(pricing.totalGutter),
    totalDownspouts: normalizeSnapshotNumber(pricing.totalDownspouts),
    materialCost: normalizeSnapshotNumber(pricing.materialCost),
    downspoutCost: normalizeSnapshotNumber(pricing.downspoutCost),
    leafGuardUnitPrice: normalizeSnapshotNumber(pricing.leafGuardUnitPrice),
    leafGuardCost: normalizeSnapshotNumber(pricing.leafGuardCost),
    tripFeeLookup: normalizeSnapshotNumber(pricing.tripFeeLookup),
    tripFeePrice: normalizeSnapshotNumber(pricing.tripFeePrice),
    totalEndCaps: normalizeSnapshotNumber(pricing.totalEndCaps),
    derivedEndCaps: {
      group1: normalizeSnapshotNumber(derived.group1),
      group2: normalizeSnapshotNumber(derived.group2),
      rightEndCaps1: normalizeSnapshotNumber(derived.rightEndCaps1),
      leftEndCaps1: normalizeSnapshotNumber(derived.leftEndCaps1),
      rightEndCaps2: normalizeSnapshotNumber(derived.rightEndCaps2),
      leftEndCaps2: normalizeSnapshotNumber(derived.leftEndCaps2),
      total: normalizeSnapshotNumber(derived.total),
      groups: (Array.isArray(derived.groups) ? derived.groups : []).map((g) => ({
        index: normalizeSnapshotNumber(g?.index),
        fromSide: normalizeSnapshotNumber(g?.fromSide),
        toSide: normalizeSnapshotNumber(g?.toSide),
        value: normalizeSnapshotNumber(g?.value),
      })),
    },
    extrasPrice: normalizeSnapshotNumber(pricing.extrasPrice),
    subtotal: normalizeSnapshotNumber(pricing.subtotal),
    discountPercent: normalizeSnapshotNumber(pricing.discountPercent),
    discountAmount: normalizeSnapshotNumber(pricing.discountAmount),
    projectTotal: normalizeSnapshotNumber(pricing.projectTotal),
    depositRate: normalizeSnapshotNumber(pricing.depositRate),
    depositPercentDisplay: normalizeSnapshotNumber(pricing.depositPercentDisplay),
    depositAmount: normalizeSnapshotNumber(pricing.depositAmount),
    remainingBalance: normalizeSnapshotNumber(pricing.remainingBalance),
    gutterQuantities: (Array.isArray(pricing.gutterQuantities) ? pricing.gutterQuantities : []).map(normalizeSnapshotNumber),
    downspoutFootages: (Array.isArray(pricing.downspoutFootages) ? pricing.downspoutFootages : []).map(normalizeSnapshotNumber),
    sectionGutterPrices: (Array.isArray(pricing.sectionGutterPrices) ? pricing.sectionGutterPrices : []).map(normalizeSnapshotNumber),
    sectionDownspoutPrices: (Array.isArray(pricing.sectionDownspoutPrices) ? pricing.sectionDownspoutPrices : []).map(normalizeSnapshotNumber),
  };
}

export function buildGutterProjectSnapshot(project, quoteSetup = {}) {
  const normalizedProject = normalizeProjectForSnapshot(project);
  const quote = calculateQuote(normalizedProject, quoteSetup);
  return JSON.stringify({
    project: normalizedProject,
    pricing: normalizePricingForSnapshot(quote?.pricing || null),
  });
}

// ─── Quote Calculation Engine ──────────────────────────────

const CONST_GUTTER_EXTRA = 1;
const CONST_DOWNSPOUT_EXTRA_HEIGHT = 1.25;
const CONST_MIN_SIDE = 1;
const CONST_MAX_SIDE = 10;
const CONST_MIN_DS = 1;
const CONST_MAX_DS = 10;

export function computeGutterQty(sides, length) {
  const seg = asNumber(sides);
  const len = asNumber(length);
  if (seg <= 0 && len <= 0) return 0;
  return clamp(seg, CONST_MIN_SIDE, CONST_MAX_SIDE) * len + CONST_GUTTER_EXTRA;
}

export function computeDownspoutFootage(height, downspoutQty) {
  const h = asNumber(height);
  const q = asNumber(downspoutQty);
  if (h <= 0) return 0;
  if (q <= 0 && h <= 0) return 0;
  return (h + CONST_DOWNSPOUT_EXTRA_HEIGHT) * clamp(q, CONST_MIN_DS, CONST_MAX_DS);
}

export function deriveEndCapsFromSections(sections) {
  const safe = Array.isArray(sections) ? sections : [];
  const sideValues = safe.map((s) => {
    const raw = asNumber(s?.sides);
    const used = raw > 0 || asNumber(s?.length) > 0 || asNumber(s?.height) > 0 || asNumber(s?.downspoutQty) > 0;
    return used ? clamp(raw, CONST_MIN_SIDE, CONST_MAX_SIDE) : 0;
  });

  const groups = [];
  for (let i = 0; i < sideValues.length; i += 2) {
    const val = asNumber(sideValues[i]) + asNumber(sideValues[i + 1]);
    groups.push({ index: Math.floor(i / 2) + 1, fromSide: i + 1, toSide: Math.min(i + 2, sideValues.length), value: val });
  }

  const g1 = groups[0]?.value ?? 0;
  const g2 = groups[1]?.value ?? 0;
  const total = groups.reduce((a, g) => a + g.value * 2, 0);

  return { groups, group1: g1, group2: g2, rightEndCaps1: g1, leftEndCaps1: g1, rightEndCaps2: g2, leftEndCaps2: g2, total };
}

function computeFinancialSummary({ subtotal, discountRate, depositRate }) {
  const sub = asNumber(subtotal);
  const dr = clamp(asNumber(discountRate), 0, 1);
  const dep = clamp(asNumber(depositRate), 0, 1);
  const discountAmount = sub * dr;
  const projectTotal = sub - discountAmount;
  const depositAmount = projectTotal * dep;
  const remainingBalance = projectTotal - depositAmount;
  return { projectTotal, discountedTotal: projectTotal, discountAmount, depositAmount, remainingBalance, balanceDue: remainingBalance, savingsAmount: discountAmount };
}

function rateMaps(setup) {
  const add = (t, k, v) => { if (hasValue(k)) t[String(k)] = asNumber(v); };
  const mfr = {}, lg = {}, tf = {}, disc = {};
  (setup?.materialManufacturer || []).forEach((i) => { add(mfr, i.id, i.rate); add(mfr, i.name, i.rate); });
  (setup?.leafGuard || []).forEach((i) => { add(lg, i.id, i.price); add(lg, i.name, i.price); });
  (setup?.tripRates || []).forEach((i) => { add(tf, i.id, i.rate); add(tf, i.label, i.rate); });
  (setup?.discounts || []).forEach((i) => { add(disc, i.id, normalizePercentRate(i.percent)); });
  return { manufacturerRates: mfr, leafGuardRates: lg, tripFeeRates: tf, discountRates: disc };
}

export function calculateQuote(project, setup) {
  const rates = rateMaps(setup);

  // Manufacturer rate
  const mfrKey = project.manufacturerId ?? project.manufacturer;
  const setupMfrRate = rates.manufacturerRates[String(mfrKey)] ?? 0;
  const hasManualMfrToggle = project?.manualManufacturerRateEnabled === true || project?.manualManufacturerRateEnabled === false;
  const manualMfrEnabled = Boolean(project?.manualManufacturerRateEnabled);
  const manualMfrRate = hasValue(project?.manualManufacturerRate) ? asNumber(project.manualManufacturerRate) : null;
  const cstmMfrRate = hasValue(project?.cstm_manufacturer_rate) ? asNumber(project.cstm_manufacturer_rate) : null;
  const manufacturerRate = hasManualMfrToggle
    ? (manualMfrEnabled && manualMfrRate !== null ? manualMfrRate : setupMfrRate)
    : (cstmMfrRate ?? setupMfrRate);

  // Leaf guard rate
  const lgKey = project.leafGuardId ?? project.leafGuard;
  const setupLgPrice = rates.leafGuardRates[String(lgKey)] ?? 0;
  const hasManualLgToggle = project?.manualLeafGuardRateEnabled === true || project?.manualLeafGuardRateEnabled === false;
  const manualLgEnabled = Boolean(project?.manualLeafGuardRateEnabled);
  const manualLgRate = hasValue(project?.manualLeafGuardRate) ? asNumber(project.manualLeafGuardRate) : null;
  const cstmLgRate = hasValue(project?.cstm_leaf_guard_price) ? asNumber(project.cstm_leaf_guard_price) : null;
  const leafGuardUnitPrice = hasManualLgToggle
    ? (manualLgEnabled && manualLgRate !== null ? manualLgRate : setupLgPrice)
    : (cstmLgRate ?? setupLgPrice);

  // Trip fee rate
  const tripKey = project.tripId ?? project.tripFeeKey;
  const setupTripRate = rates.tripFeeRates[String(tripKey)] ?? 0;
  const hasManualTripToggle = project?.manualTripRateEnabled === true || project?.manualTripRateEnabled === false;
  const manualTripEnabled = Boolean(project?.manualTripRateEnabled);
  const manualTripRate = hasValue(project?.manualTripRate) ? asNumber(project.manualTripRate) : null;
  const cstmTripRate = hasValue(project?.cstm_trip_rate) ? asNumber(project.cstm_trip_rate) : null;
  const tripFeeLookup = hasManualTripToggle
    ? (manualTripEnabled && manualTripRate !== null ? manualTripRate : setupTripRate)
    : (cstmTripRate ?? setupTripRate);

  const tripFeePrice = tripFeeLookup;

  const derivedEndCaps = deriveEndCapsFromSections(project.sections);
  const totalEndCaps = derivedEndCaps.total;

  const gutterQuantities = (project.sections || []).map((s) => computeGutterQty(s.sides, s.length));
  const downspoutFootages = (project.sections || []).map((s) => computeDownspoutFootage(s.height, s.downspoutQty));

  const totalGutter = sum(gutterQuantities);
  const totalDownspouts = sum(downspoutFootages);

  const materialCost = totalGutter * manufacturerRate;
  const sectionGutterPrices = gutterQuantities.map((q) => asNumber(q) * manufacturerRate);
  const downspoutCost = totalDownspouts * manufacturerRate;
  const sectionDownspoutPrices = downspoutFootages.map((q) => asNumber(q) * manufacturerRate);

  const shouldApplyLeafGuard = project?.leafGuardIncluded === true || project?.leafGuardIncluded === false
    ? Boolean(project.leafGuardIncluded)
    : Boolean(hasValue(project.leafGuardId) || hasValue(cstmLgRate));
  const leafGuardCost = shouldApplyLeafGuard ? leafGuardUnitPrice : 0;

  const shouldApplyExtras = project?.extrasIncluded === true || project?.extrasIncluded === false
    ? Boolean(project.extrasIncluded)
    : (project.extras || []).some((e) => hasValue(e?.description) || hasValue(e?.qty) || hasValue(e?.unitPrice));
  const extrasPrice = shouldApplyExtras
    ? sum((project.extras || []).map((e) => asNumber(e.qty) * asNumber(e.unitPrice)))
    : 0;

  // Discount
  const setupDiscountPercent = rates.discountRates[String(project.discountId)] ?? 0;
  const cstmDiscPercent = hasValue(project?.cstm_discount_percentage) ? normalizePercentRate(project.cstm_discount_percentage) : null;
  const hasManualDiscToggle = project?.manualDiscountRateEnabled === true || project?.manualDiscountRateEnabled === false;
  const manualDiscEnabled = Boolean(project?.manualDiscountRateEnabled);
  const manualDiscPercent = hasValue(project?.manualDiscountPercent) ? normalizePercentRate(project.manualDiscountPercent) : null;

  const shouldApplyDiscount = project?.discountIncluded === true || project?.discountIncluded === false
    ? Boolean(project.discountIncluded)
    : Boolean(hasValue(project.discountId) || cstmDiscPercent !== null);

  const rawDiscountPercent = shouldApplyDiscount
    ? (hasManualDiscToggle
        ? (manualDiscEnabled && manualDiscPercent !== null ? manualDiscPercent : setupDiscountPercent)
        : (cstmDiscPercent ?? setupDiscountPercent))
    : 0;
  const discountPercent = clamp(rawDiscountPercent, 0, 1);

  const subtotal = materialCost + downspoutCost + leafGuardCost + tripFeePrice + extrasPrice;

  const rawDepositPercent = project.depositPercent ?? project.deposit_percent;
  const shouldApplyDeposit = project?.depositIncluded === true || project?.depositIncluded === false
    ? Boolean(project.depositIncluded) : hasValue(rawDepositPercent);
  const depositRate = shouldApplyDeposit ? normalizePercentRate(rawDepositPercent) : 0;

  const fin = computeFinancialSummary({ subtotal, discountRate: discountPercent, depositRate });

  return {
    gated: false,
    pricing: {
      manufacturerRate, setupManufacturerRate: setupMfrRate,
      totalGutter, totalDownspouts, materialCost, downspoutCost,
      leafGuardUnitPrice, leafGuardCost,
      tripFeeLookup, tripFeePrice,
      totalEndCaps, derivedEndCaps,
      extrasPrice, subtotal,
      discountPercent, ...fin,
      depositRate, depositPercentDisplay: depositRate * 100,
      gutterQuantities, downspoutFootages,
      sectionGutterPrices, sectionDownspoutPrices,
    },
  };
}

// ─── Materials Calculator ──────────────────────────────────

const GUTTER_COIL_EXTRA_FT = 6;
const GUTTER_COIL_LBS_PER_FT = 0.48;
const HIDDEN_HANGERS_DIVISOR = 2;
const HIDDEN_HANGERS_BASE = 3;
const DOWNPIPE_LENGTH_FT = 10;
const INTERNAL_SCREWS_PER_OFFSET = 6;
const INTERNAL_SCREWS_PER_ELBOW = 6;

function toNonNeg(v) { const n = asNumber(v); return n > 0 ? n : 0; }
function pickFirstText(...vals) { for (const v of vals) { const t = String(v ?? "").trim(); if (t) return t; } return ""; }
function ceilNonNeg(v) { return Math.ceil(toNonNeg(v)); }
function truncNonNeg(v) { return Math.trunc(toNonNeg(v)); }

function normalizeSection(s) {
  const src = s && typeof s === "object" ? s : {};
  return {
    sides: toNonNeg(src.sides ?? src.segments),
    length: toNonNeg(src.length),
    height: toNonNeg(src.height),
    downspoutQty: toNonNeg(src.downspoutQty ?? src.downspout_qty),
    gutterColor: pickFirstText(src.gutterColor),
    downspoutColor: pickFirstText(src.downspoutColor, src.gutterColor),
  };
}

function dominantColor(sections, key) {
  const tally = new Map();
  sections.forEach((s) => { const c = pickFirstText(s?.[key]); if (c) tally.set(c, (tally.get(c) || 0) + 1); });
  let winner = "", best = -1;
  tally.forEach((count, color) => { if (count > best) { winner = color; best = count; } });
  return winner;
}

function deriveMetricsFromSections(rows) {
  const sections = (Array.isArray(rows) ? rows : []).map(normalizeSection);
  const totalGutterFt = sections.reduce((s, sec) => s + toNonNeg(computeGutterQty(sec.sides, sec.length)), 0);
  const totalDownspoutFt = sections.reduce((s, sec) => s + toNonNeg(computeDownspoutFootage(sec.height, sec.downspoutQty)), 0);
  const totalDownspoutQty = sections.reduce((s, sec) => s + toNonNeg(sec.downspoutQty), 0);
  const endCaps = deriveEndCapsFromSections(sections.map((s) => ({ sides: s.sides, length: s.length, height: s.height, downspoutQty: s.downspoutQty })));
  const endCapsPerSide = (endCaps?.groups || []).reduce((s, g) => s + toNonNeg(g?.value), 0);
  return { gutterColor: dominantColor(sections, "gutterColor"), downspoutColor: dominantColor(sections, "downspoutColor"), totalGutterFt, totalDownspoutFt, totalDownspoutQty, rightEndCapsQty: endCapsPerSide, leftEndCapsQty: endCapsPerSide };
}

export function calculateMaterials(projectData = {}) {
  const derived = deriveMetricsFromSections(projectData.sections);
  const pickNum = (pref, fb) => (pref != null && Number.isFinite(Number(pref))) ? toNonNeg(pref) : toNonNeg(fb);

  const kStyleGutterColor = pickFirstText(projectData.gutterColor, derived.gutterColor) || "--";
  const resolvedDownspoutColor = pickFirstText(projectData.downspoutColor, derived.downspoutColor, kStyleGutterColor) || "--";

  const totalGutterFt = pickNum(projectData.totalGutterFt, derived.totalGutterFt);
  const totalDownspoutFt = pickNum(projectData.totalDownspoutFt, derived.totalDownspoutFt);
  const totalDownspoutQty = pickNum(projectData.totalDownspoutQty, derived.totalDownspoutQty);
  const rightEndCapsQty = pickNum(projectData.rightEndCapsQty, derived.rightEndCapsQty);
  const leftEndCapsQty = pickNum(projectData.leftEndCapsQty, derived.leftEndCapsQty);

  const zipScrewsQty = toNonNeg(projectData.zipScrewsQty);
  const sprayPaintQty = toNonNeg(projectData.sprayPaintQty);
  const boxScrewsQty = toNonNeg(projectData.boxScrewsQty);

  const gutterCoilTotalFt = totalGutterFt + GUTTER_COIL_EXTRA_FT;
  const gutterCoilTotalLbs = gutterCoilTotalFt * GUTTER_COIL_LBS_PER_FT;
  const hiddenHangersQty = truncNonNeg(gutterCoilTotalFt / HIDDEN_HANGERS_DIVISOR + HIDDEN_HANGERS_BASE);
  const downpipeQty = ceilNonNeg(totalDownspoutFt / DOWNPIPE_LENGTH_FT);
  const onePieceOffsetQty = ceilNonNeg(totalDownspoutQty);
  const elbowQty = onePieceOffsetQty;
  const totalEndcaps = rightEndCapsQty + leftEndCapsQty;
  const internalScrews = onePieceOffsetQty * INTERNAL_SCREWS_PER_OFFSET + elbowQty * INTERNAL_SCREWS_PER_ELBOW;

  return {
    gutterCoil: { totalFt: gutterCoilTotalFt, totalLbs: gutterCoilTotalLbs, color: kStyleGutterColor },
    endCaps: { right: { qty: rightEndCapsQty, color: kStyleGutterColor }, left: { qty: leftEndCapsQty, color: kStyleGutterColor } },
    zipScrews: { qty: zipScrewsQty, color: kStyleGutterColor },
    downpipe: { qty: downpipeQty, color: kStyleGutterColor },
    onePieceOffset: { qty: onePieceOffsetQty, color: kStyleGutterColor },
    elbow: { qty: elbowQty, color: kStyleGutterColor },
    sprayPaint: { qty: sprayPaintQty, color: kStyleGutterColor },
    internal: { totalDownspouts: totalDownspoutQty, totalEndcaps, rectangularOutlets: elbowQty, internalScrews, hiddenHangers: hiddenHangersQty, boxScrews: boxScrewsQty },
    colors: { kStyleGutterColor, downspoutColor: resolvedDownspoutColor },
    source: { totalGutterFt, totalDownspoutFt, totalDownspoutQty, rightEndCapsQty, leftEndCapsQty },
  };
}
