Your requirement is valid. Right now the **Work Order** card is mixing project information with installation information.

### Recommended Changes

#### 1. Add Work Order Number to Project
Currently:

FieldPurposePO#Customer Purchase OrderDateProject DateThe installer's actual **Work Order Number** is a different business identifier and should not reuse PO#.

Add a new column:

```
ALTER TABLE GTR_T_Project
ADD WorkOrderNo VARCHAR(50) NULL;
```
Example:

FieldExampleProject ID4PO#PO-12345Work Order #WO-2026-001Date2026-04-10
---

#### 2. Make Work Order Number Editable
Current UI:

```
Work Order
Walter Frenzel

PO#
4

DATE
2026-04-10
```
Should become:

```
Work Order

Customer Name: Walter Frenzel

Work Order #
[ WO-2026-001 ]

PO #
[ PO-12345 ]

Date
[ 2026-04-10 ]
```
Since installers may receive the WO after project creation, all three should be editable.

---

#### 3. Rename "Installer" Section
Current:

```
INSTALLER
```
Rename to:

```
DETAILS
```
Because the section already contains:

- Installer Name
- Installation Date
- Signature
- Signature Date

and will likely contain additional project execution details in the future.

---

#### 4. UI/UX Improvement
The top card should clearly separate:

### Project Information

```
Project Name
Customer
Address
```

### Work Order Information

```
Work Order #
PO #
Date
```
This avoids confusion between:

- Project ID
- Work Order Number
- Purchase Order Number

which are currently being visually treated as the same thing.

---

### Developer Task
**Database**

- Add `WorkOrderNo` to project table.

**Backend**

- Include `WorkOrderNo` in:Get Project API
- Save Project API
- Work Order API

**UI**

- Add editable `Work Order #` field.
- Keep `PO#` editable.
- Keep `Date` editable.
- Rename **Installer** panel → **Details**.
- Update Print/PDF template to display:Work Order #
- PO #
- Date

This is the correct data model because **PO# is a customer purchasing reference**, while **Work Order # is the operational installation reference**. They should never be treated as the same identifier.

Yes. If **PO#** and **Date** are becoming editable fields specific to the Work Order, then they should not be derived from existing project metadata.

Right now it appears:

```
Project
 ├─ PO#
 ├─ Date
 └─ Address
```
But once users can edit them from the Work Order screen, you're effectively storing **Work Order data**, not Project data.

### Recommended Schema
If these values are intended to be editable per project:

```
ALTER TABLE GTR_T_Project
ADD WorkOrderNo VARCHAR(50) NULL,
    PONumber VARCHAR(100) NULL,
    WorkOrderDate DATE NULL;
```

### Why?
A project can have:

FieldPurposeProjectIDInternal system identifierWorkOrderNoInstallation/operations referencePONumberCustomer purchase order referenceWorkOrderDateDate shown on the work orderExample:

```
ProjectID: 4

WorkOrderNo: WO-2026-001
PONumber: PO-45678
WorkOrderDate: 2026-04-10
```
Then the UI becomes:

```
WORK ORDER

Work Order #
[ WO-2026-001 ]

PO #
[ PO-45678 ]

Date
[ 2026-04-10 ]
```

### Alternative (Better Long-Term)
If you expect:

- Multiple work orders per project
- Revisions
- Re-installations
- Service calls

Then create a separate table:

```
GTR_T_WorkOrder

WorkOrderID
ProjectID
WorkOrderNo
PONumber
WorkOrderDate
InstallerName
InstallationDate
Signature
SignatureDate
Notes
```
Because the screen you're showing is actually a **Work Order record**, not a Project record.

For the current scope, adding the 3 columns directly to `GTR_T_Project` is acceptable and keeps things simple. If this system grows later, move them into a dedicated `GTR_T_WorkOrder` table.