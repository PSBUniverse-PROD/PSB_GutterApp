"use client";

import { Form } from "react-bootstrap";
import { Button, Modal } from "@/shared/components/ui";

/**
 * SetupFormModal — Lightweight modal for add/edit operations.
 * Preserves existing form behavior with compact enterprise styling.
 */
export default function SetupFormModal({ show, mode, tableName, fields, draft, busy, onDraftChange, onSave, onClose }) {
  if (!show) return null;

  const title = mode === "add" ? `Add ${tableName}` : `Edit ${tableName}`;

  return (
    <Modal show={show} onHide={onClose} title={title}>
      <div className="setup-form-modal">
        {fields?.map((f) => (
          <Form.Group key={f.key} className="setup-form-modal__field">
            <Form.Label className="setup-form-modal__label">
              {f.label}{f.required ? <span className="setup-form-modal__required">*</span> : ""}
            </Form.Label>
            <Form.Control
              type={f.type || "text"}
              step={f.step || undefined}
              size="sm"
              value={draft[f.key] ?? ""}
              onChange={(e) => onDraftChange(f.key, e.target.value)}
              placeholder={f.label}
              className="setup-form-modal__input"
            />
          </Form.Group>
        ))}
        <div className="setup-form-modal__actions">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={busy} onClick={onSave}>
            {mode === "add" ? "Add" : "Save"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
