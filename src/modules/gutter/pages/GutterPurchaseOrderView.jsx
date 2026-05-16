"use client";

import { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { Container, Row, Col, Table, Form } from "react-bootstrap";
import { Button, Card, toastError, toastSuccess } from "@/shared/components/ui";
import { savePurchaseOrder } from "../data/gutter.actions";
import { calculateMaterials } from "../data/gutter.data";

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatNumber = (value, fractionDigits = 2) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "0";
  return numeric.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: fractionDigits });
};

export default function GutterPurchaseOrderView({ projectId, projectData, storedPurchaseOrder }) {
  const header = projectData?.projectHeader || null;

  const sides = useMemo(() => projectData?.projectSides || [], [projectData?.projectSides]);
  const colors = useMemo(() => projectData?.colors || [], [projectData?.colors]);

  const [manualInputs, setManualInputs] = useState(() => {
    const stored = storedPurchaseOrder;
    return {
      zipScrewsQty: String(toNumber(stored?.zip_screws_qty)),
      sprayPaintQty: String(toNumber(stored?.spray_paint_qty)),
      boxScrewsQty: String(toNumber(stored?.box_screws_qty)),
    };
  });
  const [saving, setSaving] = useState(false);

  // Build color lookup
  const colorById = useMemo(() => {
    const map = {};
    (Array.isArray(colors) ? colors : []).forEach((c) => { map[String(c.color_id)] = c.name; });
    return map;
  }, [colors]);

  // Build sections for calculateMaterials
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

  const handleSave = useCallback(async () => {
    if (!projectId || !materials) return;
    setSaving(true);
    try {
      await savePurchaseOrder(projectId, {
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
      toastSuccess("Purchase order saved.", "Purchase Order");
    } catch (err) {
      toastError(err?.message || "Unable to save purchase order.", "Purchase Order");
    } finally {
      setSaving(false);
    }
  }, [projectId, materials]);

  if (!header || !materials) return <Container className="py-4">Project not found.</Container>;

  return (
    <Container className="py-4" style={{ maxWidth: 900 }}>
      <div className="d-flex align-items-center mb-3">
        <Link href={`/gutter/${projectId}`} className="back-link me-3">
          <i className="bi bi-arrow-left" aria-hidden="true" /> Back to Project
        </Link>
        <div>
          <h2 className="mb-0">Purchase Order</h2>
          <p className="text-muted mb-0">{header.project_name || header.proj_id}</p>
        </div>
      </div>

      <Card className="mb-3" title="Project Information">
        <Row className="g-2">
          <Col md={6}>
            <p className="small mb-1"><strong>Customer:</strong> {header.customer || "--"}</p>
            <p className="small mb-1"><strong>Project:</strong> {header.project_name || "--"}</p>
          </Col>
          <Col md={6}>
            <p className="small mb-1"><strong>Address:</strong> {header.project_address || "--"}</p>
            <p className="small mb-1"><strong>Date:</strong> {header.date || "--"}</p>
          </Col>
        </Row>
      </Card>

      <Card className="mb-3" title="Material Fields">
        <Table size="sm" bordered>
          <thead>
            <tr>
              <th style={{ width: "50%" }}>Field</th>
              <th style={{ width: "22%" }}>Qty / Value</th>
              <th style={{ width: "28%" }}>Color / Note</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>K-Style Gutter Color:</td><td>--</td><td>{materials.colors.kStyleGutterColor}</td></tr>
            <tr><td>Downspout Color:</td><td>--</td><td>{materials.colors.downspoutColor}</td></tr>
            <tr><td>Gutter Coil 15&quot;</td><td>{formatNumber(materials.gutterCoil.totalFt)} ft</td><td>{materials.gutterCoil.color} ({formatNumber(materials.gutterCoil.totalLbs, 3)} lbs)</td></tr>
            <tr><td>Right End Caps - 6&quot; K-Style</td><td>{formatNumber(materials.endCaps.right.qty)}</td><td>{materials.endCaps.right.color}</td></tr>
            <tr><td>Left End Caps - 6&quot; K-Style</td><td>{formatNumber(materials.endCaps.left.qty)}</td><td>{materials.endCaps.left.color}</td></tr>
            <tr><td>3&quot; x 4&quot; Downpipe 10&apos;ft</td><td>{formatNumber(materials.downpipe.qty)}</td><td>{materials.downpipe.color}</td></tr>
            <tr><td>3&quot; x 4&quot; - 6&quot; One Piece Offset</td><td>{formatNumber(materials.onePieceOffset.qty)}</td><td>{materials.onePieceOffset.color}</td></tr>
            <tr><td>3&quot; x 4&quot; -(A) Elbow</td><td>{formatNumber(materials.elbow.qty)}</td><td>{materials.elbow.color}</td></tr>
            <tr>
              <td>Spray Paint for Touch up:</td>
              <td><Form.Control size="sm" type="number" min="0" step="1" value={manualInputs.sprayPaintQty} onChange={(e) => handleManualInputChange("sprayPaintQty", e.target.value)} /></td>
              <td>{materials.sprayPaint.color}</td>
            </tr>
            <tr>
              <td>#8 x 1/2&quot; Zip Screws</td>
              <td><Form.Control size="sm" type="number" min="0" step="1" value={manualInputs.zipScrewsQty} onChange={(e) => handleManualInputChange("zipScrewsQty", e.target.value)} /></td>
              <td>{materials.zipScrews.color}</td>
            </tr>
            <tr><td>#8 x 1/2&quot; Zip Screws</td><td>{formatNumber(materials.internal.internalScrews)}</td><td>Internal Use Only</td></tr>
          </tbody>
        </Table>
      </Card>

      <Card className="mb-3" header={<span className="fw-bold text-danger">Internal Information (Do Not Print)</span>}>
        <Table size="sm" bordered>
          <thead>
            <tr>
              <th style={{ width: "60%" }}>Field</th>
              <th style={{ width: "40%" }}>Value</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>Total Downspouts</td><td>{formatNumber(materials.internal.totalDownspouts)}</td></tr>
            <tr><td>Total Endcaps</td><td>{formatNumber(materials.internal.totalEndcaps)}</td></tr>
            <tr><td>3&quot; x 4&quot; Rectangular Outlets</td><td>{formatNumber(materials.internal.rectangularOutlets)}</td></tr>
            <tr><td>Qty of Screws (Internal Use Only)</td><td>{formatNumber(materials.internal.internalScrews)}</td></tr>
            <tr><td>6&quot; Hidden Hangers</td><td>{formatNumber(materials.internal.hiddenHangers)}</td></tr>
            <tr>
              <td>Box of Metal to Metal Screws for Hangers</td>
              <td><Form.Control size="sm" type="number" min="0" step="1" value={manualInputs.boxScrewsQty} onChange={(e) => handleManualInputChange("boxScrewsQty", e.target.value)} /></td>
            </tr>
          </tbody>
        </Table>
      </Card>

      <div className="d-flex gap-2 mb-4">
        <Button variant="success" onClick={handleSave} disabled={saving} loading={saving}>
          {saving ? "Saving..." : "Save Purchase Order"}
        </Button>
        {header.request_link && (
          <Button variant="secondary" onClick={() => window.open(header.request_link, "_blank", "noopener,noreferrer")}>
            Open Source Sheet
          </Button>
        )}
      </div>
    </Container>
  );
}
