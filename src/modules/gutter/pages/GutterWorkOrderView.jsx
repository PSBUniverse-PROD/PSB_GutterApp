"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Container, Form } from "react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowLeft, faPrint, faCheck, faRulerCombined, faBoxOpen, faSignsPost } from "@fortawesome/free-solid-svg-icons";
import { faBuilding, faPenToSquare, faIdBadge, faNoteSticky } from "@fortawesome/free-regular-svg-icons";
import { Button, toastSuccess, toastError } from "@/shared/components/ui";
import Image from "next/image";
import { pdf } from "@react-pdf/renderer";
import { WorkOrderPdf } from "./GutterPdfDocuments";
import { calculateMaterials, calculateQuote } from "../data/gutter.data";
import logoImg from "../assets/PSGD Logo.png";
import { saveGutterWorkOrder } from "../data/gutter.actions";
import { getPSBUserPayloadFromCookie } from "@/core/sso-client";
import styles from "./GutterWorkOrder.module.css";

const MAX_SIZE_ROWS = 10;
const MAX_DSP_ROWS = 8;

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

const buildInitialWorkOrder = (saved) => {
  const assignments = Array.from({ length: MAX_DSP_ROWS }, (_, index) => {
    if (saved?.downspoutAssignments && Array.isArray(saved.downspoutAssignments)) {
      return String(saved.downspoutAssignments[index] ?? "");
    }
    return "";
  });

  const zipScrewsBags = Array.isArray(saved?.zipScrewsBags) && saved.zipScrewsBags.length > 0
    ? saved.zipScrewsBags.map((row) => ({
        qty: row?.qty !== undefined && row?.qty !== null ? String(row.qty) : "1",
        color: row?.color !== undefined && row?.color !== null ? String(row.color) : "",
      }))
    : [{ qty: "1", color: "" }];

  return {
    workOrderNo: saved?.work_order_no ? String(saved.work_order_no) : "",
    workOrderDate: saved?.work_order_date ? String(saved.work_order_date) : "",
    installerName: saved?.installer_name ? String(saved.installer_name) : "",
    installDate: saved?.installation_date ? String(saved.installation_date) : "",
    notes: saved?.notes ? String(saved.notes) : "",
    installerSignature: saved?.signature_name ? String(saved.signature_name) : "",
    signatureDate: saved?.signature_date ? String(saved.signature_date) : "",
    downspoutAssignments: assignments,
    gutterSize: "6 inch K-Style",
    zipScrewsBags,
  };
};

