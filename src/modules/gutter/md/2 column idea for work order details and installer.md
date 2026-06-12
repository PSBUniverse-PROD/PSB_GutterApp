

<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: var(--font-sans); color: var(--color-text-primary); background: transparent; }
.doc { padding: 16px 0; }
.doc-header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 12px; border-bottom: 1.5px solid var(--color-text-primary); margin-bottom: 16px; }
.doc-title { font-size: 20px; font-weight: 500; }
.doc-meta { text-align: right; font-size: 12px; color: var(--color-text-secondary); line-height: 1.6; }
.doc-meta span { font-weight: 500; color: var(--color-text-primary); }
.columns { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; }
.col-title { font-size: 13px; font-weight: 500; margin-bottom: 10px; }
.field-row { display: grid; grid-template-columns: 110px 1fr; align-items: baseline; margin-bottom: 5px; gap: 8px; }
.field-label { font-size: 11px; color: var(--color-text-secondary); }
.field-value { font-size: 12px; font-weight: 500; color: var(--color-text-primary); }
.sig-row { display: grid; grid-template-columns: 100px 1fr; align-items: flex-end; margin-bottom: 8px; gap: 8px; }
.sig-label { font-size: 11px; color: var(--color-text-secondary); }
.sig-line { border-bottom: 1px solid var(--color-text-primary); height: 18px; }
</style>

<div class="doc">
  <div class="doc-header">
    <div class="doc-title">Sennox-Premium</div>
    <div class="doc-meta">PO# <span>4</span><br>Date <span>2026-06-04</span></div>
  </div>

  <div class="columns">
    <div>
      <div class="col-title">Work Order</div>
      <div class="field-row">
        <span class="field-label">Customer</span>
        <span class="field-value">WolfSteel Buildings, Inc.</span>
      </div>
      <div class="field-row">
        <span class="field-label">Project</span>
        <span class="field-value">Rick Civaterese - Gutters</span>
      </div>
      <div class="field-row">
        <span class="field-label">Address</span>
        <span class="field-value">19450 Ponderosa Dr. Eustace 75124</span>
      </div>
      <div class="field-row">
        <span class="field-label">K-Style Color</span>
        <span class="field-value">Blue</span>
      </div>
      <div class="field-row">
        <span class="field-label">Downspout Color</span>
        <span class="field-value">Blue</span>
      </div>
    </div>

    <div>
      <div class="col-title">Installer</div>
      <div class="sig-row">
        <span class="sig-label">Name</span>
        <div class="sig-line"></div>
      </div>
      <div class="sig-row">
        <span class="sig-label">Install Date</span>
        <div class="sig-line"></div>
      </div>
      <div class="sig-row">
        <span class="sig-label">Signature</span>
        <div class="sig-line"></div>
      </div>
      <div class="sig-row">
        <span class="sig-label">Signature Date</span>
        <div class="sig-line"></div>
      </div>
    </div>
  </div>
</div>
