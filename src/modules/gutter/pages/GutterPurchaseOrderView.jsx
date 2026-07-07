"use client";

import { useState, useMemo, useCallback, useRef } from "react";
import Link from "next/link";
import { Container, Form } from "react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowLeft, faCheck, faPrint, faBoxOpen, faUpRightFromSquare, faTriangleExclamation } from "@fortawesome/free-solid-svg-icons";
import { faBuilding } from "@fortawesome/free-regular-svg-icons";
import { Button, toastError, toastSuccess } from "@/shared/components/ui";
import Image from "next/image";
import { pdf } from "@react-pdf/renderer";
import { PurchaseOrderPdf } from "./GutterPdfDocuments";
import { savePurchaseOrder } from "../data/gutter.actions";
import logoImg from "../assets/PSGD Logo.png";
import { calculateMaterials } from "../data/gutter.data";
import { getPSBUserPayloadFromCookie } from "@/core/sso-client";
import styles from "./GutterWorkOrder.module.css";

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatNumber = (value, fractionDigits = 2) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "0";
  return numeric.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: fractionDigits });
};

const toDisplay = (value) => {
  if (value === null || value === undefined || value === "") return "";
  return String(value);
};

const toWholeDisplay = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "0";
  return String(Math.round(parsed));
};

const toDecimalDisplay = (value, digits = 2) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "0";
  return parsed.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: digits });
};