export default function GutterWorkOrderView({ projectId, projectData, manufacturerName, workOrderData, setup }) {
  const router = useRouter();
  const header = projectData?.projectHeader || null;
  const sides = projectData?.projectSides || [];
  const colors = projectData?.colors || [];

  const initialWorkOrder = buildInitialWorkOrder(workOrderData);
  const [workOrder, setWorkOrder] = useState(initialWorkOrder);
  const [baselineSnapshot, setBaselineSnapshot] = useState(() => workOrderData ? JSON.stringify(initialWorkOrder) : null);

  const [saving, setSaving] = useState(false);
  const [navigatingPrint, setNavigatingPrint] = useState(false);

  const colorById = useMemo(() => {
    const map = {};
    (Array.isArray(colors) ? colors : []).forEach((c) => { map[String(c.color_id)] = c.name; });
    return map;
  }, [colors]);

  const sections = useMemo(() => {
    return (Array.isArray(sides) ? sides : []).map((side) => {
      const gutterColor = colorById[String(side.gutter_color_id)] || "--";
      const downspoutColor = colorById[String(side.downspout_color_id)] || gutterColor || "--";
      return {
        sides: side.segments,
        length: side.length,
        height: side.height,
        downspoutQty: side.downspout_qty,
        color: gutterColor,
        gutterColor,
        downspoutColor,
      };
    });
  }, [sides, colorById]);

  const materials = useMemo(() => {
    if (!sections.length) return null;
    const totalZip = workOrder.zipScrewsBags
      .reduce((sum, r) => sum + (parseInt(r.qty, 10) || 0), 0);
    return calculateMaterials({ sections, zipScrewsQty: totalZip });
  }, [sections, workOrder.zipScrewsBags]);

  const sectionRows = useMemo(() => {
    return sections.map((sec, i) => ({
      index: i + 1,
      length: sec.length,
      height: sec.height,
      sides: sec.sides,
      gutterColor: sec.gutterColor,
      downspoutColor: sec.downspoutColor,
      downspoutQty: sec.downspoutQty,
    }));
  }, [sections]);

  const dspRows = useMemo(() => Array.from({ length: MAX_DSP_ROWS }, (_, i) => i + 1), []);

  const currentSnapshot = useMemo(() => JSON.stringify(workOrder), [workOrder]);
  const hasChanges = baselineSnapshot === null || currentSnapshot !== baselineSnapshot;

  const saveWorkOrder = useCallback(async () => {
    setSaving(true);
    try {
      const session = getPSBUserPayloadFromCookie();
      const userId = session?.userId || null;
      await saveGutterWorkOrder({ projectId, workOrder, _userId: userId });
      setBaselineSnapshot(currentSnapshot);
      toastSuccess("Work order saved.", "Work Order");
    } catch (err) {
      toastError(err?.message || "Error saving work order.", "Work Order");
    } finally {
      setSaving(false);
    }
  }, [currentSnapshot, projectId, workOrder]);

  const updateField = (field, value) => setWorkOrder((prev) => ({ ...prev, [field]: value }));

  const updateZipScrewsBag = (index, field, value) => {
    setWorkOrder((prev) => {
      const bags = [...prev.zipScrewsBags];
      bags[index] = { ...bags[index], [field]: value };
      return { ...prev, zipScrewsBags: bags };
    });
  };

  const addZipScrewsBag = () => {
    setWorkOrder((prev) => ({
      ...prev,
      zipScrewsBags: [...prev.zipScrewsBags, { qty: "1", color: "" }],
    }));
  };

  const removeZipScrewsBag = (index) => {
    setWorkOrder((prev) => ({
      ...prev,
      zipScrewsBags: prev.zipScrewsBags.filter((_, i) => i !== index),
    }));
  };

  const updateDownspoutAssignment = (index, value) => {
    setWorkOrder((prev) => {
      const next = [...(prev.downspoutAssignments || [])];
      next[index] = value;
      return { ...prev, downspoutAssignments: next };
    });
  };
  const companyProfile = useMemo(() => {
    const c = Array.isArray(setup?.company) ? setup.company[0] : setup?.company || {};
    return {
      name: c.short_name || c.comp_name || "Company",
      email: c.comp_email || "",
      phone: c.comp_phone || "",
    };
  }, [setup]);
  const logoUrl = useMemo(() => (typeof logoImg === "object" && logoImg?.src ? logoImg.src : logoImg), []);

  // Direct PDF print
  const handlePrint = useCallback(async () => {
    if (hasChanges) {
      setNavigatingPrint(true);
      try {
        await saveGutterWorkOrder({ projectId, workOrder });
        setBaselineSnapshot(currentSnapshot);
      } catch (err) {
        toastError(err?.message || "Error saving before print. Please save manually.", "Work Order");
        setNavigatingPrint(false);
        return;
      } finally {
        setNavigatingPrint(false);
      }
    }
    setNavigatingPrint(true);
    try {
      const doc = (
        <WorkOrderPdf
          header={header}
          sides={sides}
          materials={materials}
          companyProfile={companyProfile}
          workOrderData={workOrder}
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
      setNavigatingPrint(false);
    }
  }, [hasChanges, projectId, workOrder, header, sides, materials, companyProfile, logoUrl, saveGutterWorkOrder, currentSnapshot]);

  if (!header) return <Container className="py-4">Project not found.</Container>;

  return (
    <div className={styles.woPage}>
      {/* ─── Compact Top Header ─── */}
      <div className={styles.woHeader}>
        <div className={styles.woHeaderLeft}>
          <Link href={`/gutter/${projectId}`} className={styles.woBackLink}>
            <FontAwesomeIcon icon={faArrowLeft} aria-hidden="true" />
          </Link>
          <div className={styles.woHeaderTitle}>
            <h1 className={styles.woTitle}>Work Order</h1>
            <span className={styles.woSubtitle}>{header.project_name || `Project #${header.proj_id}`}</span>
          </div>
          <div className={styles.woHeaderMeta}>
            <div className={styles.woMetaItem}>
              <span className={styles.woMetaLabel}>Project #</span>
              <span className={styles.woMetaValue}>{toDisplay(header.proj_id)}</span>
            </div>
            <div className={styles.woMetaItem}>
              <span className={styles.woMetaLabel}>Address</span>
              <span className={styles.woMetaValue}>{toDisplay(header.project_address)}</span>
            </div>
          </div>
        </div>
        <div className={styles.woHeaderActions}>
          <Button variant="success" onClick={saveWorkOrder} disabled={saving || !hasChanges} loading={saving}>
            <FontAwesomeIcon icon={faCheck} className="me-1" /> Save Work Order
          </Button>
          <Button variant="secondary" onClick={handlePrint} disabled={navigatingPrint} loading={navigatingPrint}>
            <FontAwesomeIcon icon={faPrint} className="me-1" /> Print / PDF
          </Button>
        </div>
      </div>

      {/* ─── Workspace Body ─── */}
      <div className={styles.woBody}>
        {/* ─── Main Content (Left) ─── */}
        <div className={styles.woMain}>

          {/* Project + Gutter Config */}
          <div className={styles.woSection}>
            <div className={styles.woSectionHeader}>
              <FontAwesomeIcon icon={faBuilding} /> Project & Configuration
            </div>
            <div className={styles.woSectionBody}>
              <div className={styles.woInfoGrid}>
                <div className={styles.woCompanyBlock}>
                  <strong className={styles.woCompanyName}>Premium Gutters & DOORS</strong>
                  <span className={styles.woCompanyDetail}>sales.pdg@premiumsteelgroup.com</span>
                  <span className={styles.woCompanyDetail}>817-502-2520</span>
                </div>
                <div className={styles.woConfigGrid}>
                  <div className={styles.woConfigItem}>
                    <span className={styles.woConfigLabel}>K-Style Gutter Color</span>
                    <span className={styles.woConfigValue}>{materials?.colors?.kStyleGutterColor || "--"}</span>
                  </div>
                  <div className={styles.woConfigItem}>
                    <span className={styles.woConfigLabel}>Downspout Color</span>
                    <span className={styles.woConfigValue}>{materials?.colors?.downspoutColor || "--"}</span>
                  </div>
                  <div className={styles.woConfigItem}>
                    <span className={styles.woConfigLabel}>Manufacturer</span>
                    <span className={styles.woConfigValue}>{manufacturerName || "--"}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Gutter & Downspout Sections */}
          <div className={styles.woSection}>
            <div className={styles.woSectionHeader}>
              <FontAwesomeIcon icon={faRulerCombined} /> Gutter & Downspout Sections
            </div>
            <div className={styles.woSectionBody}>
              {sectionRows.map((row) => (
                <div key={row.index} className={styles.woSectionCard}>
                  <div className={styles.woSectionCardTitle}>Section {row.index}</div>
                  <div className={styles.woSectionCardGrid}>
                    <div className={styles.woSectionCardGroup}>
                      <div className={styles.woSectionCardGroupLabel}>Gutter</div>
                      <div className={styles.woSectionCardRow}>
                        <span className={styles.woSectionCardLabel}>Color</span>
                        <span className={styles.woSectionCardValue}>{row.gutterColor}</span>
                      </div>
                      <div className={styles.woSectionCardRow}>
                        <span className={styles.woSectionCardLabel}>Sides</span>
                        <span className={styles.woSectionCardValue}>{toDisplay(row.sides) || "—"}</span>
                      </div>
                      <div className={styles.woSectionCardRow}>
                        <span className={styles.woSectionCardLabel}>Length (LF)</span>
                        <span className={styles.woSectionCardValue}>{toDisplay(row.length) || "—"}</span>
                      </div>
                      <div className={styles.woSectionCardRow}>
                        <span className={styles.woSectionCardLabel}>Height (FT)</span>
                        <span className={styles.woSectionCardValue}>{toDisplay(row.height) || "—"}</span>
                      </div>
                    </div>
                    <div className={styles.woSectionCardGroup}>
                      <div className={styles.woSectionCardGroupLabel}>Downspout</div>
                      <div className={styles.woSectionCardRow}>
                        <span className={styles.woSectionCardLabel}>Color</span>
                        <span className={styles.woSectionCardValue}>{row.downspoutColor}</span>
                      </div>
                      <div className={styles.woSectionCardRow}>
                        <span className={styles.woSectionCardLabel}>Quantity</span>
                        <span className={styles.woSectionCardValue}>{toDisplay(row.downspoutQty) || "—"}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
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
                    <td>Gutter Coil 15"</td>
                    <td>{toDecimalDisplay(materials?.gutterCoil?.totalFt)}</td>
                    <td>{Math.trunc(materials?.gutterCoil?.totalLbs || 0)}</td>
                    <td>{materials?.gutterCoil?.color || "--"}</td>
                  </tr>
                </tbody>
              </table>

              {/* Parts */}
              <table className={styles.woTable} style={{ marginTop: "10px" }}>
                <thead>
                  <tr><th>Item</th><th>QTY</th><th>Color</th></tr>
                </thead>
                <tbody>
                  <tr><td>Right End Caps - 6" K-Style</td><td>{toWholeDisplay(materials?.endCaps?.right?.qty)}</td><td>{materials?.endCaps?.right?.color || "--"}</td></tr>
                  <tr><td>Left End Caps - 6" K-Style</td><td>{toWholeDisplay(materials?.endCaps?.left?.qty)}</td><td>{materials?.endCaps?.left?.color || "--"}</td></tr>
                  <tr><td>3" x 4" Downpipe 10'ft</td><td>{toWholeDisplay(materials?.downpipe?.qty)}</td><td>{materials?.downpipe?.color || "--"}</td></tr>
                  <tr><td>3" x 4" - 6" One Piece Offset</td><td>{toWholeDisplay(materials?.onePieceOffset?.qty)}</td><td>{materials?.onePieceOffset?.color || "--"}</td></tr>
                  <tr><td>3" x 4" -(A) Elbow</td><td>{toWholeDisplay(materials?.elbow?.qty)}</td><td>{materials?.elbow?.color || "--"}</td></tr>
                  <tr><td>6" Hidden Hangers</td><td>{toWholeDisplay(materials?.internal?.hiddenHangers)}</td><td>Auto</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Sketch Workspace */}
          <div className={styles.woSection}>
            <div className={styles.woSectionHeader}>
              <FontAwesomeIcon icon={faPenToSquare} /> Sketch / Diagram
            </div>
            <div className={styles.woSectionBody}>
              <div className={styles.woSketchContainer}>
                <div className={styles.woSketchCanvas}>
                  <span className={styles.woSketchLabelTop}>Front</span>
                  <span className={styles.woSketchLabelBottom}>Back</span>
                  <span className={styles.woSketchLabelLeft}>Left</span>
                  <span className={styles.woSketchLabelRight}>Right</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ─── Utility Sidebar (Right) ─── */}
        <div className={styles.woSidebar}>

          {/* Installer Info */}
          <div className={styles.woSection}>
            <div className={styles.woSectionHeader}>
              <FontAwesomeIcon icon={faIdBadge} /> Details
            </div>
            <div className={styles.woSectionBody}>
              <Form.Group className="mb-2">
                <Form.Label className={styles.woFormLabel}>PO#</Form.Label>
                <Form.Control size="sm" value={workOrder.workOrderNo} onChange={(e) => updateField("workOrderNo", e.target.value)} placeholder="Enter purchase order number" />
              </Form.Group>
              <Form.Group className="mb-2">
                <Form.Label className={styles.woFormLabel}>Date</Form.Label>
                <Form.Control size="sm" type="date" value={workOrder.workOrderDate} onChange={(e) => updateField("workOrderDate", e.target.value)} />
              </Form.Group>
              <Form.Group className="mb-2">
                <Form.Label className={styles.woFormLabel}>Installer Name</Form.Label>
                <Form.Control size="sm" value={workOrder.installerName} onChange={(e) => updateField("installerName", e.target.value)} />
              </Form.Group>
              <Form.Group className="mb-2">
                <Form.Label className={styles.woFormLabel}>Installation Date</Form.Label>
                <Form.Control size="sm" type="date" value={workOrder.installDate} onChange={(e) => updateField("installDate", e.target.value)} />
              </Form.Group>
              <Form.Group className="mb-2">
                <Form.Label className={styles.woFormLabel}>Signature</Form.Label>
                <Form.Control size="sm" value={workOrder.installerSignature} onChange={(e) => updateField("installerSignature", e.target.value)} />
              </Form.Group>
              <Form.Group>
                <Form.Label className={styles.woFormLabel}>Signature Date</Form.Label>
                <Form.Control size="sm" type="date" value={workOrder.signatureDate} onChange={(e) => updateField("signatureDate", e.target.value)} />
              </Form.Group>
            </div>
          </div>

          {/* DSP Assignments */}
          <div className={styles.woSection}>
            <div className={styles.woSectionHeader}>
              <FontAwesomeIcon icon={faSignsPost} /> DSP Assignments
            </div>
            <div className={styles.woSectionBody}>
              <div className={styles.woDspGrid}>
                {dspRows.map((dspNumber, index) => (
                  <div key={`dsp-${dspNumber}`} className={styles.woDspRow}>
                    <label className={styles.woDspLabel}>DSP#{dspNumber}</label>
                    <Form.Control size="sm" className={styles.woDspInput} value={toDisplay(workOrder.downspoutAssignments[index])} onChange={(e) => updateDownspoutAssignment(index, e.target.value)} />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Zip Screws */}
          <div className={styles.woSection}>
            <div className={styles.woSectionHeader}>
              <FontAwesomeIcon icon={faBoxOpen} /> #8 x 1/2" Zip Screws <span style={{ fontWeight: 400, fontSize: "0.8rem", color: "#6c757d" }}>(100 per bag)</span>
            </div>
            <div className={styles.woSectionBody}>
              {workOrder.zipScrewsBags.map((row, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                  <Form.Control size="sm" type="number" min="1" step="1" style={{ width: 70 }} placeholder="Bags" value={row.qty} onChange={(e) => updateZipScrewsBag(i, "qty", e.target.value)} />
                  <Form.Select size="sm" style={{ width: 160 }} value={row.color} onChange={(e) => updateZipScrewsBag(i, "color", e.target.value)}>
                    <option value="">-- Color --</option>
                    {colors.map((c) => <option key={c.color_id} value={c.name}>{c.name}</option>)}
                  </Form.Select>
                  {workOrder.zipScrewsBags.length > 1 && (
                    <button type="button" className="btn btn-sm btn-outline-danger py-0 px-1" onClick={() => removeZipScrewsBag(i)}>&times;</button>
                  )}
                </div>
              ))}
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={addZipScrewsBag}>+ Add Color</button>
            </div>
          </div>

          {/* Notes */}
          <div className={styles.woSection}>
            <div className={styles.woSectionHeader}>
              <FontAwesomeIcon icon={faNoteSticky} /> Notes
            </div>
            <div className={styles.woSectionBody}>
              <Form.Control as="textarea" rows={5} value={workOrder.notes} onChange={(e) => updateField("notes", e.target.value)} placeholder="Installation notes, special instructions..." className={styles.woNotesInput} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}