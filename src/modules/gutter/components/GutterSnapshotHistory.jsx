"use client";

import { useState, useEffect } from "react";
import { Container, Row, Col, Button, Modal, Table, Badge } from "react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faHistory, faEye, faPrint, faTimes } from "@fortawesome/free-solid-svg-icons";
import { formatCurrency, formatDate } from "../data/gutter.data";
import { loadProjectSnapshots, loadProjectSnapshot } from "../data/gutter.actions";

export default function GutterSnapshotHistory({ projectId, currentVersion }) {
  const [show, setShow] = useState(false);
  const [snapshots, setSnapshots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedSnapshot, setSelectedSnapshot] = useState(null);
  const [snapshotDetail, setSnapshotDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    if (show && projectId) {
      loadSnapshots();
    }
  }, [show, projectId]);

  const loadSnapshots = async () => {
    setLoading(true);
    try {
      const data = await loadProjectSnapshots(projectId);
      setSnapshots(data || []);
    } catch (err) {
      console.error("Failed to load snapshots:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleViewSnapshot = async (snapshot) => {
    setLoadingDetail(true);
    setSelectedSnapshot(snapshot);
    try {
      const data = await loadProjectSnapshot(projectId, snapshot.version_number);
      setSnapshotDetail(data);
    } catch (err) {
      console.error("Failed to load snapshot detail:", err);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handlePrintSnapshot = () => {
    if (!snapshotDetail) return;
    const snapshot = JSON.parse(snapshotDetail.snapshot_data);
    const printWindow = window.open("", "_blank");
    const project = snapshot.project;
    const pricing = snapshot.pricing;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Snapshot v${snapshotDetail.version_number} - ${project.projectName || "Untitled"}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 40px; max-width: 900px; margin: 0 auto; }
            h1 { color: #333; border-bottom: 2px solid #007bff; padding-bottom: 10px; }
            .meta { background: #f8f9fa; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
            .meta p { margin: 5px 0; }
            .section { margin-bottom: 25px; }
            .section h2 { color: #007bff; font-size: 18px; margin-bottom: 10px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
            th { background: #f8f9fa; font-weight: 600; }
            .price-row { display: flex; justify-content: space-between; padding: 5px 0; }
            .price-row.total { font-weight: bold; font-size: 16px; border-top: 2px solid #333; padding-top: 10px; margin-top: 5px; }
            .badge { display: inline-block; padding: 4px 8px; background: #007bff; color: white; border-radius: 3px; font-size: 12px; }
            @media print { body { padding: 0; } }
          </style>
        </head>
        <body>
          <h1>Project Snapshot v${snapshotDetail.version_number}</h1>
          
          <div class="meta">
            <p><strong>Project:</strong> ${project.projectName || "Untitled"}</p>
            <p><strong>Customer:</strong> ${project.customer || "—"}</p>
            <p><strong>Address:</strong> ${project.projectAddress || "—"}</p>
            <p><strong>Date:</strong> ${project.date ? new Date(project.date).toLocaleDateString() : "—"}</p>
            <p><strong>Reason:</strong> <span class="badge">${snapshotDetail.reason}</span></p>
            <p><strong>Created:</strong> ${new Date(snapshotDetail.created_at).toLocaleString()}</p>
            <p><strong>Created By:</strong> ${snapshotDetail.created_by_name || "System"}</p>
          </div>

          <div class="section">
            <h2>Project Details</h2>
            <table>
              <tr><th>Customer</th><td>${project.customer || "—"}</td></tr>
              <tr><th>Project Name</th><td>${project.projectName || "—"}</td></tr>
              <tr><th>Address</th><td>${project.projectAddress || "—"}</td></tr>
              <tr><th>Date</th><td>${project.date || "—"}</td></tr>
            </table>
          </div>

          <div class="section">
            <h2>Pricing Summary</h2>
            <div class="price-row"><span>Material Cost:</span><span>${formatCurrency(pricing?.materialCost)}</span></div>
            <div class="price-row"><span>Downspout Cost:</span><span>${formatCurrency(pricing?.downspoutCost)}</span></div>
            ${pricing?.leafGuardCost > 0 ? `<div class="price-row"><span>Leaf Guard:</span><span>${formatCurrency(pricing.leafGuardCost)}</span></div>` : ""}
            ${pricing?.tripFeePrice > 0 ? `<div class="price-row"><span>Trip Fee:</span><span>${formatCurrency(pricing.tripFeePrice)}</span></div>` : ""}
            ${pricing?.extrasPrice > 0 ? `<div class="price-row"><span>Extras:</span><span>${formatCurrency(pricing.extrasPrice)}</span></div>` : ""}
            <div class="price-row"><span>Subtotal:</span><span>${formatCurrency(pricing?.subtotal)}</span></div>
            <div class="price-row"><span>Discount (${((pricing?.discountPercent || 0) * 100).toFixed(2)}%):</span><span>-${formatCurrency(pricing?.discountAmount)}</span></div>
            <div class="price-row total"><span>Project Total:</span><span>${formatCurrency(pricing?.projectTotal)}</span></div>
            ${pricing?.depositAmount > 0 ? `<div class="price-row"><span>Deposit (${pricing?.depositPercentDisplay}%):</span><span>${formatCurrency(pricing.depositAmount)}</span></div>` : ""}
            <div class="price-row"><span>Remaining Balance:</span><span>${formatCurrency(pricing?.remainingBalance)}</span></div>
          </div>

          <div class="section">
            <h2>Sections</h2>
            <table>
              <thead>
                <tr><th>#</th><th>Gutter Color</th><th>Sides</th><th>Length</th><th>Height</th><th>Downspout Qty</th></tr>
              </thead>
              <tbody>
                ${(project.sections || []).map((s, i) => `
                  <tr>
                    <td>${i + 1}</td>
                    <td>${s.colorId || "—"}</td>
                    <td>${s.sides || "—"}</td>
                    <td>${s.length || "—"}</td>
                    <td>${s.height || "—"}</td>
                    <td>${s.downspoutQty || "—"}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>

          ${project.extrasIncluded && project.extras?.length > 0 ? `
            <div class="section">
              <h2>Extras</h2>
              <table>
                <thead><tr><th>#</th><th>Description</th><th>Qty</th><th>Unit Price</th></tr></thead>
                <tbody>
                  ${project.extras.map((e, i) => `
                    <tr><td>${i + 1}</td><td>${e.description || "—"}</td><td>${e.qty || "—"}</td><td>${e.unitPrice ? formatCurrency(e.unitPrice) : "—"}</td></tr>
                  `).join("")}
                </tbody>
              </table>
            </div>
          ` : ""}

          <script>window.onload = function() { window.print(); }</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const getStatusBadge = (reason) => {
    const colors = {
      "Quote Submitted": "primary",
      "Quote Approved": "success",
      "Work Order Generated": "warning",
      "Purchase Order Generated": "info",
      "Major Revision After Approval": "danger",
      "Project Completed": "success",
    };
    return colors[reason] || "secondary";
  };

  return (
    <>
      <Button
        variant="outline-secondary"
        size="sm"
        onClick={() => setShow(true)}
        title="View snapshot history"
      >
        <FontAwesomeIcon icon={faHistory} className="me-1" />
        History
        {currentVersion > 0 && (
          <Badge bg="primary" className="ms-1">v{currentVersion}</Badge>
        )}
      </Button>

      <Modal show={show} onHide={() => { setShow(false); setSelectedSnapshot(null); setSnapshotDetail(null); }} size="xl" centered>
        <Modal.Header closeButton>
          <Modal.Title>
            <FontAwesomeIcon icon={faHistory} className="me-2" />
            Project Snapshot History
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {!selectedSnapshot ? (
            <>
              {loading ? (
                <p className="text-center text-muted py-4">Loading snapshots...</p>
              ) : snapshots.length === 0 ? (
                <p className="text-center text-muted py-4">No snapshots yet. Snapshots are created at business milestones (submitted, approved, work order, purchase order, completed).</p>
              ) : (
                <Table striped bordered hover responsive>
                  <thead>
                    <tr>
                      <th>Version</th>
                      <th>Date</th>
                      <th>Reason</th>
                      <th>Created By</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshots.map((snapshot) => (
                      <tr key={snapshot.snapshot_id}>
                        <td><strong>v{snapshot.version_number}</strong></td>
                        <td>{new Date(snapshot.created_at).toLocaleString()}</td>
                        <td><Badge bg={getStatusBadge(snapshot.reason)}>{snapshot.reason}</Badge></td>
                        <td>{snapshot.created_by_name || "System"}</td>
                        <td>
                          <Button
                            variant="outline-primary"
                            size="sm"
                            onClick={() => handleViewSnapshot(snapshot)}
                          >
                            <FontAwesomeIcon icon={faEye} className="me-1" />
                            View
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </>
          ) : (
            <>
              {loadingDetail ? (
                <p className="text-center text-muted py-4">Loading snapshot details...</p>
              ) : snapshotDetail ? (
                <div>
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <h5>Snapshot v{snapshotDetail.version_number} - {snapshotDetail.reason}</h5>
                    <Button variant="outline-secondary" size="sm" onClick={() => { setSelectedSnapshot(null); setSnapshotDetail(null); }}>
                      <FontAwesomeIcon icon={faTimes} className="me-1" />
                      Close
                    </Button>
                  </div>
                  <div className="snapshot-detail">
                    {(() => {
                      const snapshot = JSON.parse(snapshotDetail.snapshot_data);
                      const project = snapshot.project;
                      const pricing = snapshot.pricing;
                      return (
                        <div>
                          <div className="mb-3 p-3 border rounded" style={{ background: "#f8f9fa" }}>
                            <h6 className="fw-semibold mb-2">Project Information</h6>
                            <Row>
                              <Col md={6}>
                                <p className="mb-1"><strong>Customer:</strong> {project.customer || "—"}</p>
                                <p className="mb-1"><strong>Project Name:</strong> {project.projectName || "—"}</p>
                                <p className="mb-1"><strong>Address:</strong> {project.projectAddress || "—"}</p>
                              </Col>
                              <Col md={6}>
                                <p className="mb-1"><strong>Date:</strong> {project.date || "—"}</p>
                                <p className="mb-1"><strong>Created:</strong> {new Date(snapshotDetail.created_at).toLocaleString()}</p>
                                <p className="mb-1"><strong>Created By:</strong> {snapshotDetail.created_by_name || "System"}</p>
                              </Col>
                            </Row>
                          </div>

                          <div className="mb-3 p-3 border rounded">
                            <h6 className="fw-semibold mb-2">Pricing Summary</h6>
                            <Row>
                              <Col md={6}>
                                <div className="price-row"><span>Material Cost:</span><span>{formatCurrency(pricing?.materialCost)}</span></div>
                                <div className="price-row"><span>Downspout Cost:</span><span>{formatCurrency(pricing?.downspoutCost)}</span></div>
                                {pricing?.leafGuardCost > 0 && <div className="price-row"><span>Leaf Guard:</span><span>{formatCurrency(pricing.leafGuardCost)}</span></div>}
                                {pricing?.tripFeePrice > 0 && <div className="price-row"><span>Trip Fee:</span><span>{formatCurrency(pricing.tripFeePrice)}</span></div>}
                                {pricing?.extrasPrice > 0 && <div className="price-row"><span>Extras:</span><span>{formatCurrency(pricing.extrasPrice)}</span></div>}
                              </Col>
                              <Col md={6}>
                                <div className="price-row"><span>Subtotal:</span><span>{formatCurrency(pricing?.subtotal)}</span></div>
                                <div className="price-row"><span>Discount ({(pricing?.discountPercent * 100).toFixed(2)}%):</span><span>-{formatCurrency(pricing?.discountAmount)}</span></div>
                                <div className="price-row total"><span>Project Total:</span><span>{formatCurrency(pricing?.projectTotal)}</span></div>
                                {pricing?.depositAmount > 0 && <div className="price-row"><span>Deposit ({pricing?.depositPercentDisplay}%):</span><span>{formatCurrency(pricing.depositAmount)}</span></div>}
                                <div className="price-row"><span>Remaining Balance:</span><span>{formatCurrency(pricing?.remainingBalance)}</span></div>
                              </Col>
                            </Row>
                          </div>

                          {project.sections?.length > 0 && (
                            <div className="mb-3 p-3 border rounded">
                              <h6 className="fw-semibold mb-2">Sections</h6>
                              <Table striped bordered hover size="sm">
                                <thead>
                                  <tr><th>#</th><th>Gutter Color</th><th>Sides</th><th>Length</th><th>Height</th><th>Downspout Qty</th></tr>
                                </thead>
                                <tbody>
                                  {project.sections.map((s, i) => (
                                    <tr key={i}>
                                      <td>{i + 1}</td>
                                      <td>{s.colorId || "—"}</td>
                                      <td>{s.sides || "—"}</td>
                                      <td>{s.length || "—"}</td>
                                      <td>{s.height || "—"}</td>
                                      <td>{s.downspoutQty || "—"}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </Table>
                            </div>
                          )}

                          {project.extrasIncluded && project.extras?.length > 0 && (
                            <div className="mb-3 p-3 border rounded">
                              <h6 className="fw-semibold mb-2">Extras</h6>
                              <Table striped bordered hover size="sm">
                                <thead><tr><th>#</th><th>Description</th><th>Qty</th><th>Unit Price</th></tr></thead>
                                <tbody>
                                  {project.extras.map((e, i) => (
                                    <tr key={i}>
                                      <td>{i + 1}</td>
                                      <td>{e.description || "—"}</td>
                                      <td>{e.qty || "—"}</td>
                                      <td>{e.unitPrice ? formatCurrency(e.unitPrice) : "—"}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </Table>
                            </div>
                          )}

                          <div className="d-flex gap-2 mt-3">
                            <Button variant="primary" onClick={handlePrintSnapshot}>
                              <FontAwesomeIcon icon={faPrint} className="me-1" />
                              Print Snapshot
                            </Button>
                            <Button variant="secondary" onClick={() => { setSelectedSnapshot(null); setSnapshotDetail(null); }}>
                              Back to List
                            </Button>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              ) : (
                <p className="text-center text-muted">Failed to load snapshot details.</p>
              )}
            </>
          )}
        </Modal.Body>
      </Modal>
    </>
  );
}