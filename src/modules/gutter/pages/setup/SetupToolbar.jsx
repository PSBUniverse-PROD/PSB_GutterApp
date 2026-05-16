"use client";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faMagnifyingGlass } from "@fortawesome/free-solid-svg-icons";
import { Button } from "@/shared/components/ui";

/**
 * SetupToolbar — Compact header bar with table name, record count, search, and add button.
 */
export default function SetupToolbar({ tableName, recordCount, searchValue, onSearchChange, onAdd, addLabel }) {
  return (
    <div className="setup-toolbar">
      <div className="setup-toolbar__left">
        <h1 className="setup-toolbar__title">{tableName}</h1>
        <span className="setup-toolbar__count">{recordCount} record{recordCount !== 1 ? "s" : ""}</span>
      </div>
      <div className="setup-toolbar__right">
        <div className="setup-toolbar__search">
          <FontAwesomeIcon icon={faMagnifyingGlass} className="setup-toolbar__search-icon" />
          <input
            type="text"
            className="setup-toolbar__search-input"
            placeholder={`Filter ${tableName.toLowerCase()}...`}
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
        <Button variant="success" onClick={onAdd} className="setup-toolbar__add-btn">
          <FontAwesomeIcon icon={faPlus} />
          <span>{addLabel}</span>
        </Button>
      </div>
    </div>
  );
}
