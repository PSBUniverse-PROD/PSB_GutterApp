"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Container } from "react-bootstrap";
import { Button, Modal, TableZ, toastError, toastSuccess } from "@/shared/components/ui";
import { createFilterConfig, TABLE_FILTER_TYPES } from "@/shared/components/ui/table/filterSchema";
import { updateGutterProjectStatus, deleteGutterProject } from "../data/gutter.actions";
import { formatCurrency, toPercentLabel, statusToneClass } from "../data/gutter.data";

const resolveRelated = (value) => {
  if (Array.isArray(value)) return value[0] || null;
  return value && typeof value === "object" ? value : null;
};

const getStatusName = (p, statuses) => {
  const rel = resolveRelated(p.gtr_s_statuses);
  if (rel?.name) return rel.name;
  const match = statuses.find((s) => String(s.status_id) === String(p.status_id));
  return match?.name || "In Progress";
};

const getManufacturerName = (p) => resolveRelated(p.gtr_s_manufacturers)?.name || "--";
const getTripLabel = (p) => resolveRelated(p.gtr_s_trip_rates)?.label || "--";

const readProjectTotal = (p) => {
  const t = Number(p?.total_project_price ?? p?.project_total_price);
  return Number.isFinite(t) ? t : null;
};

export default function GutterView({ projects = [], statuses = [] }) {
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [statusModal, setStatusModal] = useState(null);
  const [busy, setBusy] = useState(false);

  // Build status filter options
  const statusOptions = useMemo(() => {
    const set = new Set();
    statuses.forEach((s) => { if (s?.name) set.add(s.name); });
    projects.forEach((p) => { const n = getStatusName(p, statuses); if (n) set.add(n); });
    return Array.from(set).map((name) => ({ label: name, value: name }));
  }, [statuses, projects]);

  // Enrich rows for table
  const rows = useMemo(() =>
    projects.map((p) => {
      const statusName = getStatusName(p, statuses);
      const total = readProjectTotal(p);
      return {
        ...p,
        _statusName: statusName,
        _manufacturerName: getManufacturerName(p),
        _tripLabel: getTripLabel(p),
        _totalLabel: total === null ? "--" : formatCurrency(total),
        _totalRaw: total ?? 0,
        _depositLabel: toPercentLabel(p.deposit_percent),
        _dateLabel: p.date ? new Date(p.date).toLocaleDateString("en-US", { year: "numeric", month: "2-digit", day: "2-digit" }) : "--",
        _createdAtLabel: p.created_at ? new Date(p.created_at).toLocaleString() : "--",
        _updatedAtLabel: p.updated_at ? new Date(p.updated_at).toLocaleString() : "--",
      };
    }),
  [projects, statuses]);

  // Completed projects total
  const completedTotal = useMemo(() => {
    return rows.reduce((sum, r) => {
      if (!r._statusName.toLowerCase().includes("complete")) return sum;
      return sum + (r._totalRaw || 0);
    }, 0);
  }, [rows]);

  const columns = useMemo(() => [
    {
      key: "project_name",
      label: "Project / ID",
      sortable: true,
      render: (row) => (
        <div>
          <p className="fw-semibold mb-0">{row.project_name || "(Untitled)"}</p>
          <p className="text-muted small mb-0">#{row.proj_id || "--"}</p>
        </div>
      ),
    },
    {
      key: "customer",
      label: "Customer & Location",
      sortable: true,
      render: (row) => (
        <div>
          <p className="mb-0">{row.customer || "--"}</p>
          <p className="text-muted small mb-0">{row.project_address || "--"}</p>
        </div>
      ),
    },
    {
      key: "_statusName",
      label: "Status",
      sortable: true,
      render: (row) => (
        <span className={`gutter-status-pill ${statusToneClass(row._statusName)}`}>
          {row._statusName}
        </span>
      ),
    },
    {
      key: "_manufacturerName",
      label: "Manufacturer",
      sortable: true,
      render: (row) => (
        <div>
          <p className="mb-0">{row._manufacturerName}</p>
          <p className="text-muted small mb-0">Date: {row._dateLabel}</p>
        </div>
      ),
    },
    {
      key: "_tripLabel",
      label: "Logistics",
      sortable: true,
      render: (row) => (
        <div>
          <p className="mb-0">{row._tripLabel}</p>
          {row.request_link ? (
            <a href={row.request_link} target="_blank" rel="noreferrer" className="small text-primary" onClick={(e) => e.stopPropagation()}>
              Open request link
            </a>
          ) : (
            <p className="text-muted small mb-0">No request link</p>
          )}
        </div>
      ),
    },
    {
      key: "_totalRaw",
      label: "Project Total",
      sortable: true,
      align: "right",
      render: (row) => (
        <div className="text-end">
          <p className="fw-semibold mb-0">{row._totalLabel}</p>
          <p className="text-muted small mb-0">Deposit: {row._depositLabel}</p>
        </div>
      ),
    },
    {
      key: "updated_by_name",
      label: "Updated by",
      sortable: true,
      render: (row) => (
        <div>
          <p className="mb-0">{row.updated_by_name || "--"}</p>
          <p className="text-muted small mb-0">{row._updatedAtLabel}</p>
        </div>
      ),
    },
  ], []);

  const filterConfig = useMemo(() =>
    createFilterConfig([
      { key: "_statusName", type: TABLE_FILTER_TYPES.SELECT, label: "Status", options: statusOptions },
    ]),
  [statusOptions]);

  // Actions
  const handleSetStatus = useCallback(async () => {
    if (!statusModal) return;
    setBusy(true);
    try {
      await updateGutterProjectStatus(statusModal.projId, statusModal.statusId);
      toastSuccess("Status updated.", "Gutter");
      setStatusModal(null);
      router.refresh();
    } catch (err) {
      toastError(err?.message || "Failed to update status.", "Gutter");
    } finally {
      setBusy(false);
    }
  }, [statusModal, router]);

  const handleDelete = useCallback(async () => {
    if (!confirmDelete) return;
    setBusy(true);
    try {
      await deleteGutterProject(confirmDelete);
      toastSuccess("Project deleted.", "Gutter");
      setConfirmDelete(null);
      router.refresh();
    } catch (err) {
      toastError(err?.message || "Failed to delete project.", "Gutter");
    } finally {
      setBusy(false);
    }
  }, [confirmDelete, router]);

  const actions = useMemo(() => [
    {
      key: "work-order",
      label: "Work Order",
      icon: "list-check",
      type: "secondary",
      onClick: (row) => router.push(`/gutter/${row.proj_id}/work-order`),
    },
    {
      key: "purchase-order",
      label: "Purchase Order",
      icon: "box",
      type: "secondary",
      onClick: (row) => router.push(`/gutter/${row.proj_id}/purchase-order`),
    },
    {
      key: "delete",
      label: "Delete",
      icon: "trash",
      type: "danger",
      confirm: true,
      confirmMessage: "Delete this project? This cannot be undone.",
      onClick: (row) => setConfirmDelete(row.proj_id),
    },
  ], [router]);

  return (
    <Container fluid className="px-3 px-lg-4 py-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h2 className="mb-1 fw-bold">Saved Projects</h2>
          <p className="text-muted mb-0">Manage gutter quote projects.</p>
        </div>
        <div className="d-flex gap-2">
          <Button variant="primary" onClick={() => router.push("/gutter/new")}>Create Project</Button>
        </div>
      </div>

      <div className="mb-3 p-3 border rounded" style={{ background: "linear-gradient(135deg, #f8fbff, #edf5ff)" }}>
        <p className="text-muted small mb-1">Total Price of Completed Projects</p>
        <p className="fw-bold fs-5 mb-0">{formatCurrency(completedTotal)}</p>
      </div>

      <TableZ
        data={rows}
        columns={columns}
        rowIdKey="proj_id"
        actions={actions}
        filterConfig={filterConfig}
        searchPlaceholder="Search by project, customer, address, status, manufacturer..."
        emptyMessage="No projects found."
        onRowClick={(row) => router.push(`/gutter/${row.proj_id}`)}
      />

      {/* Status change modal */}
      <Modal show={!!statusModal} onHide={() => setStatusModal(null)} title="Change Status">
        <p>Set status to <strong>{statuses.find((s) => String(s.status_id) === String(statusModal?.statusId))?.name}</strong>?</p>
        <div className="d-flex gap-2 justify-content-end">
          <Button variant="secondary" onClick={() => setStatusModal(null)}>Cancel</Button>
          <Button variant="primary" loading={busy} onClick={handleSetStatus}>Confirm</Button>
        </div>
      </Modal>

      {/* Delete confirmation modal */}
      <Modal show={!!confirmDelete} onHide={() => setConfirmDelete(null)} title="Delete Project">
        <p>Delete this project? This cannot be undone.</p>
        <div className="d-flex gap-2 justify-content-end">
          <Button variant="secondary" onClick={() => setConfirmDelete(null)}>Cancel</Button>
          <Button variant="danger" loading={busy} onClick={handleDelete}>Delete</Button>
        </div>
      </Modal>
    </Container>
  );
}
