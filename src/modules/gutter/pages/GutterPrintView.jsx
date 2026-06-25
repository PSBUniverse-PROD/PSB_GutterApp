"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowLeft, faPrint, faDownload } from "@fortawesome/free-solid-svg-icons";
import { faFileLines, faNoteSticky, faRectangleList } from "@fortawesome/free-regular-svg-icons";
import { Button } from "@/shared/components/ui";
import { pdf } from "@react-pdf/renderer";
import { QuotePdf, WorkOrderPdf, PurchaseOrderPdf } from "./GutterPdfDocuments";
import {
  calculateQuote, calculateMaterials, formatCurrency,
  normalizeStatuses, normalizeColors, normalizeManufacturers,
  normalizeLeafGuards, normalizeTripRates, normalizeDiscounts,
  mapHeaderToProject,
} from "../data/gutter.data";
import styles from "./GutterPrint.module.css";

const TABS = [
  { key: "quote", label: "Quote / Estimate", icon: faFileLines },
  { key: "work-order", label: "Work Order", icon: faNoteSticky },
  { key: "purchase-order", label: "Purchase Order", icon: faRectangleList },
];

const toDisplay = (v) => (v === null || v === undefined || v === "") ? "—" : String(v);
const fmtCurrency = (v) => formatCurrency(v);
const fmtNum = (v) => (v === null || v === undefined) ? "—" : String(Number(v).toFixed(2));
const fmtInt = (v) => (v === null || v === undefined) ? "—" : String(Math.round(Number(v)));

