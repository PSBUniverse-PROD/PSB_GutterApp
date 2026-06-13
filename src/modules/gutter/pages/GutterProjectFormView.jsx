"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Container, Row, Col, Form } from "react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowLeft, faCheck, faPrint, faGear, faLayerGroup, faCirclePlus } from "@fortawesome/free-solid-svg-icons";
import { faFolderOpen, faTrashCan, faFileLines } from "@fortawesome/free-regular-svg-icons";
import { Button, Card, toastError, toastSuccess, toastWarning } from "@/shared/components/ui";
import { saveGutterProject } from "../data/gutter.actions";
import styles from "./GutterProject.module.css";
import {
  hasValue, asNumber, calculateQuote, formatCurrency, formatPercentLabel, toDisplayPercentValue,
  normalizeStatuses, normalizeColors, normalizeManufacturers, normalizeLeafGuards,
  normalizeTripRates, normalizeDiscounts,
  createInitialProject, emptySection, emptyExtra, mapHeaderToProject, buildGutterProjectSnapshot,
} from "../data/gutter.data";

const MIN_SECTIONS = 1;
const MAX_SECTIONS = 10;
const MIN_SIDE_OR_DS = 1;
const MAX_SIDE_OR_DS = 10;

function normalizePercentRateValue(value) {
  if (!hasValue(value)) return 0;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(1, Math.max(0, n > 1 ? n / 100 : n));
}