export default function GutterPurchaseOrderView({ projectId, projectData, storedPurchaseOrder, setup }) {
  const header = projectData?.projectHeader || null;

  const sides = useMemo(() => projectData?.projectSides || [], [projectData?.projectSides]);
  const colors = useMemo(() => projectData?.colors || [], [projectData?.colors]);

  const companyProfile = useMemo(() => {
    const c = Array.isArray(setup?.company) ? setup.company[0] : setup?.company || {};
    return {
      name: c.short_name || c.comp_name || "Purchase Order",
      email: c.comp_email || "",
      phone: c.comp_phone || "",
    };
  }, [setup]);
  const logoUrl = useMemo(() => (typeof logoImg === "object" && logoImg?.src ? logoImg.src : logoImg), []);

  const [manualInputs, setManualInputs] = useState(() => {
    const stored = storedPurchaseOrder;
    return {
      zipScrewsQty: String(toNumber(stored?.zip_screws_qty)),
      sprayPaintQty: String(toNumber(stored?.spray_paint_qty)),
      boxScrewsQty: String(toNumber(stored?.box_screws_qty)),
    };
  });
  const [saving, setSaving] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [baselineSnapshot, setBaselineSnapshot] = useState(() => storedPurchaseOrder ? JSON.stringify(storedPurchaseOrder) : null);
  const initialStoredRef = useRef(storedPurchaseOrder);

  const colorById = useMemo(() => {
    const map = {};
    (Array.isArray(colors) ? colors : []).forEach((c) => { map[String(c.color_id)] = c.name; });
    return map;
  }, [colors]);

  const materialSource = useMemo(() => {
    const sections = (Array.isArray(sides) ? sides : []).map((side) => {
      const gutterColor = colorById[String(side.gutter_color_id)] || "";
      const downspoutColor = colorById[String(side.downspout_color_id)] || gutterColor || "";
      return {
        sides: toNumber(side.segments),
        length: toNumber(side.length),
        height: toNumber(side.height),
        downspoutQty: toNumber(side.downspout_qty),
        gutterColor,
        downspoutColor,
      };
    });
    return { sections };
  }, [sides, colorById]);

  const materials = useMemo(() => {
    return calculateMaterials({
      ...materialSource,
      zipScrewsQty: manualInputs.zipScrewsQty,
      sprayPaintQty: manualInputs.sprayPaintQty,
      boxScrewsQty: manualInputs.boxScrewsQty,
    });
  }, [materialSource, manualInputs]);

  const handleManualInputChange = (field, value) => {
    setManualInputs((prev) => ({ ...prev, [field]: value }));
  };

  const currentSnapshot = useMemo(() => JSON.stringify(manualInputs), [manualInputs]);
  const hasChanges = baselineSnapshot === null || currentSnapshot !== baselineSnapshot;
  const canPrint = baselineSnapshot !== null && !hasChanges;

  const handlePrint = useCallback(async () => {
    if (!canPrint || printing) return;
    setPrinting(true);
    try {
      const doc = (
        <PurchaseOrderPdf
          header={header}
          materials={materials}
          storedPurchaseOrder={storedPurchaseOrder}
          logoUrl={logoUrl}
        />
      );
      const blob = await pdf(doc).toBlob();
      const url = URL.createObjectURL(blob);
      const printWindow = window.open(url, "_blank");
      if (printWindow) {
        printWindow.onload = () => printWindow.print();
      }
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } finally {
      setPrinting(false);
    }
  }, [canPrint, printing, header, materials, storedPurchaseOrder, logoUrl]);

  const handleSave = useCallback(async () => {
    if (!projectId || !materials) return;
    setSaving(true);
    try {
      const session = getPSBUserPayloadFromCookie();
      const userId = session?.userId || null;
      await savePurchaseOrder(projectId, {
        _userId: userId,
        k_style_gutter_color: materials.colors.kStyleGutterColor,
        downspout_color: materials.colors.downspoutColor,
        gutter_coil_total_ft: materials.gutterCoil.totalFt,
        gutter_coil_total_lbs: materials.gutterCoil.totalLbs,
        right_end_caps_qty: materials.endCaps.right.qty,
        left_end_caps_qty: materials.endCaps.left.qty,
        downpipe_qty: materials.downpipe.qty,
        one_piece_offset_qty: materials.onePieceOffset.qty,
        elbow_a_qty: materials.elbow.qty,
        spray_paint_qty: materials.sprayPaint.qty,
        zip_screws_qty: materials.zipScrews.qty,
        zip_screws_internal_qty: materials.internal.internalScrews,
        total_downspouts: materials.internal.totalDownspouts,
        total_endcaps: materials.internal.totalEndcaps,
        rectangular_outlets: materials.internal.rectangularOutlets,
        internal_screws: materials.internal.internalScrews,
        hidden_hangers_qty: materials.internal.hiddenHangers,
        box_screws_qty: materials.internal.boxScrews,
      });
      setBaselineSnapshot(currentSnapshot);
      toastSuccess("Purchase order saved.", "Purchase Order");
    } catch (err) {
      toastError(err?.message || "Unable to save purchase order.", "Purchase Order");
    } finally {
      setSaving(false);
    }
  }, [projectId, materials, currentSnapshot]);

  if (!header || !materials) return <Container className="py-4">Project not found.</Container>;

  return (
    <div className={styles.woPage}>
      {/* ─── Compact Top Header ─── */}
      <div className={styles.woHeader}>
        <div className={styles.woHeaderLeft}>
          <Link href={`/gutter/${projectId}`} className={styles.woBackLink}>
            <FontAwesomeIcon icon={faArrowLeft} aria-hidden="true" />
          </Link>
          <div className={styles.woHeaderTitle}>
            <h1 className={styles.woTitle}>Purchase Order</h1>
            <span className={styles.woSubtitle}>{header.project_name || `PO# ${header.proj_id}`}</span>
          </div>
          <div className={styles.woHeaderMeta}>
            <div className={styles.woMetaItem}>
              <span className={styles.woMetaLabel}>PO#</span>
              <span className={styles.woMetaValue}>{toDisplay(header.proj_id)}</span>
            </div>
            <div className={styles.woMetaItem}>
              <span className={styles.woMetaLabel}>Date</span>
              <span className={styles.woMetaValue}>{toDisplay(header.date)}</span>
            </div>
            <div className={styles.woMetaItem}>
              <span className={styles.woMetaLabel}>Address</span>
              <span className={styles.woMetaValue}>{toDisplay(header.project_address)}</span>
            </div>
          </div>
        </div>
        <div className={styles.woHeaderActions}>
          {header.request_link && (
            <Button variant="secondary" onClick={() => window.open(header.request_link, "_blank", "noopener,noreferrer")}>
              <FontAwesomeIcon icon={faUpRightFromSquare} className="me-1" /> Source Sheet
            </Button>
          )}
          <Button variant="success" onClick={handleSave} disabled={saving || !hasChanges} loading={saving}>
            <FontAwesomeIcon icon={faCheck} className="me-1" /> Save Purchase Order
          </Button>
          {hasChanges && (
            <span className="small text-danger fw-semibold align-self-center">
              Unsaved changes: save to enable Print.
            </span>
          )}
          {canPrint && (
            <Button variant="secondary" onClick={handlePrint} disabled={printing} loading={printing}>
              <FontAwesomeIcon icon={faPrint} className="me-1" /> Print / PDF
            </Button>
          )}
        </div>
      </div>

      {/* ─── Workspace Body ─── */}
      <div className={styles.woBody}>
        {/* ─── Main Content (Left) ─── */}
        <div className={styles.woMain}>

          {/* Project & Configuration */}
          <div className={styles.woSection}>
            <div className={styles.woSectionHeader}>
              <FontAwesomeIcon icon={faBuilding} /> Project &amp; Configuration
            </div>
            <div className={styles.woSectionBody}>
              <div className={styles.woInfoGrid}>
                <div className={styles.woCompanyBlock}>
                  <strong className={styles.woCompanyName}>{header.customer || "--"}</strong>
                  <span className={styles.woCompanyDetail}>{header.project_name || "--"}</span>
                  <span className={styles.woCompanyDetail}>{header.project_address || "--"}</span>
                </div>
                <div className={styles.woConfigGrid}>
                  <div className={styles.woConfigItem}>
                    <span className={styles.woConfigLabel}>K-Style Gutter Color</span>
                    <span className={styles.woConfigValue}>{materials.colors.kStyleGutterColor || "--"}</span>
                  </div>
                  <div className={styles.woConfigItem}>
                    <span className={styles.woConfigLabel}>Downspout Color</span>
                    <span className={styles.woConfigValue}>{materials.colors.downspoutColor || "--"}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Material Summary */}
          <div className={styles.woSection}>
            <div className={styles.woSectionHeader}>
              <FontAwesomeIcon icon={faBoxOpen} /> Material Summary
            </div>
            <div className={styles.woSectionBody}>
              {/* Gutter Coil */}
              <table className={styles.woTable}>
                <thead>
                  <tr><th>Item</th><th>FT</th><th>LBS</th><th>Color</th></tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Gutter Coil 15&quot;</td>
                    <td>{toDecimalDisplay(materials.gutterCoil.totalFt)}</td>
                    <td>{toDecimalDisplay(materials.gutterCoil.totalLbs)}</td>
                    <td>{materials.gutterCoil.color || "--"}</td>
                  </tr>
                </tbody>
              </table>

              {/* Parts */}
              <table className={styles.woTable} style={{ marginTop: "10px" }}>
                <thead>
                  <tr><th>Item</th><th>QTY</th><th>Color</th></tr>
                </thead>
                <tbody>
                  <tr><td>Right End Caps - 6&quot; K-Style</td><td>{toWholeDisplay(materials.endCaps.right.qty)}</td><td>{materials.endCaps.right.color || "--"}</td></tr>
                  <tr><td>Left End Caps - 6&quot; K-Style</td><td>{toWholeDisplay(materials.endCaps.left.qty)}</td><td>{materials.endCaps.left.color || "--"}</td></tr>
                  <tr><td>3&quot; x 4&quot; Downpipe 10&apos;ft</td><td>{toWholeDisplay(materials.downpipe.qty)}</td><td>{materials.downpipe.color || "--"}</td></tr>
                  <tr><td>3&quot; x 4&quot; - 6&quot; One Piece Offset</td><td>{toWholeDisplay(materials.onePieceOffset.qty)}</td><td>{materials.onePieceOffset.color || "--"}</td></tr>
                  <tr><td>3&quot; x 4&quot; -(A) Elbow</td><td>{toWholeDisplay(materials.elbow.qty)}</td><td>{materials.elbow.color || "--"}</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Spray Paint */}
          <div className={styles.woSection}>
            <div className={styles.woSectionHeader}>
              <FontAwesomeIcon icon={faBoxOpen} /> Spray Paint for Touch up
            </div>
            <div className={styles.woSectionBody}>
              <table className={styles.woTable}>
                <thead>
                  <tr><th>Item</th><th>QTY</th><th>Color</th></tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Spray Paint for Touch up</td>
                    <td><Form.Control size="sm" type="number" min="0" step="1" style={{ width: 60, display: "inline-block" }} value={manualInputs.sprayPaintQty} onChange={(e) => handleManualInputChange("sprayPaintQty", e.target.value)} /></td>
                    <td>{materials.sprayPaint.color || "--"}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Zip Screws */}
          <div className={styles.woSection}>
            <div className={styles.woSectionHeader}>
              <FontAwesomeIcon icon={faBoxOpen} /> #8 x 1/2&quot; Zip Screws
            </div>
            <div className={styles.woSectionBody}>
              <table className={styles.woTable}>
                <thead>
                  <tr><th>Item</th><th>QTY</th><th>Color</th></tr>
                </thead>
                <tbody>
                  <tr>
                    <td>#8 x 1/2&quot; Zip Screws</td>
                    <td><Form.Control size="sm" type="number" min="0" step="1" style={{ width: 60, display: "inline-block" }} value={manualInputs.zipScrewsQty} onChange={(e) => handleManualInputChange("zipScrewsQty", e.target.value)} /></td>
                    <td>{materials.zipScrews.color || "--"}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ─── Sidebar (Right) ─── */}
        <div className={styles.woSidebar}>

          {/* Internal Information */}
          <div className={styles.woSection} style={{ borderColor: "var(--psb-status-failed-border)" }}>
            <div className={styles.woSectionHeader} style={{ color: "var(--psb-action-delete)" }}>
              <FontAwesomeIcon icon={faTriangleExclamation} /> Internal (Do Not Print)
            </div>
            <div className={styles.woSectionBody}>
              <table className={styles.woTable}>
                <tbody>
                  <tr><td>Total Downspouts</td><td>{toWholeDisplay(materials.internal.totalDownspouts)}</td></tr>
                  <tr><td>Total Endcaps</td><td>{toWholeDisplay(materials.internal.totalEndcaps)}</td></tr>
                  <tr><td>3&quot; x 4&quot; Rectangular Outlets</td><td>{toWholeDisplay(materials.internal.rectangularOutlets)}</td></tr>
                  <tr><td>Qty of Screws (Internal)</td><td>{toWholeDisplay(materials.internal.internalScrews)}</td></tr>
                  <tr><td>6&quot; Hidden Hangers</td><td>{toWholeDisplay(materials.internal.hiddenHangers)}</td></tr>
                  <tr><td>#8 x 1/2&quot; Zip Screws (Internal)</td><td>{toWholeDisplay(materials.internal.internalScrews)}</td></tr>
                  <tr>
                    <td>Box Metal Screws (Hangers)</td>
                    <td><Form.Control size="sm" type="number" min="0" step="1" style={{ width: 60, display: "inline-block" }} value={manualInputs.boxScrewsQty} onChange={(e) => handleManualInputChange("boxScrewsQty", e.target.value)} /></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