export default function GutterPrintView({ projectId, projectData, setup, storedPurchaseOrder, workOrderData }) {
  const [activeTab, setActiveTab] = useState("quote");
  const [generating, setGenerating] = useState(false);

  // Hide app chrome (header/padding) — direct DOM override needed to beat Bootstrap !important
  useEffect(() => {
    const header = document.querySelector("header.app-header");
    const shellBody = document.querySelector(".app-shell-body");
    const appContent = document.querySelector(".app-content");
    if (header) header.style.setProperty("display", "none", "important");
    if (shellBody) shellBody.style.setProperty("padding", "0", "important");
    if (appContent) appContent.style.setProperty("padding", "0", "important");
    return () => {
      if (header) header.style.removeProperty("display");
      if (shellBody) shellBody.style.removeProperty("padding");
      if (appContent) appContent.style.removeProperty("padding");
    };
  }, []);

  const header = projectData?.projectHeader || null;
  const sides = useMemo(() => projectData?.projectSides || [], [projectData]);
  const extras = useMemo(() => projectData?.projectExtras || [], [projectData]);

  // Normalize setup
  const statuses = useMemo(() => normalizeStatuses(setup?.statuses), [setup]);
  const colors = useMemo(() => normalizeColors(setup?.colors || projectData?.colors), [setup, projectData]);

  // Build color lookup map (color_id → name)
  const colorById = useMemo(() => {
    const map = {};
    (Array.isArray(colors) ? colors : []).forEach((c) => { map[String(c.color_id)] = c.name; });
    return map;
  }, [colors]);

  // Build sections array with resolved color names (for calculateMaterials)
  const sections = useMemo(() => {
    return (Array.isArray(sides) ? sides : []).map((side) => {
      const gutterColor = colorById[String(side.gutter_color_id)] || "--";
      const downspoutColor = colorById[String(side.downspout_color_id)] || gutterColor || "--";
      return {
        sides: side.segments,
        length: side.length,
        height: side.height,
        downspoutQty: side.downspout_qty,
        gutterColor,
        downspoutColor,
      };
    });
  }, [sides, colorById]);

  const manufacturers = useMemo(() => normalizeManufacturers(setup?.manufacturers), [setup]);
  const leafGuards = useMemo(() => normalizeLeafGuards(setup?.leafGuards), [setup]);
  const tripRates = useMemo(() => normalizeTripRates(setup?.tripRates), [setup]);
  const discounts = useMemo(() => normalizeDiscounts(setup?.discounts), [setup]);
  const companyProfile = useMemo(() => {
    const c = (setup?.company || [])[0] || {};
    return { name: c.comp_name || "", email: c.comp_email || "", phone: c.comp_phone || "" };
  }, [setup]);

  // Build quoteSetup matching the shape calculateQuote expects
  const quoteSetup = useMemo(() => ({
    materialManufacturer: manufacturers.map((r) => ({ id: r.manufacturer_id, name: r.name, rate: r.rate })),
    leafGuard: leafGuards.map((r) => ({ id: r.leaf_guard_id, name: r.name, price: r.price })),
    tripRates: tripRates.map((r) => ({ id: r.trip_id, label: r.label, rate: r.rate })),
    discounts: discounts.map((r) => ({ id: r.discount_id, percent: r.percentage })),
  }), [manufacturers, leafGuards, tripRates, discounts]);

  // Build project object for calculateQuote
  const project = useMemo(() => {
    if (!header) return null;
    return mapHeaderToProject(header, sides, extras);
  }, [header, sides, extras]);

  // Calculate quote
  const quoteResult = useMemo(() => {
    if (!project) return null;
    return calculateQuote(project, quoteSetup);
  }, [project, quoteSetup]);

  // Calculate materials
  const materials = useMemo(() => calculateMaterials({ sections }), [sections]);

  // Derived values
  const selectedManufacturer = manufacturers.find((m) => String(m.manufacturer_id) === String(header?.manufacturer_id));
  const selectedManufacturerName = selectedManufacturer?.name || "—";
  const selectedLeafGuard = leafGuards.find((lg) => String(lg.leaf_guard_id) === String(header?.leaf_guard_id));
  const selectedLeafGuardName = selectedLeafGuard?.name || null;
  const displayDate = header?.date || "—";

  // Section breakdown for quote material details
  const sectionBreakdownRows = useMemo(() => {
    if (!sides.length) return [];
    return sides.map((side, i) => {
      const gutterColor = colors.find((c) => String(c.color_id) === String(side.gutter_color_id))?.name || "—";
      const dsColor = colors.find((c) => String(c.color_id) === String(side.downspout_color_id))?.name || "—";
      const gutterFt = (quoteResult?.pricing?.gutterQuantities || [])[i] || 0;
      const dsFt = (quoteResult?.pricing?.downspoutFootages || [])[i] || 0;
      return {
        section: i + 1,
        sides: side.segments,
        gutterColor,
        downspoutColor: dsColor,
        ft: side.length,
        heightFt: side.height,
        gutterFt,
        dsQty: side.downspout_qty,
        downspoutFt: dsFt,
      };
    });
  }, [sides, colors, quoteResult]);

  // Generate PDF and open in new tab
  const handleGeneratePdf = useCallback(async () => {
    if (generating) return;
    setGenerating(true);
    try {
      let doc;
      if (activeTab === "quote") {
        doc = (
          <QuotePdf
            header={header}
            quoteResult={quoteResult}
            companyProfile={companyProfile}
            displayDate={displayDate}
            selectedManufacturerName={selectedManufacturerName}
            selectedLeafGuardName={selectedLeafGuardName}
            sectionBreakdownRows={sectionBreakdownRows}
            extras={extras}
          />
        );
      } else if (activeTab === "work-order") {
        doc = (
          <WorkOrderPdf
            header={header}
            sides={sides}
            materials={materials}
            companyProfile={companyProfile}
            workOrderData={workOrderData}
          />
        );
      } else {
        doc = (
          <PurchaseOrderPdf
            header={header}
            materials={materials}
            storedPurchaseOrder={storedPurchaseOrder}
          />
        );
      }
      const blob = await pdf(doc).toBlob();
      const url = URL.createObjectURL(blob);
      // Build filename: Type_Customer_ProjectName_Date.pdf
      const tabLabel = activeTab === "quote" ? "Quote" : activeTab === "work-order" ? "WorkOrder" : "PurchaseOrder";
      const customer = (header.customer || "").replace(/[^a-zA-Z0-9]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
      const project = (header.project_name || "").replace(/[^a-zA-Z0-9]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
      const date = (header.date || "").replace(/\//g, "-");
      const filename = [tabLabel, customer, project, date].filter(Boolean).join("_") + ".pdf";
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setGenerating(false);
    }
  }, [generating, activeTab, header, quoteResult, companyProfile, displayDate, selectedManufacturerName, selectedLeafGuardName, sectionBreakdownRows, extras, sides, materials, storedPurchaseOrder, workOrderData]);

  if (!header) {
    return <div className={styles.printPage}><p>Project not found.</p></div>;
  }

  return (
    <div className={styles.printPage}>
      {/* Toolbar — hidden on print */}
      <div className={styles.printToolbar}>
        <Link href={`/gutter/${projectId}`} className={styles.printBackLink}>
          <FontAwesomeIcon icon={faArrowLeft} /> Back to Project
        </Link>
        <div className={styles.printTabs}>
          {TABS.map((tab) => (
            <button
              key={tab.key}
              className={`${styles.printTab} ${activeTab === tab.key ? styles.printTabActive : ""}`}
              onClick={() => setActiveTab(tab.key)}
            >
              <FontAwesomeIcon icon={tab.icon} /> {tab.label}
            </button>
          ))}
        </div>
        <Button variant="secondary" onClick={handleGeneratePdf} disabled={generating}>
          <FontAwesomeIcon icon={generating ? faDownload : faPrint} className="me-1" />
          {generating ? "Generating…" : "Download PDF"}
        </Button>
      </div>

      {/* Print Content */}
      <div className={styles.printContent}>
        {activeTab === "quote" && (
          <QuoteDocument
            header={header}
            project={project}
            quoteResult={quoteResult}
            companyProfile={companyProfile}
            displayDate={displayDate}
            selectedManufacturerName={selectedManufacturerName}
            selectedLeafGuardName={selectedLeafGuardName}
            sectionBreakdownRows={sectionBreakdownRows}
            extras={extras}
          />
        )}
        {activeTab === "work-order" && (
          <WorkOrderDocument
            header={header}
            sides={sides}
            materials={materials}
            companyProfile={companyProfile}
            workOrderData={workOrderData}
          />
        )}
        {activeTab === "purchase-order" && (
          <PurchaseOrderDocument
            header={header}
            materials={materials}
            storedPurchaseOrder={storedPurchaseOrder}
          />
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   QUOTE DOCUMENT
   ═══════════════════════════════════════════════════════════════════════════ */
function QuoteDocument({ header, project, quoteResult, companyProfile, displayDate, selectedManufacturerName, selectedLeafGuardName, sectionBreakdownRows, extras }) {
  const pricing = quoteResult?.pricing;
  if (!pricing) return <p className={styles.printEmpty}>No pricing data available. Ensure the project has sections configured.</p>;

  const hasDiscount = Number(pricing.discountAmount || 0) > 0;
  const hasDeposit = Number(pricing.depositPercentDisplay || 0) > 0;
  const endCapsPerSide = (() => {
    const groups = pricing?.derivedEndCaps?.groups;
    if (Array.isArray(groups) && groups.length > 0) {
      return groups.reduce((sum, g) => sum + (Number.isFinite(Number(g?.value)) ? Number(g.value) : 0), 0);
    }
    return (sectionBreakdownRows || []).reduce((sum, row) => sum + (Number.isFinite(Number(row?.sides)) ? Number(row.sides) : 0), 0);
  })();

  return (
    <div className={styles.printDocument}>
      {/* Header */}
      <div className={styles.docHeader}>
        <div>
          <h2 className={styles.docCompanyName}>{companyProfile.name || "Company"}</h2>
          <div className={styles.docCompanyDetail}>{companyProfile.email}</div>
          <div className={styles.docCompanyDetail}>{companyProfile.phone}</div>
        </div>
        <div className={styles.docHeaderRight}>
          <div className={styles.docHeaderMeta}><span>Date</span><strong>{displayDate}</strong></div>
          <div className={styles.docHeaderMeta}><span>Project #</span><strong>{header.proj_id}</strong></div>
        </div>
      </div>

      <hr className={styles.docDivider} />

      {/* Project Details */}
      <div className={styles.docSection}>
        <h3 className={styles.docSectionTitle}>Project Details</h3>
        <div className={styles.docDetailsGrid}>
          <div>
            <div className={styles.docDetailItem}><span className={styles.docDetailsLabel}>Customer</span><span>{toDisplay(header.customer)}</span></div>
            <div className={styles.docDetailItem}><span className={styles.docDetailsLabel}>Project Name</span><span>{toDisplay(header.project_name)}</span></div>
          </div>
          <div>
            <div className={styles.docDetailItem}><span className={styles.docDetailsLabel}>Address</span><span>{toDisplay(header.project_address)}</span></div>
            <div className={styles.docDetailItem}><span className={styles.docDetailsLabel}>Manufacturer</span><span>{selectedManufacturerName}</span></div>
          </div>
        </div>
      </div>

      {/* Material Breakdown */}
      {sectionBreakdownRows.length > 0 && (
        <div className={styles.docSection}>
          <h3 className={styles.docSectionTitle}>Material Breakdown</h3>

          <h4 className={styles.docSubTitle}>Gutter k Style 6 Inch</h4>
          <table className={styles.docMaterialTable}>
            <thead>
              <tr>
                <th>Section</th><th>Sides</th><th>Color</th><th>Length</th><th>Height</th><th>Gutter FT</th>
              </tr>
            </thead>
            <tbody>
              {sectionBreakdownRows.map((row) => (
                <tr key={row.section}>
                  <td>{row.section}</td>
                  <td>{fmtInt(row.sides)}</td>
                  <td>{row.gutterColor}</td>
                  <td>{row.ft != null ? `${fmtInt(row.ft)} FT` : "—"}</td>
                  <td>{row.heightFt != null ? `${fmtInt(row.heightFt)} FT` : "—"}</td>
                  <td>{fmtNum(row.gutterFt)} FT</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h4 className={styles.docSubTitle}>3x4 Downspouts</h4>
          <table className={styles.docMaterialTable}>
            <thead>
              <tr><th>Section</th><th>Color</th><th>Qty</th><th>Downspout FT</th></tr>
            </thead>
            <tbody>
              {sectionBreakdownRows.map((row) => (
                <tr key={row.section}>
                  <td>{row.section}</td>
                  <td>{row.downspoutColor}</td>
                  <td>{fmtInt(row.dsQty)}</td>
                  <td>{fmtNum(row.downspoutFt)} FT</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* End Caps */}
          <h4 className={styles.docSubTitle}>End Caps Totals</h4>
          <table className={styles.docMaterialTable}>
            <colgroup>
              <col style={{ width: "50%" }} />
              <col style={{ width: "50%" }} />
            </colgroup>
            <thead>
              <tr><th>Right</th><th>Left</th></tr>
            </thead>
            <tbody>
              <tr>
                <td>{fmtInt(endCapsPerSide)}</td>
                <td>{fmtInt(endCapsPerSide)}</td>
              </tr>
            </tbody>
          </table>

          {selectedLeafGuardName && (
            <p className={styles.docNote}><strong>Leaf Guard:</strong> {selectedLeafGuardName}</p>
          )}

          {extras.length > 0 && (
            <>
              <h4 className={styles.docSubTitle}>Extras</h4>
              <table className={styles.docMaterialTable}>
                <thead><tr><th>#</th><th>Description</th><th>Qty</th><th className={styles.textRight}>Unit Price</th></tr></thead>
                <tbody>
                  {extras.map((ex, i) => (
                    <tr key={i}>
                      <td>{i + 1}</td>
                      <td>{toDisplay(ex.name)}</td>
                      <td>{fmtInt(ex.quantity)}</td>
                      <td className={styles.textRight}>{fmtCurrency(ex.unit_price || 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}

      {/* Pricing Summary */}
      <div className={styles.docSection}>
        <h3 className={styles.docSectionTitle}>Pricing Summary</h3>
        <table className={styles.docPricingTable}>
          <tbody>
            <tr>
              <td>Gutter k Style 6 Inch</td>
              <td className={styles.docPriceValue}>{fmtCurrency(pricing.materialCost)}</td>
            </tr>
            <tr className={styles.docPriceSubline}>
              <td colSpan={2}>Total Gutter: {fmtNum(pricing.totalGutter)} FT</td>
            </tr>
            <tr>
              <td>3x4 Downspouts</td>
              <td className={styles.docPriceValue}>{fmtCurrency(pricing.downspoutCost)}</td>
            </tr>
            <tr className={styles.docPriceSubline}>
              <td colSpan={2}>Total Downspout: {fmtNum(pricing.totalDownspouts)} FT</td>
            </tr>
            {Number(pricing.leafGuardCost || 0) > 0 && (
              <tr><td>Leaf Guard</td><td className={styles.docPriceValue}>{fmtCurrency(pricing.leafGuardCost)}</td></tr>
            )}
            {Number(pricing.tripFeePrice || 0) > 0 && (
              <tr><td>Trip Fee</td><td className={styles.docPriceValue}>{fmtCurrency(pricing.tripFeePrice)}</td></tr>
            )}
            {Number(pricing.extrasPrice || 0) > 0 && (
              <tr><td>Extras</td><td className={styles.docPriceValue}>{fmtCurrency(pricing.extrasPrice)}</td></tr>
            )}
          </tbody>
          <tfoot>
            <tr className={styles.docPriceSubtotal}>
              <td>Subtotal</td>
              <td className={styles.docPriceValue}>{fmtCurrency(pricing.subtotal)}</td>
            </tr>
            {hasDiscount && (
              <tr className={styles.docPriceDiscount}>
                <td>Discount ({(pricing.discountPercent * 100).toFixed(1)}%)</td>
                <td className={styles.docPriceValue}>-{fmtCurrency(pricing.discountAmount)}</td>
              </tr>
            )}
            <tr className={styles.docPriceTotal}>
              <td>Project Total</td>
              <td className={styles.docPriceValue}>{fmtCurrency(pricing.projectTotal)}</td>
            </tr>
            {hasDeposit && (
              <>
                <tr>
                  <td>Deposit ({pricing.depositPercentDisplay}%)</td>
                  <td className={styles.docPriceValue}>{fmtCurrency(pricing.depositAmount)}</td>
                </tr>
                <tr className={styles.docPriceBalance}>
                  <td>Remaining Balance</td>
                  <td className={styles.docPriceValue}>{fmtCurrency(pricing.remainingBalance)}</td>
                </tr>
              </>
            )}
          </tfoot>
        </table>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   WORK ORDER DOCUMENT — WYSIWYG with PDF output
   ═══════════════════════════════════════════════════════════════════════════ */
function WorkOrderDocument({ header, sides, materials, companyProfile, workOrderData }) {
  const wo = workOrderData || {};
  const dspAssignments = wo.downspoutAssignments || Array.from({ length: 8 }, () => "");
  const zipScrewsBags = wo.zipScrewsBags || [];

  const materialRows = [
    { item: 'Gutter Coil 15"', qty: `${fmtInt(materials?.gutterCoil?.totalFt)} FT / ${fmtInt(Math.trunc(materials?.gutterCoil?.totalLbs || 0))} lbs`, color: materials?.gutterCoil?.color || "—" },
    { item: 'Right End Caps - 6" K-Style', qty: fmtInt(materials?.endCaps?.right?.qty), color: materials?.endCaps?.right?.color || "—" },
    { item: 'Left End Caps - 6" K-Style', qty: fmtInt(materials?.endCaps?.left?.qty), color: materials?.endCaps?.left?.color || "—" },
    { item: '3" x 4" Downpipe 10\'ft', qty: fmtInt(materials?.downpipe?.qty), color: materials?.downpipe?.color || "—" },
    { item: '3" x 4" - 6" One Piece Offset', qty: fmtInt(materials?.onePieceOffset?.qty), color: materials?.onePieceOffset?.color || "—" },
    { item: '3" x 4" -(A) Elbow', qty: fmtInt(materials?.elbow?.qty), color: materials?.elbow?.color || "—" },
    { item: '6" Hidden Hangers', qty: fmtInt(materials?.internal?.hiddenHangers), color: "Auto" },
  ];

  if (zipScrewsBags.length > 0) {
    zipScrewsBags.forEach((bag, i) => {
      materialRows.push({ item: `Zip Screws Bag ${i + 1}`, qty: String(bag.qty || 0), color: bag.color || "—" });
    });
  } else {
    materialRows.push({ item: '#8 x 1/2" Zip Screws', qty: fmtInt(materials?.zipScrews?.qty), color: materials?.zipScrews?.color || "—" });
  }

  return (
    <div className={styles.printDocument}>
      {/* Header */}
      <div className={styles.docHeader}>
        <div>
          <h2 className={styles.docCompanyName}>{companyProfile.name || "Company"}</h2>
          <div className={styles.docCompanyDetail}>{companyProfile.email}</div>
          <div className={styles.docCompanyDetail}>{companyProfile.phone}</div>
        </div>
        <div className={styles.docHeaderRight}>
          <div className={styles.docHeaderMeta}><span>PO#</span><strong>{wo.work_order_no ? String(wo.work_order_no) : String(header.proj_id)}</strong></div>
          <div className={styles.docHeaderMeta}><span>Date</span><strong>{wo.work_order_date ? toDisplay(wo.work_order_date) : toDisplay(header.date)}</strong></div>
        </div>
      </div>

      <hr className={styles.docDivider} />

      {/* Row: Work Order (left) + Installer (right) */}
      <div style={{ display: "flex", gap: "24px", marginBottom: "14px" }}>
        <div style={{ flex: 1 }}>
          <h3 className={styles.docSectionTitle} style={{ marginBottom: 6 }}>Work Order</h3>
          <table className={styles.docDetailsTable}>
            <tbody>
              <tr><td className={styles.docDetailsLabel}>Customer</td><td>{toDisplay(header.customer)}</td></tr>
              <tr><td className={styles.docDetailsLabel}>Project</td><td>{toDisplay(header.project_name)}</td></tr>
              <tr><td className={styles.docDetailsLabel}>Address</td><td>{toDisplay(header.project_address)}</td></tr>
              <tr><td className={styles.docDetailsLabel}>K-Style Color</td><td>{materials?.colors?.kStyleGutterColor || "—"}</td></tr>
              <tr><td className={styles.docDetailsLabel}>Downspout Color</td><td>{materials?.colors?.downspoutColor || "—"}</td></tr>
            </tbody>
          </table>
        </div>
        <div style={{ flex: 1 }}>
          <h3 className={styles.docSectionTitle} style={{ marginBottom: 6 }}>Installer</h3>
          <table className={styles.docDetailsTable}>
            <tbody>
              <tr>
                <td className={styles.docDetailsLabel}>Name</td>
                <td style={{ borderBottom: "1px solid #999", height: 22 }}>{wo.installer_name ? toDisplay(wo.installer_name) : ""}</td>
              </tr>
              <tr>
                <td className={styles.docDetailsLabel}>Install Date</td>
                <td style={{ borderBottom: "1px solid #999", height: 22 }}>{wo.installation_date ? toDisplay(wo.installation_date) : ""}</td>
              </tr>
              <tr>
                <td className={styles.docDetailsLabel}>Signature</td>
                <td style={{ borderBottom: "1px solid #999", height: 22 }}>{wo.signature_name ? toDisplay(wo.signature_name) : ""}</td>
              </tr>
              <tr>
                <td className={styles.docDetailsLabel}>Signature Date</td>
                <td style={{ borderBottom: "1px solid #999", height: 22 }}>{wo.signature_date ? toDisplay(wo.signature_date) : ""}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <hr className={styles.docDivider} />

      {/* Row: Measurements (left) + Material Summary (right) */}
      <div style={{ display: "flex", gap: "16px", marginBottom: "14px" }}>
        <div style={{ flex: 1 }}>
          <h3 className={styles.docSectionTitle}>Measurements</h3>
          <table className={styles.docMaterialTable}>
            <thead>
              <tr><th>#</th><th>Length (FT)</th><th>Height (FT)</th><th>Segments</th><th>Downspouts</th></tr>
            </thead>
            <tbody>
              {sides.map((side, i) => (
                <tr key={i}>
                  <td>{i + 1}</td>
                  <td>{toDisplay(side.length)}</td>
                  <td>{toDisplay(side.height)}</td>
                  <td>{toDisplay(side.segments)}</td>
                  <td>{toDisplay(side.downspout_qty)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ flex: 1 }}>
          <h3 className={styles.docSectionTitle}>Material Summary</h3>
          <table className={styles.docMaterialTable}>
            <thead><tr><th>Item</th><th>QTY</th><th>Color</th></tr></thead>
            <tbody>
              {materialRows.map((row) => (
                <tr key={row.item}>
                  <td>{row.item}</td>
                  <td>{row.qty}</td>
                  <td>{row.color}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <hr className={styles.docDivider} />

      {/* Row: Sketch (70%) + DSP & Notes (30%) */}
      <div style={{ display: "flex", gap: "16px", minHeight: "240px" }}>
        <div style={{ flex: 7 }}>
          <h3 className={styles.docSectionTitle}>Sketch / Diagram</h3>
          <div className={styles.docSketchBox}>
            <span className={styles.docSketchLabel} data-pos="top">Front</span>
            <span className={styles.docSketchLabel} data-pos="bottom">Back</span>
            <span className={styles.docSketchLabel} data-pos="left">Left</span>
            <span className={styles.docSketchLabel} data-pos="right">Right</span>
          </div>
        </div>
        <div style={{ flex: 3, display: "flex", flexDirection: "column" }}>
          <h3 className={styles.docSectionTitle}>DSP Assignments</h3>
          <table className={styles.docMaterialTable} style={{ marginBottom: 6 }}>
            <thead>
              <tr>
                <th style={{ width: "30%" }}>DSP #</th>
                <th style={{ width: "70%" }}>Assigned Value</th>
              </tr>
            </thead>
            <tbody>
              {dspAssignments.map((val, i) => (
                <tr key={i}>
                  <td>DSP#{i + 1}</td>
                  <td>{val || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h3 className={styles.docSectionTitle}>Extra Notes</h3>
          <div className={styles.docNotesBox}>
            {wo.notes ? <p className={styles.docNote}>{wo.notes}</p> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   PURCHASE ORDER DOCUMENT — WYSIWYG with PDF output
   ═══════════════════════════════════════════════════════════════════════════ */
function PurchaseOrderDocument({ header, materials, storedPurchaseOrder }) {
  const po = storedPurchaseOrder || {};

  // Prefer stored PO values, fall back to calculated
  const getValue = (poField, matPath) => {
    if (po[poField] !== undefined && po[poField] !== null) return po[poField];
    return matPath;
  };

  const materialOrderRows = [
    { item: 'Gutter Coil 15"', qty: fmtNum(getValue("gutter_coil_total_ft", materials?.gutterCoil?.totalFt)), unit: `FT (${fmtNum(getValue("gutter_coil_total_lbs", materials?.gutterCoil?.totalLbs))} lbs)` },
    { item: 'Right End Caps - 6" K-Style', qty: fmtInt(getValue("right_end_caps_qty", materials?.endCaps?.right?.qty)), unit: "EA" },
    { item: 'Left End Caps - 6" K-Style', qty: fmtInt(getValue("left_end_caps_qty", materials?.endCaps?.left?.qty)), unit: "EA" },
    { item: '3" x 4" Downpipe 10\'ft', qty: fmtInt(getValue("downpipe_qty", materials?.downpipe?.qty)), unit: "EA" },
    { item: '3" x 4" - 6" One Piece Offset', qty: fmtInt(getValue("one_piece_offset_qty", materials?.onePieceOffset?.qty)), unit: "EA" },
    { item: '3" x 4" -(A) Elbow', qty: fmtInt(getValue("elbow_a_qty", materials?.elbow?.qty)), unit: "EA" },
    { item: "Spray Paint", qty: fmtInt(getValue("spray_paint_qty", materials?.sprayPaint?.qty)), unit: "CAN" },
    { item: '#8 x 1/2" Zip Screws', qty: fmtInt(getValue("zip_screws_qty", materials?.zipScrews?.qty)), unit: "EA" },
    { item: '6" Hidden Hangers', qty: fmtInt(getValue("hidden_hangers_qty", materials?.internal?.hiddenHangers)), unit: "EA" },
    { item: '#10 x 1-1/2" Box Screws', qty: fmtInt(getValue("box_screws_qty", materials?.internal?.boxScrews)), unit: "EA" },
  ];

  return (
    <div className={styles.printDocument}>
      {/* Header */}
      <div className={styles.docHeader}>
        <div>
          <h2 className={styles.docCompanyName}>Purchase Order</h2>
          <div className={styles.docCompanyDetail}>{toDisplay(header.project_name)}</div>
        </div>
        <div className={styles.docHeaderRight}>
          <div className={styles.docHeaderMeta}><span>PO#</span><strong>{header.proj_id}</strong></div>
          <div className={styles.docHeaderMeta}><span>Date</span><strong>{toDisplay(header.date)}</strong></div>
        </div>
      </div>

      <hr className={styles.docDivider} />

      {/* Project info */}
      <div className={styles.docSection}>
        <h3 className={styles.docSectionTitle}>Project Information</h3>
        <table className={styles.docDetailsTable}>
          <tbody>
            <tr><td className={styles.docDetailsLabel}>Customer</td><td>{toDisplay(header.customer)}</td></tr>
            <tr><td className={styles.docDetailsLabel}>Address</td><td>{toDisplay(header.project_address)}</td></tr>
            <tr><td className={styles.docDetailsLabel}>K-Style Color</td><td>{getValue("k_style_gutter_color", materials?.colors?.kStyleGutterColor) || "—"}</td></tr>
            <tr><td className={styles.docDetailsLabel}>Downspout Color</td><td>{getValue("downspout_color", materials?.colors?.downspoutColor) || "—"}</td></tr>
          </tbody>
        </table>
      </div>

      {/* Material Order */}
      <div className={styles.docSection}>
        <h3 className={styles.docSectionTitle}>Material Order</h3>
        <table className={styles.docMaterialTable}>
          <thead><tr><th>Item</th><th className={styles.textRight}>QTY</th><th>Unit</th></tr></thead>
          <tbody>
            {materialOrderRows.map((row) => (
              <tr key={row.item}>
                <td>{row.item}</td>
                <td className={styles.textRight}>{row.qty}</td>
                <td>{row.unit}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}