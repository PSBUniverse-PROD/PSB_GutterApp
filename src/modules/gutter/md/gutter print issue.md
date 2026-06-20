1. i found an issue on print buttons of pages gutter project page, work order page, and purchase order page... project page and order page's print button acts the same but work order print instantly without going to the print view page...

2. work order page doesnt fetch the data correctly if print button is clicked on the other pages... becuase it doesnt save the data on the database...

this is the table for the work order page...
create table public.gtr_t_workorder_dsp (
  workorder_dsp_id bigint generated always as identity not null,
  workorder_id bigint not null,
  dsp_no integer not null,
  assigned_value text null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint gtr_t_workorder_dsp_pkey primary key (workorder_dsp_id),
  constraint uk_workorder_dsp_no unique (workorder_id, dsp_no),
  constraint fk_workorder_dsp_workorder foreign KEY (workorder_id) references gtr_t_workorders (workorder_id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_gtr_t_workorder_dsp_workorder_id on public.gtr_t_workorder_dsp using btree (workorder_id) TABLESPACE pg_default;

create table public.gtr_t_workorder_zip_screws (
  workorder_zip_screw_id bigint generated always as identity not null,
  workorder_id bigint not null,
  color text null,
  qty integer null default 1,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint gtr_t_workorder_zip_screws_pkey primary key (workorder_zip_screw_id),
  constraint fk_workorder_zip_screw_workorder foreign KEY (workorder_id) references gtr_t_workorders (workorder_id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_gtr_t_workorder_zip_screws_workorder_id on public.gtr_t_workorder_zip_screws using btree (workorder_id) TABLESPACE pg_default;


create table public.gtr_t_workorders (
  workorder_id bigint generated always as identity not null,
  proj_id bigint not null,
  work_order_no text null,
  po_number text null,
  work_order_date date null,
  installer_name text null,
  installation_date date null,
  signature_name text null,
  signature_date date null,
  notes text null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  created_by bigint null,
  updated_by bigint null,
  constraint gtr_t_workorders_pkey primary key (workorder_id),
  constraint gtr_t_workorders_proj_id_key unique (proj_id),
  constraint fk_workorder_project foreign KEY (proj_id) references gtr_t_projects (proj_id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_gtr_t_workorders_proj_id on public.gtr_t_workorders using btree (proj_id) TABLESPACE pg_default;

3. scan through the work order page and save what fields are needed to be saved like the colors and values of the items and etc... create an psql query to add those columns to the existing dbtable of the work order...

4. double check on the save button of the project page to save ALL related data for that project on all the PO and WO database tables...