export default function GutterProjectFormView({ mode = "create", projectId = null, setup = {}, projectData = null }) {
  const router = useRouter();
  const isEdit = mode === "edit" && hasValue(projectId);

  // ─── Parse setup data ──────────────────────────────────
  const statuses = useMemo(() => normalizeStatuses(setup.statuses), [setup.statuses]);
  const colors = useMemo(() => normalizeColors(setup.colors), [setup.colors]);
  const manufacturers = useMemo(() => normalizeManufacturers(setup.manufacturers), [setup.manufacturers]);
  const leafGuards = useMemo(() => normalizeLeafGuards(setup.leafGuards), [setup.leafGuards]);
  const tripFeeRates = useMemo(() => normalizeTripRates(setup.tripRates), [setup.tripRates]);
  const discounts = useMemo(() => normalizeDiscounts(setup.discounts), [setup.discounts]);
  const companyProfile = useMemo(() => {
    const c = Array.isArray(setup.company) ? setup.company[0] : setup.company;
    return c ? { name: c.comp_name || c.short_name || "—", email: c.comp_email || "—", phone: c.comp_phone || "—" } : { name: "—", email: "—", phone: "—" };
  }, [setup.company]);

  // Setup for quote calc
  const quoteSetup = useMemo(() => ({
    materialManufacturer: manufacturers.map((r) => ({ id: r.manufacturer_id, name: r.name, rate: r.rate })),
    leafGuard: leafGuards.map((r) => ({ id: r.leaf_guard_id, name: r.name, price: r.price })),
    tripRates: tripFeeRates.map((r) => ({ id: r.trip_id, label: r.label, rate: r.rate })),
    discounts: discounts.map((r) => ({ id: r.discount_id, percent: r.percentage })),
  }), [manufacturers, leafGuards, tripFeeRates, discounts]);

  const buildInitialProject = useCallback(() => {
    if (isEdit && projectData?.projectHeader) {
      return mapHeaderToProject(projectData.projectHeader, projectData.projectSides || [], projectData.projectExtras || []);
    }
    const base = createInitialProject();
    return {
      ...base,
      statusId: String(statuses[0]?.status_id || ""),
      manufacturerId: String(manufacturers[0]?.manufacturer_id || ""),
      tripId: String(tripFeeRates[0]?.trip_id || ""),
    };
  }, [isEdit, projectData, statuses, manufacturers, tripFeeRates]);

  // ─── Warnings ──────────────────────────────────────────
  useEffect(() => {
    if (setup.sourceErrors?.length > 0) {
      toastWarning(`Some setup sources failed: ${setup.sourceErrors.join(", ")}.`, "Gutter Setup");
    }
  }, [setup.sourceErrors]);

  // ─── Project state ────────────────────────────────────
  const [project, setProject] = useState(() => buildInitialProject());
  const [baselineSnapshot, setBaselineSnapshot] = useState(() =>
    buildGutterProjectSnapshot(buildInitialProject(), quoteSetup),
  );

  const [saving, setSaving] = useState(false);
  const [navigatingWorkOrder, setNavigatingWorkOrder] = useState(false);
  const [navigatingPurchaseOrder, setNavigatingPurchaseOrder] = useState(false);
  const [validationErrors, setValidationErrors] = useState({ customer: false, projectName: false });

  // Filter colors by selected manufacturer (dependent filtering)
  const colorsByManufacturer = useMemo(() => {
    const selectedMfrId = project?.manufacturerId;
    if (!selectedMfrId) return colors;
    return colors.filter((c) => String(c.manufacturer_id) === String(selectedMfrId));
  }, [colors, project]);

  // ─── Print mode ────────────────────────────────────────
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.classList.add("gutter-quote-print-mode");
    return () => document.body.classList.remove("gutter-quote-print-mode");
  }, []);

  // ─── Dependent filtering: reset colors when manufacturer changes ──────
  const prevManufacturerRef = useRef(project?.manufacturerId);
  useEffect(() => {
    const prevMfrId = prevManufacturerRef.current;
    const newMfrId = project?.manufacturerId;
    if (prevMfrId !== newMfrId) {
      prevManufacturerRef.current = newMfrId;
      // Clear color selections when manufacturer changes
      setProject((p) => ({
        ...p,
        sections: (p.sections || []).map((s) => ({
          ...s,
          colorId: "",
          downspoutColorId: "",
        })),
      }));
    }
  }, [project?.manufacturerId]);

  // ─── Field helpers ─────────────────────────────────────
  const updateField = (field, value) => setProject((p) => ({ ...p, [field]: value }));

  const normalizeBoundedInt = (value, min, max) => {
    if (value === "") return "";
    const n = Number(value);
    if (!Number.isFinite(n)) return "";
    return String(Math.min(max, Math.max(min, Math.trunc(n))));
  };

  const normalizeBoundedPercent = (value) => {
    if (value === "") return "";
    const n = Number(value);
    if (!Number.isFinite(n)) return "";
    return String(Math.min(100, Math.max(0, n)));
  };

  const updateSection = (i, field, value) => {
    setProject((p) => {
      const sections = [...(p.sections || [])];
      sections[i] = { ...sections[i], [field]: value };
      return { ...p, sections };
    });
  };

  const addSection = () => {
    if ((project.sections || []).length >= MAX_SECTIONS) return;
    setProject((p) => ({ ...p, sections: [...(p.sections || []), emptySection()] }));
  };

  const removeSection = (i) => {
    setProject((p) => ({
      ...p,
      sections: (p.sections || []).length <= MIN_SECTIONS ? p.sections : (p.sections || []).filter((_, idx) => idx !== i),
    }));
  };

  const updateExtra = (i, field, value) => {
    setProject((p) => {
      const extras = [...(p.extras || [])];
      extras[i] = { ...extras[i], [field]: value };
      return { ...p, extras };
    });
  };

  const addExtra = () => {
    if ((project.extras || []).length >= 4) return;
    setProject((p) => ({ ...p, extras: [...(p.extras || []), emptyExtra()] }));
  };

  const removeExtra = (i) => {
    setProject((p) => ({ ...p, extras: (p.extras || []).filter((_, idx) => idx !== i) }));
  };

  // ─── Quote calculation ─────────────────────────────────
  const quoteResult = useMemo(() => {
    if (!project) return null;
    return calculateQuote(project, quoteSetup);
  }, [project, quoteSetup]);

  const currentSnapshot = useMemo(
    () => buildGutterProjectSnapshot(project, quoteSetup),
    [project, quoteSetup],
  );
  const hasChanges = currentSnapshot !== baselineSnapshot;

  const selectedManufacturerName = useMemo(() => {
    const m = manufacturers.find((m) => String(m.manufacturer_id) === String(project?.manufacturerId));
    return m?.name || "—";
  }, [manufacturers, project?.manufacturerId]);

  const selectedLeafGuardName = useMemo(() => {
    if (!project?.leafGuardIncluded) return "";
    const lg = leafGuards.find((l) => String(l.leaf_guard_id) === String(project?.leafGuardId));
    return String(lg?.name || "").trim();
  }, [leafGuards, project?.leafGuardId, project?.leafGuardIncluded]);

  const colorNameById = useMemo(() => {
    const map = {};
    (colors || []).forEach((c) => { map[String(c.color_id)] = c.name || ""; });
    return map;
  }, [colors]);

  // ─── Section breakdown ─────────────────────────────────
  const sectionBreakdownRows = useMemo(() => {
    if (!project) return [];
    const toInt = (v) => { if (v === "" || v == null) return null; const n = Number(v); return Number.isFinite(n) ? Math.trunc(n) : null; };
    const gQty = Array.isArray(quoteResult?.pricing?.gutterQuantities) ? quoteResult.pricing.gutterQuantities : [];
    const dsFootages = Array.isArray(quoteResult?.pricing?.downspoutFootages) ? quoteResult.pricing.downspoutFootages : [];

    return (project.sections || []).map((s, i) => {
      const sides = toInt(s.sides);
      const ft = toInt(s.length);
      const heightFt = toInt(s.height);
      const dsQty = toInt(s.downspoutQty);
      const gutterFt = Number(gQty[i] || 0);
      const downspoutFt = Number(dsFootages[i] || 0);
      const gutterColor = String(colorNameById[String(s.colorId)] || "").trim();
      const downspoutColor = String(colorNameById[String(s.downspoutColorId)] || "").trim();
      const hasAny = sides !== null || ft !== null || heightFt !== null || dsQty !== null || gutterFt > 0 || downspoutFt > 0 || gutterColor || downspoutColor;
      if (!hasAny) return null;
      return { section: i + 1, gutterColor, sides, ft, heightFt, gutterFt, downspoutColor, dsQty, downspoutFt, endCapsRight: sides, endCapsLeft: sides };
    }).filter(Boolean);
  }, [project, colorNameById, quoteResult]);

  const totalEndCapsNeeded = useMemo(() =>
    sectionBreakdownRows.reduce((t, r) => ({
      right: t.right + (Number.isFinite(Number(r.endCapsRight)) ? Number(r.endCapsRight) : 0),
      left: t.left + (Number.isFinite(Number(r.endCapsLeft)) ? Number(r.endCapsLeft) : 0),
    }), { right: 0, left: 0 }),
  [sectionBreakdownRows]);

  const extrasMaterialRows = useMemo(() => {
    if (!project?.extrasIncluded) return [];
    return (project.extras || []).map((e) => {
      const desc = String(e.description || "").trim();
      const qty = Number(e.qty);
      const price = Number(e.unitPrice);
      if (!desc && !Number.isFinite(qty) && !Number.isFinite(price)) return null;
      return { description: desc || "—", qty: Number.isFinite(qty) ? Math.trunc(qty) : null, unitPrice: Number.isFinite(price) ? price : null };
    }).filter(Boolean);
  }, [project?.extrasIncluded, project?.extras]);

  const hasBreakdownData = sectionBreakdownRows.length > 0 || Boolean(selectedLeafGuardName) || extrasMaterialRows.length > 0;

  // ─── Save ──────────────────────────────────────────────
  const saveProject = useCallback(async () => {
    if (!project) return;

    const toIntOrNull = (v) => { if (v === "" || v == null) return null; const n = Number(v); return Number.isFinite(n) ? Math.trunc(n) : null; };
    const toNumOrNull = (v) => { if (v === "" || v == null) return null; const n = Number(v); return Number.isFinite(n) ? n : null; };

    const customerMissing = !project.customer?.trim();
    const projectNameMissing = !project.projectName?.trim();
    setValidationErrors({ customer: customerMissing, projectName: projectNameMissing });

    if (!project.statusId || !project.manufacturerId || !project.tripId) {
      toastError("Please select Status, Manufacturer, and Trip Rate.", "Validation");
      return;
    }
    if (customerMissing || projectNameMissing) {
      toastError("Customer and Project Name are required before saving.", "Validation");
      return;
    }
    if (project.leafGuardIncluded && !project.leafGuardId) {
      toastError("Please select a Leaf Guard reference.", "Validation");
      return;
    }
    if (project.discountIncluded && !project.discountId) {
      toastError("Please select a Discount reference.", "Validation");
      return;
    }

    setSaving(true);
    try {
      const headerPayload = {
        project_name: project.projectName,
        customer: project.customer,
        project_address: project.projectAddress,
        status_id: toIntOrNull(project.statusId),
        date: project.date || null,
        trip_id: toIntOrNull(project.tripId),
        manufacturer_id: toIntOrNull(project.manufacturerId),
        discount_id: project.discountIncluded ? toIntOrNull(project.discountId) : null,
        request_link: project.requestLink,
        leaf_guard_id: project.leafGuardIncluded ? toIntOrNull(project.leafGuardId) : null,
        cstm_trip_rate: project.manualTripRateEnabled ? toNumOrNull(project.manualTripRate) : null,
        cstm_manufacturer_rate: project.manualManufacturerRateEnabled ? toNumOrNull(project.manualManufacturerRate) : null,
        cstm_discount_percentage: project.discountIncluded && project.manualDiscountRateEnabled ? normalizePercentRateValue(project.manualDiscountPercent) : null,
        cstm_leaf_guard_price: project.leafGuardIncluded && project.manualLeafGuardRateEnabled ? toNumOrNull(project.manualLeafGuardRate) : null,
        deposit_percent: project.depositIncluded ? toNumOrNull(project.depositPercent) : null,
      };

      const sideRows = (project.sections || []).map((s, i) => {
        const segments = toIntOrNull(s.sides);
        const length = toNumOrNull(s.length);
        const height = toNumOrNull(s.height);
        const dsQty = toIntOrNull(s.downspoutQty);
        const gc = toIntOrNull(s.colorId);
        const dc = toIntOrNull(s.downspoutColorId);
        if (segments === null && length === null && height === null && dsQty === null && gc === null && dc === null) return null;
        return { side_index: i + 1, segments, length, height, downspout_qty: dsQty, gutter_color_id: gc, downspout_color_id: dc };
      }).filter(Boolean);

      const extraRows = project.extrasIncluded
        ? (project.extras || []).map((e) => {
            const qty = toIntOrNull(e.qty);
            const price = toNumOrNull(e.unitPrice);
            const name = String(e.description || "").trim();
            if (!name && qty === null && price === null) return null;
            return { name, quantity: qty, unit_price: price };
          }).filter(Boolean)
        : [];

      const result = await saveGutterProject({
        isEdit,
        projectId: isEdit ? toIntOrNull(projectId) : null,
        header: headerPayload,
        sides: sideRows,
        extras: extraRows,
      });

      setBaselineSnapshot(currentSnapshot);
      toastSuccess("Project saved.", "Gutter Project");
      if (!isEdit && result?.projId) {
        router.push(`/gutter/${result.projId}`);
      } else {
        router.refresh();
      }
    } catch (err) {
      toastError(err?.message || "Error saving project.", "Gutter Project");
    } finally {
      setSaving(false);
    }
  }, [project, isEdit, projectId, router, currentSnapshot]);

  // ─── Format helpers ────────────────────────────────────
  const fmt = (n) => typeof n === "number" ? n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—";
  const fmtFootage = (n) => { const v = Number(n || 0); return Number.isFinite(v) ? v.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : "0"; };
  const fmtCurrency = (n) => `$${fmt(Number(n || 0))}`;
  const displayOrDash = (v) => hasValue(v) ? String(v).trim() : "—";
  const displayIntOrDash = (v) => v == null || v === "" ? "—" : String(Math.trunc(Number(v)));

  const displayDate = project?.date
    ? new Date(project.date).toLocaleDateString("en-US", { year: "numeric", month: "2-digit", day: "2-digit" })
    : "—";

  const discountAmount = Number(quoteResult?.pricing?.discountAmount || 0);
  const hasDiscount = discountAmount > 0;
  const title = isEdit ? "Edit Gutter Project" : "Gutter Project";
  const subtitle = isEdit ? project?.projectName || project?.projId || "—" : "Create a gutter quote project";
  const toggleIdPrefix = isEdit ? `edit-${projectId}` : "new";
  const getToggleId = (name) => `gutter-toggle-${toggleIdPrefix}-${name}`;
  const moneyValueStyle = { minWidth: 136, fontVariantNumeric: "tabular-nums" };

  if (!project) return <Container className="py-4">Loading...</Container>;

  return (
    <div className={`gp ${styles.gpPage} gutter-quote-review-page`}>
      {/* ─── Compact Top Header ─── */}
      <div className={styles.gpHeader}>
        <div className={styles.gpHeaderLeft}>
          <Link href="/gutter" className={styles.gpBackLink}>
            <FontAwesomeIcon icon={faArrowLeft} aria-hidden="true" />
          </Link>
          <div className={styles.gpHeaderTitle}>
            <h1 className={styles.gpTitle}>{title}</h1>
            <span className={styles.gpSubtitle}>{subtitle}</span>
          </div>
          <div className={styles.gpHeaderMeta}>
            <div className={styles.gpMetaItem}>
              <span className={styles.gpMetaLabel}>ID</span>
              <span className={styles.gpMetaValue}>{project.projId ? String(project.projId) : "New"}</span>
            </div>
            <div className={styles.gpMetaItem}>
              <span className={styles.gpMetaLabel}>Date</span>
              <span className={styles.gpMetaValue}>{displayDate}</span>
            </div>
          </div>
        </div>
        <div className={`${styles.gpHeaderActions} gutter-print-toolbar`}>
          <Button variant="success" onClick={saveProject} disabled={saving} loading={saving}>
            <FontAwesomeIcon icon={faCheck} className="me-1" /> Save Project
          </Button>
          {hasChanges && (
            <span className="small text-danger fw-semibold align-self-center">
              Unsaved changes: save to re-enable action buttons.
            </span>
          )}
          {!hasChanges && isEdit && (
            <Button variant="outline-primary" onClick={() => { setNavigatingWorkOrder(true); router.push(`/gutter/${projectId}/work-order`); }} disabled={navigatingWorkOrder} loading={navigatingWorkOrder}>Work Order</Button>
          )}
          {!hasChanges && isEdit && (
            <Button variant="outline-primary" onClick={() => { setNavigatingPurchaseOrder(true); router.push(`/gutter/${projectId}/purchase-order`); }} disabled={navigatingPurchaseOrder} loading={navigatingPurchaseOrder}>Purchase Order</Button>
          )}
          {!hasChanges && (
            <Button variant="secondary" onClick={() => router.push(`/gutter/${projectId}/print`)}>
              <FontAwesomeIcon icon={faPrint} className="me-1" /> Print / PDF
            </Button>
          )}
        </div>
      </div>

      {/* ─── Workspace Body ─── */}
      <div className={`${styles.gpBody} gutter-quote-review-grid`}>
        {/* ─── LEFT — Form ─── */}
        <div className={`${styles.gpMain} gutter-quote-form-pane`}>

          {/* Project Details */}
          <div className={styles.gpSection}>
            <div className={styles.gpSectionHeader}>
              <FontAwesomeIcon icon={faFolderOpen} /> Project Details
            </div>
            <div className={styles.gpSectionBody}>
              <Row className="g-2">
                <Col md={6}>
                  <Form.Group>
                    <Form.Label className={styles.gpFormLabel}>Status</Form.Label>
                    <Form.Select className="quote-field-control" value={project.statusId || ""} onChange={(e) => updateField("statusId", e.target.value)}>
                      <option value="">Select status...</option>
                      {statuses.map((s) => <option key={s.status_id} value={String(s.status_id)}>{s.name}</option>)}
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group>
                    <Form.Label className={styles.gpFormLabel}>Date</Form.Label>
                    <Form.Control className="quote-field-control" type="date" value={project.date || ""} onChange={(e) => updateField("date", e.target.value)} />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group controlId="projectCustomer">
                    <Form.Label className={styles.gpFormLabel}>Customer <span style={{ color: "#d63333" }}>*</span></Form.Label>
                    <Form.Control
                      className="quote-field-control"
                      value={project.customer || ""}
                      isInvalid={validationErrors.customer}
                      onChange={(e) => {
                        updateField("customer", e.target.value);
                        if (validationErrors.customer && e.target.value.trim()) {
                          setValidationErrors((prev) => ({ ...prev, customer: false }));
                        }
                      }}
                    />
                    <Form.Control.Feedback type="invalid">Customer is required.</Form.Control.Feedback>
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group controlId="projectName">
                    <Form.Label className={styles.gpFormLabel}>Project Name <span style={{ color: "#d63333" }}>*</span></Form.Label>
                    <Form.Control
                      className="quote-field-control"
                      value={project.projectName || ""}
                      isInvalid={validationErrors.projectName}
                      onChange={(e) => {
                        updateField("projectName", e.target.value);
                        if (validationErrors.projectName && e.target.value.trim()) {
                          setValidationErrors((prev) => ({ ...prev, projectName: false }));
                        }
                      }}
                    />
                    <Form.Control.Feedback type="invalid">Project Name is required.</Form.Control.Feedback>
                  </Form.Group>
                </Col>
                <Col md={12}>
                  <Form.Group>
                    <Form.Label className={styles.gpFormLabel}>Project Address</Form.Label>
                    <Form.Control className="quote-field-control" as="textarea" rows={2} value={project.projectAddress || ""} onChange={(e) => updateField("projectAddress", e.target.value)} />
                  </Form.Group>
                </Col>
                <Col md={12}>
                  <Form.Group>
                    <Form.Label className={styles.gpFormLabel}>Request Link (Missive)</Form.Label>
                    <Form.Control className="quote-field-control" placeholder="Paste Missive request link" value={project.requestLink || ""} onChange={(e) => updateField("requestLink", e.target.value)} />
                  </Form.Group>
                </Col>
              </Row>
            </div>
          </div>

          {/* Manufacturer & Trip Fee */}
          <div className={styles.gpSection}>
            <div className={styles.gpSectionHeader}>
              <FontAwesomeIcon icon={faGear} /> Manufacturer &amp; Trip Fee
            </div>
            <div className={styles.gpSectionBody}>
              <Row className="g-2">
                <Col md={project.manualManufacturerRateEnabled ? 6 : 9}>
                  <Form.Group>
                    <Form.Label className={styles.gpFormLabel}>Manufacturer</Form.Label>
                    <Form.Select className="quote-field-control" value={project.manufacturerId || ""} onChange={(e) => updateField("manufacturerId", e.target.value)}>
                      <option value="">Select manufacturer...</option>
                      {manufacturers.map((m) => <option key={m.manufacturer_id} value={String(m.manufacturer_id)}>{m.name} (${m.rate}/lf)</option>)}
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col md={3} className="d-flex align-items-end">
                  <div className="additionals-toggle-row toggle-inline-control">
                    <Form.Check type="switch" id={getToggleId("manufacturer-manual")} className="m-0" checked={Boolean(project.manualManufacturerRateEnabled)} onChange={(e) => updateField("manualManufacturerRateEnabled", e.target.checked)} />
                    <label className="additionals-toggle-label mb-0" htmlFor={getToggleId("manufacturer-manual")}>Manual Rate</label>
                  </div>
                </Col>
                {project.manualManufacturerRateEnabled && (
                  <Col md={3}>
                    <Form.Group>
                      <Form.Label className={styles.gpFormLabel}>Manual Rate</Form.Label>
                      <Form.Control className="quote-field-control" type="number" step="0.01" value={project.manualManufacturerRate || ""} onChange={(e) => updateField("manualManufacturerRate", e.target.value)} />
                    </Form.Group>
                  </Col>
                )}
                <Col md={project.manualTripRateEnabled ? 6 : 9}>
                  <Form.Group>
                    <Form.Label className={styles.gpFormLabel}>Trip Fee</Form.Label>
                    <Form.Select className="quote-field-control" value={project.tripId || ""} onChange={(e) => updateField("tripId", e.target.value)}>
                      <option value="">Select trip fee...</option>
                      {tripFeeRates.map((t) => <option key={t.trip_id} value={String(t.trip_id)}>{t.label} (${t.rate})</option>)}
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col md={3} className="d-flex align-items-end">
                  <div className="additionals-toggle-row toggle-inline-control">
                    <Form.Check type="switch" id={getToggleId("trip-manual")} className="m-0" checked={Boolean(project.manualTripRateEnabled)} onChange={(e) => updateField("manualTripRateEnabled", e.target.checked)} />
                    <label className="additionals-toggle-label mb-0" htmlFor={getToggleId("trip-manual")}>Manual Trip</label>
                  </div>
                </Col>
                {project.manualTripRateEnabled && (
                  <Col md={3}>
                    <Form.Group>
                      <Form.Label className={styles.gpFormLabel}>Manual Trip Rate</Form.Label>
                      <Form.Control className="quote-field-control" type="number" step="0.01" value={project.manualTripRate || ""} onChange={(e) => updateField("manualTripRate", e.target.value)} />
                    </Form.Group>
                  </Col>
                )}
              </Row>
            </div>
          </div>

          {/* Gutter Sections */}
          <div className={styles.gpSection}>
            <div className={styles.gpSectionHeader}>
              <FontAwesomeIcon icon={faLayerGroup} /> Gutter &amp; Downspout Sections
              <span className={styles.gpSectionCount}>{(project.sections || []).length}/{MAX_SECTIONS}</span>
              <Button variant="secondary" className={styles.gpSectionAction} onClick={addSection} disabled={(project.sections || []).length >= MAX_SECTIONS}>+ Add Section</Button>
            </div>
            <div className={styles.gpSectionBody}>
              {(project.sections || []).map((section, i) => (
                <div key={i} className={styles.gpSectionCard}>
                  <div className={styles.gpSectionCardHeader}>
                    <span className={styles.gpSectionCardTitle}>Section {i + 1}</span>
                    <Button variant="secondary" disabled={(project.sections || []).length <= MIN_SECTIONS} onClick={() => removeSection(i)}>Remove</Button>
                  </div>
                  <div className={styles.gpSubsection}>
                    <div className={styles.gpSubsectionLabel}>Gutter</div>
                    <Row className="g-2">
                      <Col md={6} lg={3}>
                        <Form.Group>
                          <Form.Label className={styles.gpFormLabel}>Color</Form.Label>
                          <Form.Select className="quote-field-control" value={section.colorId || ""} onChange={(e) => updateSection(i, "colorId", e.target.value)}>
                            <option value="">Select...</option>
                            {colorsByManufacturer.map((c) => <option key={c.color_id} value={String(c.color_id)}>{c.name}</option>)}
                          </Form.Select>
                        </Form.Group>
                      </Col>
                      <Col md={6} lg={3}>
                        <Form.Group>
                          <Form.Label className={styles.gpFormLabel}>Sides</Form.Label>
                          <Form.Control className="quote-field-control" type="number" min={MIN_SIDE_OR_DS} max={MAX_SIDE_OR_DS} step="1" value={section.sides || ""} onChange={(e) => updateSection(i, "sides", normalizeBoundedInt(e.target.value, MIN_SIDE_OR_DS, MAX_SIDE_OR_DS))} />
                        </Form.Group>
                      </Col>
                      <Col md={6} lg={3}>
                        <Form.Group>
                          <Form.Label className={styles.gpFormLabel}>Length (LF)</Form.Label>
                          <Form.Control className="quote-field-control" type="number" step="0.01" value={section.length || ""} onChange={(e) => updateSection(i, "length", e.target.value)} />
                        </Form.Group>
                      </Col>
                      <Col md={6} lg={3}>
                        <Form.Group>
                          <Form.Label className={styles.gpFormLabel}>Height (FT)</Form.Label>
                          <Form.Control className="quote-field-control" type="number" step="0.01" value={section.height || ""} onChange={(e) => updateSection(i, "height", e.target.value)} />
                        </Form.Group>
                      </Col>
                    </Row>
                  </div>
                  <div className={styles.gpSubsection}>
                    <div className={styles.gpSubsectionLabel}>Downspout</div>
                    <Row className="g-2">
                      <Col md={6}>
                        <Form.Group>
                          <Form.Label className={styles.gpFormLabel}>Color</Form.Label>
                          <Form.Select className="quote-field-control" value={section.downspoutColorId || ""} onChange={(e) => updateSection(i, "downspoutColorId", e.target.value)}>
                            <option value="">Select...</option>
                            {colorsByManufacturer.map((c) => <option key={c.color_id} value={String(c.color_id)}>{c.name}</option>)}
                          </Form.Select>
                        </Form.Group>
                      </Col>
                      <Col md={6}>
                        <Form.Group>
                          <Form.Label className={styles.gpFormLabel}>Quantity</Form.Label>
                          <Form.Control className="quote-field-control" type="number" min={MIN_SIDE_OR_DS} max={MAX_SIDE_OR_DS} step="1" value={section.downspoutQty || ""} onChange={(e) => updateSection(i, "downspoutQty", normalizeBoundedInt(e.target.value, MIN_SIDE_OR_DS, MAX_SIDE_OR_DS))} />
                        </Form.Group>
                      </Col>
                    </Row>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Additionals */}
          <div className={styles.gpSection}>
            <div className={styles.gpSectionHeader}>
              <FontAwesomeIcon icon={faCirclePlus} /> Additionals
            </div>
            <div className={styles.gpSectionBody}>
              {/* Leaf Guard */}
              <div className={styles.gpToggleBlock}>
                <div className="additionals-toggle-row additionals-toggle-include">
                  <Form.Check type="switch" id={getToggleId("leaf-guard")} className="m-0" checked={Boolean(project.leafGuardIncluded)} onChange={(e) => updateField("leafGuardIncluded", e.target.checked)} />
                  <label className="additionals-toggle-label" htmlFor={getToggleId("leaf-guard")}>Include Leaf Guard</label>
                </div>
              </div>
              {project.leafGuardIncluded && (
                <Row className="g-2 mb-3">
                  <Col md={project.manualLeafGuardRateEnabled ? 5 : 9}>
                    <Form.Group>
                      <Form.Label className={styles.gpFormLabel}>Leaf Guard</Form.Label>
                      <Form.Select className="quote-field-control" value={project.leafGuardId || ""} onChange={(e) => updateField("leafGuardId", e.target.value)}>
                        <option value="">Select leaf guard...</option>
                        {leafGuards.map((lg) => <option key={lg.leaf_guard_id} value={String(lg.leaf_guard_id)}>{lg.name} (${lg.price})</option>)}
                      </Form.Select>
                    </Form.Group>
                  </Col>
                  <Col md={3} className="d-flex align-items-end">
                    <div className="additionals-toggle-row toggle-inline-control">
                      <Form.Check type="switch" id={getToggleId("lg-manual")} className="m-0" checked={Boolean(project.manualLeafGuardRateEnabled)} onChange={(e) => updateField("manualLeafGuardRateEnabled", e.target.checked)} />
                      <label className="additionals-toggle-label" htmlFor={getToggleId("lg-manual")}>Manual LG Price</label>
                    </div>
                  </Col>
                  {project.manualLeafGuardRateEnabled && (
                    <Col md={4}>
                      <Form.Group>
                        <Form.Label className={styles.gpFormLabel}>Manual LG Price</Form.Label>
                        <Form.Control className="quote-field-control" type="number" step="0.01" value={project.manualLeafGuardRate || ""} onChange={(e) => updateField("manualLeafGuardRate", e.target.value)} />
                      </Form.Group>
                    </Col>
                  )}
                </Row>
              )}

              {/* Extras */}
              <div className={styles.gpToggleBlock}>
                <div className="additionals-toggle-row additionals-toggle-include">
                  <Form.Check type="switch" id={getToggleId("extras")} className="m-0" checked={Boolean(project.extrasIncluded)} onChange={(e) => updateField("extrasIncluded", e.target.checked)} />
                  <label className="additionals-toggle-label" htmlFor={getToggleId("extras")}>Include Extras</label>
                </div>
              </div>
              {project.extrasIncluded && (
                <div className="mb-3">
                  {(project.extras || []).map((extra, i) => (
                    <Row key={i} className="g-2 mb-2">
                      <Col md={5}>
                        <Form.Group>
                          <Form.Label className={styles.gpFormLabel}>Description</Form.Label>
                          <Form.Control className="quote-field-control" placeholder="Description" value={extra.description || ""} onChange={(e) => updateExtra(i, "description", e.target.value)} />
                        </Form.Group>
                      </Col>
                      <Col md={2}>
                        <Form.Group>
                          <Form.Label className={styles.gpFormLabel}>Qty</Form.Label>
                          <Form.Control className="quote-field-control" type="number" value={extra.qty || ""} onChange={(e) => updateExtra(i, "qty", e.target.value)} />
                        </Form.Group>
                      </Col>
                      <Col md={3}>
                        <Form.Group>
                          <Form.Label className={styles.gpFormLabel}>Unit Price</Form.Label>
                          <Form.Control className="quote-field-control" type="number" step="0.01" value={extra.unitPrice || ""} onChange={(e) => updateExtra(i, "unitPrice", e.target.value)} />
                        </Form.Group>
                      </Col>
                      <Col md={2} className="d-flex align-items-end">
                        <Button variant="secondary" onClick={() => removeExtra(i)}><FontAwesomeIcon icon={faTrashCan} aria-hidden="true" /></Button>
                      </Col>
                    </Row>
                  ))}
                  <Button variant="secondary" onClick={addExtra} disabled={(project.extras || []).length >= 4} className="mt-1">+ Add Extra</Button>
                </div>
              )}

              {/* Discount */}
              <div className={styles.gpToggleBlock}>
                <div className="additionals-toggle-row additionals-toggle-include">
                  <Form.Check type="switch" id={getToggleId("discount")} className="m-0" checked={Boolean(project.discountIncluded)} onChange={(e) => updateField("discountIncluded", e.target.checked)} />
                  <label className="additionals-toggle-label" htmlFor={getToggleId("discount")}>Include Discount</label>
                </div>
              </div>
              {project.discountIncluded && (
                <Row className="g-2 mb-3">
                  <Col md={project.manualDiscountRateEnabled ? 6 : 9}>
                    <Form.Group>
                      <Form.Label className={styles.gpFormLabel}>Discount</Form.Label>
                      <Form.Select className="quote-field-control" value={project.discountId || ""} onChange={(e) => updateField("discountId", e.target.value)}>
                        <option value="">Select discount...</option>
                        {discounts.map((d) => <option key={d.discount_id} value={String(d.discount_id)}>{formatPercentLabel(d.percentage)}% - {d.description}</option>)}
                      </Form.Select>
                    </Form.Group>
                  </Col>
                  <Col md={3} className="d-flex align-items-end">
                    <div className="additionals-toggle-row toggle-inline-control">
                      <Form.Check type="switch" id={getToggleId("disc-manual")} className="m-0" checked={Boolean(project.manualDiscountRateEnabled)} onChange={(e) => updateField("manualDiscountRateEnabled", e.target.checked)} />
                      <label className="additionals-toggle-label" htmlFor={getToggleId("disc-manual")}>Manual %</label>
                    </div>
                  </Col>
                  {project.manualDiscountRateEnabled && (
                    <Col md={3}>
                      <Form.Group>
                        <Form.Label className={styles.gpFormLabel}>Manual %</Form.Label>
                        <Form.Control className="quote-field-control" type="number" step="0.0001" min="0" max="1" value={project.manualDiscountPercent || ""} onChange={(e) => updateField("manualDiscountPercent", e.target.value)} />
                      </Form.Group>
                    </Col>
                  )}
                </Row>
              )}

              {/* Deposit */}
              <div className={styles.gpToggleBlock}>
                <div className="additionals-toggle-row additionals-toggle-include">
                  <Form.Check type="switch" id={getToggleId("deposit")} className="m-0" checked={Boolean(project.depositIncluded)} onChange={(e) => { updateField("depositIncluded", e.target.checked); if (!e.target.checked) updateField("depositPercent", ""); }} />
                  <label className="additionals-toggle-label" htmlFor={getToggleId("deposit")}>Include Deposit</label>
                </div>
              </div>
              {project.depositIncluded && (
                <Form.Group className="mt-2" style={{ maxWidth: 260 }}>
                  <Form.Label className={styles.gpFormLabel}>Deposit (%)</Form.Label>
                  <Form.Control className="quote-field-control" type="number" step="0.01" min="0" max="100" value={project.depositPercent || ""} onChange={(e) => updateField("depositPercent", normalizeBoundedPercent(e.target.value))} />
                  <Form.Text className="text-muted">Enter percentage (e.g. 20 for 20%).</Form.Text>
                </Form.Group>
              )}
            </div>
          </div>
        </div>

        {/* ─── RIGHT — Quote Preview ─── */}
        <div className={`${styles.gpSidebar} gutter-quote-preview-pane`}>
          <div className={styles.gpSection}>
            <div className={styles.gpSectionHeader}>
              <FontAwesomeIcon icon={faFileLines} /> Quote Preview
            </div>
            <div className={styles.gpSectionBody}>
              {quoteResult?.pricing ? (
                <div className="quote-document p-3" style={{ maxWidth: 560 }}>
                  <div className="d-flex justify-content-between align-items-start gap-3">
                    <div>
                      <h4 className="mb-1 fw-bold">{displayOrDash(companyProfile.name)}</h4>
                      <div className="small text-muted">{displayOrDash(companyProfile.email)}</div>
                      <div className="small text-muted">{displayOrDash(companyProfile.phone)}</div>
                    </div>
                    <div className="text-end small">
                      <div className="mb-1"><span className="text-muted me-1">Date</span><span className="fw-medium">{displayDate}</span></div>
                      <div><span className="text-muted me-1">Project ID</span><span className="fw-medium">{project.projId ? String(project.projId) : "Auto-generated"}</span></div>
                    </div>
                  </div>

                  <div className="quote-divider my-2" />

                  <div className="quote-review-columns">
                    <div className="quote-review-column quote-review-column-pricing">
                      <div className="mb-3 quote-project-details">
                        <div className="small text-uppercase text-muted fw-semibold mb-2">Project Details</div>
                        <div className="quote-project-details-stack">
                          {[
                            ["Customer", project.customer],
                            ["Project Name", project.projectName],
                            ["Address", project.projectAddress],
                            ["Manufacturer", selectedManufacturerName],
                          ].map(([label, val]) => (
                            <div key={label} className="quote-project-detail-item">
                              <span className="quote-project-detail-label">{label}</span>
                              <span className="quote-project-detail-value">{displayOrDash(val)}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="mb-4 quote-pricing-summary">
                        <h5 className="mb-3 fw-semibold">Pricing Summary</h5>
                        <div className="quote-price-row">
                          <span>Gutter k Style 6 Inch</span>
                          <span className="quote-price-value" style={moneyValueStyle}>{fmtCurrency(quoteResult.pricing.materialCost)}</span>
                        </div>
                        <div className="quote-price-subline">Total Gutter FT ({fmtFootage(quoteResult.pricing.totalGutter)})</div>
                        <div className="quote-price-row">
                          <span>3x4 Downspouts</span>
                          <span className="quote-price-value" style={moneyValueStyle}>{fmtCurrency(quoteResult.pricing.downspoutCost)}</span>
                        </div>
                        <div className="quote-price-subline">Total Downspout FT ({fmtFootage(quoteResult.pricing.totalDownspouts)})</div>

                        {Number(quoteResult.pricing.leafGuardCost || 0) > 0 && (
                          <div className="quote-price-row"><span>Leaf Guard</span><span className="quote-price-value" style={moneyValueStyle}>{fmtCurrency(quoteResult.pricing.leafGuardCost)}</span></div>
                        )}
                        {Number(quoteResult.pricing.tripFeePrice || 0) > 0 && (
                          <div className="quote-price-row"><span>Trip Fee</span><span className="quote-price-value" style={moneyValueStyle}>{fmtCurrency(quoteResult.pricing.tripFeePrice)}</span></div>
                        )}
                        {Number(quoteResult.pricing.extrasPrice || 0) > 0 && (
                          <div className="quote-price-row"><span>Extras</span><span className="quote-price-value" style={moneyValueStyle}>{fmtCurrency(quoteResult.pricing.extrasPrice)}</span></div>
                        )}

                        <div className="quote-price-gap" />
                        <div className="quote-price-row"><span className="text-muted">Subtotal</span><span className="quote-price-value" style={moneyValueStyle}>{fmtCurrency(quoteResult.pricing.subtotal)}</span></div>
                        <div className={`quote-price-row ${hasDiscount ? "quote-price-negative" : "text-muted"}`}>
                          <span>Discount ({(quoteResult.pricing.discountPercent * 100).toFixed(2)}%)</span>
                          <span className="quote-price-value" style={moneyValueStyle}>{hasDiscount ? `-${fmtCurrency(discountAmount)}` : fmtCurrency(0)}</span>
                        </div>

                        <div className="quote-price-gap" />
                        <div className="quote-price-row quote-price-row-total align-items-end">
                          <span className="quote-total-label">Project Total</span>
                          <span className="quote-total-value text-end" style={moneyValueStyle}>{fmtCurrency(quoteResult.pricing.projectTotal)}</span>
                        </div>
                        <div className={`quote-price-row mt-2 ${Number(quoteResult.pricing.depositPercentDisplay || 0) > 0 ? "quote-price-row-deposit-active" : ""}`}>
                          <span className="text-muted">Deposit ({fmt(quoteResult.pricing.depositPercentDisplay)}%)</span>
                          <span className="quote-price-value" style={moneyValueStyle}>{fmtCurrency(quoteResult.pricing.depositAmount)}</span>
                        </div>
                        <div className="quote-price-row align-items-end">
                          <span className="fw-semibold">Remaining Balance</span>
                          <span className="quote-balance-value text-end" style={moneyValueStyle}>{fmtCurrency(quoteResult.pricing.remainingBalance)}</span>
                        </div>
                      </div>
                    </div>

                    {hasBreakdownData && (
                      <div className="quote-review-column quote-review-column-material">
                        <div className="pt-3 quote-material-details" style={{ fontSize: "0.82rem" }}>
                          <div className="small text-uppercase text-muted fw-semibold mb-2">Material Details</div>
                          {sectionBreakdownRows.length > 0 && (
                            <>
                              <div className="fw-semibold mb-1" style={{ fontSize: "0.8rem" }}>Gutter k Style 6 Inch</div>
                              <table className="quote-material-table quote-material-table--gutter" style={{ width: "100%", fontSize: "0.75rem", borderCollapse: "collapse" }}>
                                <thead>
                                  <tr style={{ borderBottom: "1px solid #ccc" }}>
                                    <th style={{ textAlign: "left", padding: "2px 6px", color: "#777", fontWeight: 600 }}>Section</th>
                                    <th style={{ textAlign: "center", padding: "2px 6px", color: "#777", fontWeight: 600 }}>Sides</th>
                                    <th style={{ textAlign: "left", padding: "2px 6px", color: "#777", fontWeight: 600 }}>Color</th>
                                    <th style={{ textAlign: "center", padding: "2px 6px", color: "#777", fontWeight: 600 }}>Length</th>
                                    <th style={{ textAlign: "center", padding: "2px 6px", color: "#777", fontWeight: 600 }}>Height</th>
                                    <th style={{ textAlign: "right", padding: "2px 6px", color: "#777", fontWeight: 600 }}>Gutter FT</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {sectionBreakdownRows.map((row) => (
                                    <tr key={`gutter-${row.section}`} style={{ borderBottom: "1px solid #eee" }}>
                                      <td style={{ padding: "3px 6px", fontWeight: 600 }}>{row.section}</td>
                                      <td style={{ padding: "3px 6px", textAlign: "center" }}>{displayIntOrDash(row.sides)}</td>
                                      <td style={{ padding: "3px 6px" }} data-tooltip={row.gutterColor || undefined}>
                                        <span className="quote-material-cell">{displayOrDash(row.gutterColor)}</span>
                                      </td>
                                      <td style={{ padding: "3px 6px", textAlign: "center" }}>{row.ft === null ? "—" : `${displayIntOrDash(row.ft)} FT`}</td>
                                      <td style={{ padding: "3px 6px", textAlign: "center" }}>{row.heightFt === null ? "—" : `${displayIntOrDash(row.heightFt)} FT`}</td>
                                      <td style={{ padding: "3px 6px", textAlign: "right" }}>{fmt(row.gutterFt)} FT</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>

                              <div className="fw-semibold mb-1" style={{ fontSize: "0.8rem", marginTop: "10px" }}>3x4 Downspouts</div>
                              <table className="quote-material-table quote-material-table--downspout" style={{ width: "100%", fontSize: "0.75rem", borderCollapse: "collapse" }}>
                                <thead>
                                  <tr style={{ borderBottom: "1px solid #ccc" }}>
                                    <th style={{ textAlign: "left", padding: "2px 6px", color: "#777", fontWeight: 600 }}>Section</th>
                                    <th style={{ textAlign: "left", padding: "2px 6px", color: "#777", fontWeight: 600 }}>Color</th>
                                    <th style={{ textAlign: "center", padding: "2px 6px", color: "#777", fontWeight: 600 }}>Qty</th>
                                    <th style={{ textAlign: "right", padding: "2px 6px", color: "#777", fontWeight: 600 }}>Downspout FT</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {sectionBreakdownRows.map((row) => (
                                    <tr key={`ds-${row.section}`} style={{ borderBottom: "1px solid #eee" }}>
                                      <td style={{ padding: "3px 6px", fontWeight: 600 }}>{row.section}</td>
                                      <td style={{ padding: "3px 6px" }} data-tooltip={row.downspoutColor || undefined}>
                                        <span className="quote-material-cell">{displayOrDash(row.downspoutColor)}</span>
                                      </td>
                                      <td style={{ padding: "3px 6px", textAlign: "center" }}>{displayIntOrDash(row.dsQty)}</td>
                                      <td style={{ padding: "3px 6px", textAlign: "right" }}>{fmt(row.downspoutFt)} FT</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>

                              <div style={{ borderTop: "1px solid #ccc", paddingTop: "8px", marginBottom: "6px" }}>
                                <div className="fw-semibold mb-1" style={{ fontSize: "0.8rem" }}>End Caps Totals</div>
                                <table style={{ width: "100%", fontSize: "0.75rem", borderCollapse: "collapse" }}>
                                  <thead>
                                    <tr style={{ borderBottom: "1px solid #ccc" }}>
                                      <th style={{ textAlign: "left", padding: "2px 6px", color: "#777", fontWeight: 600 }}>Right</th>
                                      <th style={{ textAlign: "left", padding: "2px 6px", color: "#777", fontWeight: 600 }}>Left</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    <tr>
                                      <td style={{ padding: "3px 6px" }}>{displayIntOrDash(totalEndCapsNeeded.right)}</td>
                                      <td style={{ padding: "3px 6px" }}>{displayIntOrDash(totalEndCapsNeeded.left)}</td>
                                    </tr>
                                  </tbody>
                                </table>
                              </div>
                            </>
                          )}

                          {selectedLeafGuardName && (
                            <div style={{ borderTop: "1px solid #ccc", paddingTop: "8px", marginBottom: "6px" }}>
                              <div className="fw-semibold mb-1" style={{ fontSize: "0.8rem" }}>Leaf Guard</div>
                              <div style={{ fontSize: "0.75rem", paddingLeft: "6px" }}>
                                <span style={{ color: "#777" }}>Name:</span> {selectedLeafGuardName}
                              </div>
                            </div>
                          )}

                          {extrasMaterialRows.length > 0 && (
                            <div style={{ borderTop: "1px solid #ccc", paddingTop: "8px", marginBottom: "4px" }}>
                              <div className="fw-semibold mb-1" style={{ fontSize: "0.8rem" }}>Extras</div>
                              <table style={{ width: "100%", fontSize: "0.75rem", borderCollapse: "collapse", paddingLeft: "6px" }}>
                                <thead>
                                  <tr style={{ borderBottom: "1px solid #ccc" }}>
                                    <th style={{ textAlign: "left", padding: "2px 6px", color: "#777", fontWeight: 600 }}>#</th>
                                    <th style={{ textAlign: "left", padding: "2px 6px", color: "#777", fontWeight: 600 }}>Description</th>
                                    <th style={{ textAlign: "center", padding: "2px 6px", color: "#777", fontWeight: 600 }}>Qty</th>
                                    <th style={{ textAlign: "right", padding: "2px 6px", color: "#777", fontWeight: 600 }}>Price</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {extrasMaterialRows.map((extra, i) => (
                                    <tr key={i} style={{ borderBottom: "1px solid #eee" }}>
                                      <td style={{ padding: "3px 6px", fontWeight: 600 }}>{i + 1}</td>
                                      <td style={{ padding: "3px 6px" }}>{displayOrDash(extra.description)}</td>
                                      <td style={{ padding: "3px 6px", textAlign: "center" }}>{displayIntOrDash(extra.qty)}</td>
                                      <td style={{ padding: "3px 6px", textAlign: "right" }}>{fmtCurrency(extra.unitPrice || 0)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-muted mb-0">Fill in the form to see the quote preview.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
