"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button, Modal, TableZ, toastError, toastSuccess } from "@/shared/components/ui";
import { createSetupRow, updateSetupRow, deleteSetupRow } from "../../data/gutter.actions";
import SetupWorkspaceLayout from "./SetupWorkspaceLayout";
import SetupSidebar from "./SetupSidebar";
import SetupToolbar from "./SetupToolbar";
import SetupFormModal from "./SetupFormModal";

// ─── Table Definitions (unchanged from original) ─────────────────────────────

const TABLE_DEFS = [
  {
    key: "statuses",
    label: "Statuses",
    pk: "status_id",
    columns: [
      { key: "name", label: "Name", sortable: true },
    ],
    fields: [
      { key: "name", label: "Status Name", required: true },
    ],
  },
  {
    key: "colors",
    label: "Colors",
    pk: "color_id",
    columns: [
      { key: "name", label: "Color Name", sortable: true },
    ],
    fields: [
      { key: "name", label: "Color Name", required: true },
    ],
  },
  {
    key: "manufacturers",
    label: "Manufacturers",
    pk: "manufacturer_id",
    columns: [
      { key: "name", label: "Name", sortable: true },
      { key: "rate", label: "Rate ($/lf)", sortable: true, render: (row) => `$${Number(row.rate || 0).toFixed(2)}` },
    ],
    fields: [
      { key: "name", label: "Manufacturer Name", required: true },
      { key: "rate", label: "Rate (per linear foot)", type: "number", step: "0.01", required: true },
    ],
  },
  {
    key: "leafGuards",
    label: "Leaf Guards",
    pk: "leaf_guard_id",
    columns: [
      { key: "name", label: "Name", sortable: true },
      { key: "price", label: "Price", sortable: true, render: (row) => `$${Number(row.price || 0).toFixed(2)}` },
    ],
    fields: [
      { key: "name", label: "Leaf Guard Name", required: true },
      { key: "price", label: "Price", type: "number", step: "0.01", required: true },
    ],
  },
  {
    key: "tripRates",
    label: "Trip Rates",
    pk: "trip_id",
    columns: [
      { key: "label", label: "Label", sortable: true },
      { key: "rate", label: "Rate ($)", sortable: true, render: (row) => `$${Number(row.rate || 0).toFixed(2)}` },
    ],
    fields: [
      { key: "label", label: "Label (e.g. St 1.5 - 1.99 Hrs)", required: true },
      { key: "rate", label: "Rate ($)", type: "number", step: "0.01", required: true },
    ],
  },
  {
    key: "discounts",
    label: "Discounts",
    pk: "discount_id",
    columns: [
      { key: "description", label: "Description", sortable: true },
      {
        key: "percentage", label: "Percentage", sortable: true, render: (row) => {
          const v = Number(row.percentage || 0);
          return v <= 1 ? `${(v * 100).toFixed(2)}%` : `${v.toFixed(2)}%`;
        }
      },
    ],
    fields: [
      { key: "description", label: "Description", required: true },
      { key: "percentage", label: "Percentage (decimal, e.g. 0.10 = 10%)", type: "number", step: "0.0001", required: true },
    ],
  },
];

// ─── Main Setup View ─────────────────────────────────────────────────────────

