create table public.psb_s_application (
  app_id bigserial not null,
  app_name character varying not null,
  app_desc character varying null,
  is_active boolean null default true,
  display_order integer not null default nextval('psb_s_application_display_order_seq'::regclass),
  module_key text null,
  constraint psb_s_application_pkey primary key (app_id),
  constraint psb_s_application_app_name_key unique (app_name),
  constraint psb_s_application_module_key_key unique (module_key),
  constraint psb_s_application_display_order_positive_ck check ((display_order > 0))
) TABLESPACE pg_default;

create unique INDEX IF not exists psb_s_application_display_order_uq on public.psb_s_application using btree (display_order) TABLESPACE pg_default;


---

## Prompt: Add `Module Key` Support to Application Setup

The `module_key` field already exists in the `psb_s_application` table but is currently not exposed in the UI. This field is a core part of the platform architecture because it uniquely identifies each application/module (e.g. `gutter-app`, `project-map`, `psbuniverse`) and is used throughout the system for routing, permissions, configuration, feature flags, and future module registration.

Implement full support for this field across the Application Setup module.

### Database

Use the existing column:

* `module_key`

No schema changes are required.

---

## Data Layer

Update all queries, DTOs, interfaces, models, validation, and API/service methods so `module_key` is included in:

* Get Applications
* Create Application
* Update Application
* Batch Save
* Any caching or state management
* Mapping functions

Ensure `module_key` is persisted correctly.

---

## Application List

Add a new column.

Suggested placement:

| Application Name | Module Key | Description | Active |
| ---------------- | ---------- | ----------- | ------ |

The Module Key column should:

* be sortable
* participate in search/filter
* support batch editing if the page already supports batch editing
* follow the existing table styling

Example values:

```
psbuniverse
gutter-app
ohd-app
metal-app
project-map
```

---

## Add Application Dialog

Add a new input directly below **Application Name**.

```
Application Name
[____________________]

Module Key
[____________________]

Description
[____________________]
```

Use a standard text input.

Placeholder:

```
Enter module key
```

Helper text (optional):

```
Unique identifier used internally by the platform.
```

---

## Edit Application Dialog

Include the same field.

Users must be able to update the module key if necessary.

Populate it with the existing value.

---

## Validation

Validate before saving.

Requirements:

* Required
* Trim whitespace
* Convert to lowercase automatically
* Reject leading/trailing spaces
* No duplicate module keys

Allowed characters:

* lowercase letters
* numbers
* hyphen (-)

Examples:

Valid

```
project-map
gutter-app
psbuniverse
inventory-v2
```

Invalid

```
Project Map
Project_Map
ProjectMap
project map
```

Display clear validation messages.

---

## Auto Formatting

As the user types:

```
Project Map
```

becomes

```
project-map
```

Another example:

```
Metal Buildings
```

becomes

```
metal-buildings
```

Normalize automatically by:

* converting to lowercase
* replacing spaces with hyphens
* removing unsupported characters

The user should still be able to edit the generated value before saving.

---

## Search

Update the search bar so it searches:

* Application Name
* Module Key
* Description

---

## UI/UX

Keep the dialog balanced.

Suggested order:

```
Application Name

Module Key

Description
```

Do not make the dialog wider.

Maintain the existing spacing and styling.

---

## Future-Proofing

Treat `module_key` as the application's immutable technical identifier. Although editing is currently allowed, implement the data flow cleanly so future features can safely reference it, including:

* Dynamic routing
* Navigation generation
* RBAC
* Feature flags
* Module registry
* Configuration loading
* API endpoint resolution
* Module discovery

Do not hardcode any module keys anywhere in the implementation.

The UI, services, and data layer should always read the value from the database.