export default function GutterSetupView({ setup = {} }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("statuses");
  const [modalMode, setModalMode] = useState(null); // "add" | "edit" | null
  const [modalRow, setModalRow] = useState(null);
  const [draft, setDraft] = useState({});
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [searchValue, setSearchValue] = useState("");

  const tableDef = useMemo(() => TABLE_DEFS.find((t) => t.key === activeTab), [activeTab]);

  const rows = useMemo(() => {
    const data = setup[activeTab];
    return Array.isArray(data) ? data : [];
  }, [setup, activeTab]);

  // Filter rows by toolbar search
  const filteredRows = useMemo(() => {
    if (!searchValue.trim()) return rows;
    const q = searchValue.toLowerCase();
    return rows.filter((row) =>
      tableDef?.columns.some((col) => {
        const val = row[col.key];
        return val != null && String(val).toLowerCase().includes(q);
      })
    );
  }, [rows, searchValue, tableDef]);

  // Sidebar table list with counts
  const sidebarTables = useMemo(
    () => TABLE_DEFS.map((t) => ({
      key: t.key,
      label: t.label,
      count: Array.isArray(setup[t.key]) ? setup[t.key].length : 0,
    })),
    [setup]
  );

  // Reset search when switching tabs
  const handleTabChange = useCallback((key) => {
    setActiveTab(key);
    setSearchValue("");
  }, []);

  // ─── Modal Handlers (preserved from original) ──────────────

  const openAdd = useCallback(() => {
    setDraft({});
    setModalRow(null);
    setModalMode("add");
  }, []);

  const openEdit = useCallback((row) => {
    const initial = {};
    tableDef.fields.forEach((f) => { initial[f.key] = row[f.key] ?? ""; });
    setDraft(initial);
    setModalRow(row);
    setModalMode("edit");
  }, [tableDef]);

  const closeModal = useCallback(() => {
    setModalMode(null);
    setModalRow(null);
    setDraft({});
  }, []);

  const handleDraftChange = (field, value) => {
    setDraft((d) => ({ ...d, [field]: value }));
  };

  const handleSave = useCallback(async () => {
    if (!tableDef) return;

    // Validate required fields
    for (const f of tableDef.fields) {
      if (f.required && !String(draft[f.key] ?? "").trim()) {
        toastError(`${f.label} is required.`, "Validation");
        return;
      }
    }

    setBusy(true);
    try {
      const payload = {};
      tableDef.fields.forEach((f) => {
        const val = draft[f.key];
        if (f.type === "number") {
          payload[f.key] = val === "" || val == null ? null : Number(val);
        } else {
          payload[f.key] = String(val ?? "").trim();
        }
      });

      if (modalMode === "add") {
        await createSetupRow(activeTab, payload);
        toastSuccess("Row added.", tableDef.label);
      } else {
        const rowId = modalRow[tableDef.pk];
        await updateSetupRow(activeTab, rowId, payload);
        toastSuccess("Row updated.", tableDef.label);
      }

      closeModal();
      router.refresh();
    } catch (err) {
      toastError(err?.message || "Error saving.", tableDef.label);
    } finally {
      setBusy(false);
    }
  }, [tableDef, draft, modalMode, modalRow, activeTab, closeModal, router]);

  const handleDelete = useCallback(async () => {
    if (!confirmDelete || !tableDef) return;
    setBusy(true);
    try {
      const rowId = confirmDelete[tableDef.pk];
      await deleteSetupRow(activeTab, rowId);
      toastSuccess("Row deleted.", tableDef.label);
      setConfirmDelete(null);
      router.refresh();
    } catch (err) {
      toastError(err?.message || "Error deleting.", tableDef.label);
    } finally {
      setBusy(false);
    }
  }, [confirmDelete, tableDef, activeTab, router]);

  // ─── Render ────────────────────────────────────────────────

  const actions = useMemo(() => [
    {
      key: "edit",
      label: "Edit",
      icon: "pen",
      type: "primary",
      onClick: (row) => openEdit(row),
    },
    {
      key: "delete",
      label: "Delete",
      icon: "trash",
      type: "danger",
      onClick: (row) => setConfirmDelete(row),
    },
  ], [openEdit]);

  const singularName = tableDef?.label?.replace(/s$/, "") || "Item";

  return (
    <div className="setup-workspace-root">
      <SetupWorkspaceLayout
        sidebar={
          <SetupSidebar
            tables={sidebarTables}
            activeKey={activeTab}
            onSelect={handleTabChange}
          />
        }
        toolbar={
          <SetupToolbar
            tableName={tableDef?.label || ""}
            recordCount={rows.length}
            searchValue={searchValue}
            onSearchChange={(v) => { setSearchValue(v); }}
            onAdd={openAdd}
            addLabel={`Add ${singularName}`}
          />
        }
      >
        {tableDef && (
          <div className="setup-grid-wrap">
            <TableZ
              data={filteredRows}
              columns={tableDef.columns}
              rowIdKey={tableDef.pk}
              actions={actions}
              hideSearch
              emptyMessage={`No ${tableDef.label.toLowerCase()} found.`}
            />
          </div>
        )}
      </SetupWorkspaceLayout>

      {/* Add / Edit Modal */}
      <SetupFormModal
        show={!!modalMode}
        mode={modalMode}
        tableName={singularName}
        fields={tableDef?.fields}
        draft={draft}
        busy={busy}
        onDraftChange={handleDraftChange}
        onSave={handleSave}
        onClose={closeModal}
      />

      {/* Delete Confirmation */}
      <Modal show={!!confirmDelete} onHide={() => setConfirmDelete(null)} title="Confirm Delete">
        <p className="setup-delete-msg">Delete this row? This cannot be undone.</p>
        <div className="setup-delete-actions">
          <Button variant="secondary" onClick={() => setConfirmDelete(null)}>Cancel</Button>
          <Button variant="danger" loading={busy} onClick={handleDelete}>Delete</Button>
        </div>
      </Modal>
    </div>
  );
}
