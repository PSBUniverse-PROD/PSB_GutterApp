import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import { formatCurrency } from "../data/gutter.data";

/* --- Helpers ---------------------------------------------------------------- */
const toDisplay = (v) => (v === null || v === undefined || v === "") ? "—" : String(v);
const fmtCurrency = (v) => formatCurrency(v);
const fmtNum = (v) => (v === null || v === undefined) ? "—" : String(Number(v).toFixed(2));
const fmtInt = (v) => (v === null || v === undefined) ? "—" : String(Math.round(Number(v)));

/* --- Shared Styles ---------------------------------------------------------- */
const s = StyleSheet.create({
  page: { padding: 40, fontSize: 9, fontFamily: "Helvetica", color: "#1a1a1a" },
  // Header
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12 },
  companyName: { fontSize: 16, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  companyDetail: { fontSize: 8, color: "#555" },
  headerRight: { alignItems: "flex-end" },
  headerMeta: { flexDirection: "row", gap: 4, marginBottom: 2 },
  headerMetaLabel: { fontSize: 8, color: "#555" },
  headerMetaValue: { fontSize: 9, fontFamily: "Helvetica-Bold" },
  divider: { borderBottomWidth: 1, borderBottomColor: "#ccc", marginVertical: 10 },
  // Sections
  section: { marginBottom: 14 },
  sectionTitle: { fontSize: 11, fontFamily: "Helvetica-Bold", marginBottom: 6, color: "#333" },
  subTitle: { fontSize: 9, fontFamily: "Helvetica-Bold", marginTop: 8, marginBottom: 4 },
  // Detail grid
  detailsGrid: { flexDirection: "row", gap: 30 },
  detailsCol: { flex: 1 },
  detailItem: { flexDirection: "row", marginBottom: 3 },
  detailLabel: { width: 80, fontSize: 8, color: "#555" },
  detailValue: { fontSize: 9 },
  // Tables
  tableRow: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#ddd", paddingVertical: 3 },
  tableHeader: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#333", paddingVertical: 4, marginBottom: 1 },
  thText: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#333" },
  tdText: { fontSize: 9 },
  textRight: { textAlign: "right" },
  // Pricing
  subtotalRow: { flexDirection: "row", borderTopWidth: 1, borderTopColor: "#333", paddingVertical: 4, marginTop: 4 },
  totalRow: { flexDirection: "row", borderTopWidth: 2, borderTopColor: "#333", paddingVertical: 5, marginTop: 2 },
  totalText: { fontSize: 11, fontFamily: "Helvetica-Bold" },
  discountText: { color: "#c0392b" },
  // Sketch box
  sketchBox: { height: 160, borderWidth: 1, borderColor: "#999", marginTop: 6, position: "relative" },
  sketchLabel: { position: "absolute", fontSize: 8, color: "#666" },
  // Notes box
  notesBox: { height: 80, borderWidth: 1, borderColor: "#ccc", borderStyle: "dashed", marginTop: 6 },
  // Internal section
  internalSection: { backgroundColor: "#f9f9f9", padding: 8, borderWidth: 1, borderColor: "#eee" },
  note: { fontSize: 9, marginTop: 4 },
});

/* --- Reusable sub-components ------------------------------------------------ */
function DocHeader({ leftTitle, leftSubtitle, leftSub2, rightMeta }) {
  return (
    <>
      <View style={s.header}>
        <View>
          <Text style={s.companyName}>{leftTitle}</Text>
          {leftSubtitle ? <Text style={s.companyDetail}>{leftSubtitle}</Text> : null}
          {leftSub2 ? <Text style={s.companyDetail}>{leftSub2}</Text> : null}
        </View>
        <View style={s.headerRight}>
          {rightMeta.map((m, i) => (
            <View key={i} style={s.headerMeta}>
              <Text style={s.headerMetaLabel}>{m.label}</Text>
              <Text style={s.headerMetaValue}>{m.value}</Text>
            </View>
          ))}
        </View>
      </View>
      <View style={s.divider} />
    </>
  );
}

function TableRow({ cells, widths, header = false, style }) {
  const rowStyle = header ? s.tableHeader : s.tableRow;
  const textStyle = header ? s.thText : s.tdText;
  return (
    <View style={[rowStyle, style]}>
      {cells.map((cell, i) => (
        <Text key={i} style={[textStyle, { width: widths[i] }, cell?.align === "right" && s.textRight]}>
          {typeof cell === "object" && cell?.text !== undefined ? cell.text : cell}
        </Text>
      ))}
    </View>
  );
}

/* ==========================================================================
   QUOTE PDF DOCUMENT
   ========================================================================== */
export function QuotePdf({ header, quoteResult, companyProfile, displayDate, selectedManufacturerName, selectedLeafGuardName, sectionBreakdownRows, extras }) {
  const pricing = quoteResult?.pricing;
  if (!pricing) return (<Document><Page size="LETTER" style={s.page}><Text>No pricing data.</Text></Page></Document>);

  const hasDiscount = Number(pricing.discountAmount || 0) > 0;
  const hasDeposit = Number(pricing.depositPercentDisplay || 0) > 0;
  const endCapsPerSide = (() => {
    const groups = pricing?.derivedEndCaps?.groups;
    if (Array.isArray(groups) && groups.length > 0) {
      return groups.reduce((sum, g) => sum + (Number.isFinite(Number(g?.value)) ? Number(g.value) : 0), 0);
    }
    return (sectionBreakdownRows || []).reduce((sum, row) => sum + (Number.isFinite(Number(row?.sides)) ? Number(row.sides) : 0), 0);
  })();

  const priceW = ["75%", "25%"];

  return (
    <Document>
      <Page size="LETTER" style={s.page}>
        <DocHeader
          leftTitle={companyProfile.name || "Company"}
          leftSubtitle={companyProfile.email}
          leftSub2={companyProfile.phone}
          rightMeta={[
            { label: "Date", value: displayDate },
            { label: "Project #", value: String(header.proj_id) },
          ]}
        />

        {/* Project Details */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Project Details</Text>
          <View style={s.detailsGrid}>
            <View style={s.detailsCol}>
              <View style={s.detailItem}><Text style={s.detailLabel}>Customer</Text><Text style={s.detailValue}>{toDisplay(header.customer)}</Text></View>
              <View style={s.detailItem}><Text style={s.detailLabel}>Project Name</Text><Text style={s.detailValue}>{toDisplay(header.project_name)}</Text></View>
            </View>
            <View style={s.detailsCol}>
              <View style={s.detailItem}><Text style={s.detailLabel}>Address</Text><Text style={s.detailValue}>{toDisplay(header.project_address)}</Text></View>
              <View style={s.detailItem}><Text style={s.detailLabel}>Manufacturer</Text><Text style={s.detailValue}>{selectedManufacturerName}</Text></View>
            </View>
          </View>
        </View>

        {/* Material Breakdown */}
        {sectionBreakdownRows.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Material Breakdown</Text>

            <Text style={s.subTitle}>Gutter k Style 6 Inch</Text>
            <TableRow header cells={["Section", "Sides", "Color", "Length", "Height", "Gutter FT"]} widths={["12%", "10%", "22%", "18%", "18%", "20%"]} />
            {sectionBreakdownRows.map((row) => (
              <TableRow key={row.section} cells={[
                String(row.section), fmtInt(row.sides), row.gutterColor,
                row.ft != null ? `${fmtInt(row.ft)} FT` : "—",
                row.heightFt != null ? `${fmtInt(row.heightFt)} FT` : "—",
                `${fmtNum(row.gutterFt)} FT`,
              ]} widths={["12%", "10%", "22%", "18%", "18%", "20%"]} />
            ))}

            <Text style={s.subTitle}>3x4 Downspouts</Text>
            <TableRow header cells={["Section", "Color", "Qty", "Downspout FT"]} widths={["20%", "30%", "20%", "30%"]} />
            {sectionBreakdownRows.map((row) => (
              <TableRow key={row.section} cells={[
                String(row.section), row.downspoutColor, fmtInt(row.dsQty), `${fmtNum(row.downspoutFt)} FT`,
              ]} widths={["20%", "30%", "20%", "30%"]} />
            ))}

            <Text style={s.subTitle}>End Caps Totals</Text>
            <TableRow header cells={["Right", "Left"]} widths={["50%", "50%"]} />
            <TableRow cells={[
              fmtInt(endCapsPerSide),
              fmtInt(endCapsPerSide),
            ]} widths={["50%", "50%"]} />

            {selectedLeafGuardName && <Text style={s.note}>Leaf Guard: {selectedLeafGuardName}</Text>}

            {extras.length > 0 && (
              <>
                <Text style={s.subTitle}>Extras</Text>
                <TableRow header cells={["#", "Description", "Qty", { text: "Unit Price", align: "right" }]} widths={["8%", "52%", "15%", "25%"]} />
                {extras.map((ex, i) => (
                  <TableRow key={i} cells={[
                    String(i + 1), toDisplay(ex.name), fmtInt(ex.quantity),
                    { text: fmtCurrency(ex.unit_price || 0), align: "right" },
                  ]} widths={["8%", "52%", "15%", "25%"]} />
                ))}
              </>
            )}
          </View>
        )}

        {/* Pricing Summary */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Pricing Summary</Text>
          <TableRow header cells={["Item", { text: "Amount", align: "right" }]} widths={priceW} />
          <TableRow cells={["Gutter k Style 6 Inch", { text: fmtCurrency(pricing.materialCost), align: "right" }]} widths={priceW} />
          <TableRow cells={[`  Total Gutter: ${fmtNum(pricing.totalGutter)} FT`, ""]} widths={priceW} style={{ borderBottomColor: "#eee" }} />
          <TableRow cells={["3x4 Downspouts", { text: fmtCurrency(pricing.downspoutCost), align: "right" }]} widths={priceW} />
          <TableRow cells={[`  Total Downspout: ${fmtNum(pricing.totalDownspouts)} FT`, ""]} widths={priceW} style={{ borderBottomColor: "#eee" }} />
          {Number(pricing.leafGuardCost || 0) > 0 && (
            <TableRow cells={["Leaf Guard", { text: fmtCurrency(pricing.leafGuardCost), align: "right" }]} widths={priceW} />
          )}
          {Number(pricing.tripFeePrice || 0) > 0 && (
            <TableRow cells={["Trip Fee", { text: fmtCurrency(pricing.tripFeePrice), align: "right" }]} widths={priceW} />
          )}
          {Number(pricing.extrasPrice || 0) > 0 && (
            <TableRow cells={["Extras", { text: fmtCurrency(pricing.extrasPrice), align: "right" }]} widths={priceW} />
          )}
          {/* Subtotal */}
          <View style={s.subtotalRow}>
            <Text style={[s.tdText, { width: priceW[0], fontFamily: "Helvetica-Bold" }]}>Subtotal</Text>
            <Text style={[s.tdText, { width: priceW[1], textAlign: "right", fontFamily: "Helvetica-Bold" }]}>{fmtCurrency(pricing.subtotal)}</Text>
          </View>
          {hasDiscount && (
            <View style={s.tableRow}>
              <Text style={[s.tdText, s.discountText, { width: priceW[0] }]}>Discount ({(pricing.discountPercent * 100).toFixed(1)}%)</Text>
              <Text style={[s.tdText, s.discountText, s.textRight, { width: priceW[1] }]}>-{fmtCurrency(pricing.discountAmount)}</Text>
            </View>
          )}
          {/* Total */}
          <View style={s.totalRow}>
            <Text style={[s.totalText, { width: priceW[0] }]}>Project Total</Text>
            <Text style={[s.totalText, s.textRight, { width: priceW[1] }]}>{fmtCurrency(pricing.projectTotal)}</Text>
          </View>
          {hasDeposit && (
            <>
              <TableRow cells={[`Deposit (${pricing.depositPercentDisplay}%)`, { text: fmtCurrency(pricing.depositAmount), align: "right" }]} widths={priceW} />
              <View style={s.subtotalRow}>
                <Text style={[s.tdText, { width: priceW[0], fontFamily: "Helvetica-Bold" }]}>Remaining Balance</Text>
                <Text style={[s.tdText, { width: priceW[1], textAlign: "right", fontFamily: "Helvetica-Bold" }]}>{fmtCurrency(pricing.remainingBalance)}</Text>
              </View>
            </>
          )}
        </View>
      </Page>
    </Document>
  );
}

/* ==========================================================================
   WORK ORDER PDF DOCUMENT
   ========================================================================== */
export function WorkOrderPdf({ header, sides, materials, companyProfile, zipScrewsBags, workOrderData }) {
  const matW = ["45%", "20%", "35%"];
  const measW = ["10%", "22%", "22%", "22%", "24%"];
  const wo = workOrderData || {};

  const materialRows = [
    ['Gutter Coil 15"', `${fmtInt(materials?.gutterCoil?.totalFt)} FT / ${fmtInt(Math.trunc(materials?.gutterCoil?.totalLbs || 0))} lbs`, materials?.gutterCoil?.color || "—"],
    ['Right End Caps - 6" K-Style', fmtInt(materials?.endCaps?.right?.qty), materials?.endCaps?.right?.color || "—"],
    ['Left End Caps - 6" K-Style', fmtInt(materials?.endCaps?.left?.qty), materials?.endCaps?.left?.color || "—"],
    ['3" x 4" Downpipe 10\'ft', fmtInt(materials?.downpipe?.qty), materials?.downpipe?.color || "—"],
    ['3" x 4" - 6" One Piece Offset', fmtInt(materials?.onePieceOffset?.qty), materials?.onePieceOffset?.color || "—"],
    ['3" x 4" -(A) Elbow', fmtInt(materials?.elbow?.qty), materials?.elbow?.color || "—"],
    ['6" Hidden Hangers', fmtInt(materials?.internal?.hiddenHangers), "Auto"],
    ...(zipScrewsBags && zipScrewsBags.length > 0
      ? zipScrewsBags.map((bag, i) => [`Zip Screws Bag ${i + 1}`, String(bag.qty || 0), bag.color || "—"])
      : [['#8 x 1/2" Zip Screws', fmtInt(materials?.zipScrews?.qty), materials?.zipScrews?.color || "—"]]
    ),
  ];

  return (
    <Document>
      <Page size="LETTER" style={s.page}>
        {/* Row 1: Header */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
          <View>
            <Text style={s.companyName}>{companyProfile.name || "Company"}</Text>
            <Text style={s.companyDetail}>{companyProfile.email}</Text>
            <Text style={s.companyDetail}>{companyProfile.phone}</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={[s.detailItem, { marginBottom: 1 }]}>
              <Text style={s.detailLabel}>PO# </Text>
              <Text style={[s.detailValue, { fontFamily: "Helvetica-Bold" }]}>{workOrderData?.workOrderNo ? String(workOrderData.workOrderNo) : "—"}</Text>
            </Text>
            <Text style={s.detailItem}>
              <Text style={s.detailLabel}>Date </Text>
              <Text style={[s.detailValue, { fontFamily: "Helvetica-Bold" }]}>{toDisplay(workOrderData?.workOrderDate)}</Text>
            </Text>
          </View>
        </View>
        <View style={s.divider} />

        {/* Row 2: Work Order (left) + Installer (right) */}
        <View style={{ flexDirection: "row", gap: 24, marginBottom: 6 }}>
          <View style={{ flex: 1 }}>
            <Text style={[s.sectionTitle, { marginBottom: 3, fontSize: 10 }]}>Work Order</Text>
            <View style={s.detailItem}><Text style={s.detailLabel}>Customer</Text><Text style={s.detailValue}>{toDisplay(header.customer)}</Text></View>
            <View style={s.detailItem}><Text style={s.detailLabel}>Project</Text><Text style={s.detailValue}>{toDisplay(header.project_name)}</Text></View>
            <View style={s.detailItem}><Text style={s.detailLabel}>Address</Text><Text style={s.detailValue}>{toDisplay(header.project_address)}</Text></View>
            <View style={s.detailItem}><Text style={s.detailLabel}>K-Style Color</Text><Text style={s.detailValue}>{materials?.colors?.kStyleGutterColor || "—"}</Text></View>
            <View style={s.detailItem}><Text style={s.detailLabel}>Downspout Color</Text><Text style={s.detailValue}>{materials?.colors?.downspoutColor || "—"}</Text></View>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.sectionTitle, { marginBottom: 3, fontSize: 10 }]}>Installer</Text>
            <View style={s.detailItem}>
              <Text style={s.detailLabel}>Name</Text>
              <View style={{ flex: 1, borderBottomWidth: 1, borderBottomColor: "#999", height: 11 }} />
            </View>
            <View style={s.detailItem}>
              <Text style={s.detailLabel}>Install Date</Text>
              <View style={{ flex: 1, borderBottomWidth: 1, borderBottomColor: "#999", height: 11 }} />
            </View>
            <View style={s.detailItem}>
              <Text style={s.detailLabel}>Signature</Text>
              <View style={{ flex: 1, borderBottomWidth: 1, borderBottomColor: "#999", height: 11 }} />
            </View>
            <View style={s.detailItem}>
              <Text style={s.detailLabel}>Signature Date</Text>
              <View style={{ flex: 1, borderBottomWidth: 1, borderBottomColor: "#999", height: 11 }} />
            </View>
          </View>
        </View>
        <View style={s.divider} />

        {/* Row 3: Measurements (left) + Material Summary (right) */}
        <View style={{ flexDirection: "row", gap: 16, marginBottom: 6 }}>
          <View style={{ flex: 1 }}>
            <Text style={[s.sectionTitle, { marginBottom: 3, fontSize: 10 }]}>Measurements</Text>
            <TableRow header cells={["#", "Length (FT)", "Height (FT)", "Segments", "Downspouts"]} widths={measW} />
            {sides.map((side, i) => (
              <TableRow key={i} cells={[
                String(i + 1), toDisplay(side.length), toDisplay(side.height),
                toDisplay(side.segments), toDisplay(side.downspout_qty),
              ]} widths={measW} />
            ))}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.sectionTitle, { marginBottom: 3, fontSize: 10 }]}>Material Summary</Text>
            <TableRow header cells={["Item", "QTY", "Color"]} widths={matW} />
            {materialRows.map(([item, qty, color]) => (
              <TableRow key={item} cells={[item, qty, color]} widths={matW} />
            ))}
          </View>
        </View>
        <View style={s.divider} />

        {/* Row 4: Details Section — Sketch (70%) + DSP + Notes (30%) */}
        <View style={{ flex: 1, flexDirection: "row", gap: 16 }}>
          {/* Left: Sketch / Diagram (70%) */}
          <View style={{ flex: 7 }}>
            <Text style={[s.sectionTitle, { marginBottom: 3, fontSize: 10 }]}>Sketch / Diagram</Text>
            <View style={{ width: "100%", height: "100%", position: "relative" }}>
              <View style={{ position: "absolute", left: "8%", top: "8%", width: "75%", height: "82%", borderWidth: 1.5, borderColor: "#333" }}>
                <View style={{ position: "absolute", left: "33%", top: -11, width: "34%", height: 11, borderWidth: 1, borderColor: "#333", backgroundColor: "#fff" }}>
                  <Text style={{ fontSize: 6, textAlign: "center" }}>Front</Text>
                </View>
                <View style={{ position: "absolute", left: "33%", bottom: -11, width: "34%", height: 11, borderWidth: 1, borderColor: "#333", backgroundColor: "#fff" }}>
                  <Text style={{ fontSize: 6, textAlign: "center" }}>Back</Text>
                </View>
                <View style={{ position: "absolute", left: -1, top: "33%", width: "38%", height: "34%", borderWidth: 1, borderColor: "#333", backgroundColor: "#f5f5f5", justifyContent: "center", alignItems: "center" }}>
                  <Text style={{ fontSize: 7 }}>Left</Text>
                </View>
                <View style={{ position: "absolute", right: -1, top: "33%", width: "38%", height: "34%", borderWidth: 1, borderColor: "#333", backgroundColor: "#f5f5f5", justifyContent: "center", alignItems: "center" }}>
                  <Text style={{ fontSize: 7 }}>Right</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Right: DSP Assignments + Extra Notes (30%) */}
          <View style={{ flex: 3, flexDirection: "column" }}>
            <Text style={[s.sectionTitle, { marginBottom: 3, fontSize: 10 }]}>DSP Assignments</Text>
            <View style={{ borderWidth: 1, borderColor: "#999", marginBottom: 6 }}>
              <View style={{ flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#999", backgroundColor: "#f0f0f0", paddingVertical: 2 }}>
                <Text style={[s.thText, { width: "30%", paddingLeft: 4 }]}>DSP #</Text>
                <Text style={[s.thText, { width: "70%", paddingLeft: 4 }]}>Assigned Value</Text>
              </View>
              {(wo.downspoutAssignments || Array.from({ length: 8 }, () => "")).map((val, i) => (
                <View key={i} style={{ flexDirection: "row", borderBottomWidth: i < 7 ? 0.5 : 0, borderBottomColor: "#ddd", paddingVertical: 2 }}>
                  <Text style={[s.tdText, { width: "30%", paddingLeft: 4 }]}>DSP#{i + 1}</Text>
                  <Text style={[s.tdText, { width: "70%", paddingLeft: 4 }]}>{val || "—"}</Text>
                </View>
              ))}
            </View>

            <Text style={[s.sectionTitle, { marginBottom: 3, fontSize: 10 }]}>Extra Notes</Text>
            <View style={{ flex: 1, borderWidth: 1, borderColor: "#ccc", minHeight: 50, padding: 4 }}>
              {wo.notes ? <Text style={s.note}>{wo.notes}</Text> : null}
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
}

/* ==========================================================================
   PURCHASE ORDER PDF DOCUMENT
   ========================================================================== */
export function PurchaseOrderPdf({ header, materials, storedPurchaseOrder }) {
  const po = storedPurchaseOrder || {};
  const getValue = (poField, matPath) => {
    if (po[poField] !== undefined && po[poField] !== null) return po[poField];
    return matPath;
  };

  const matW = ["50%", "20%", "30%"];
  const intW = ["70%", "30%"];

  return (
    <Document>
      <Page size="LETTER" style={s.page}>
        <DocHeader
          leftTitle="Purchase Order"
          leftSubtitle={toDisplay(header.project_name)}
          rightMeta={[
            { label: "PO#", value: String(header.proj_id) },
            { label: "Date", value: toDisplay(header.date) },
          ]}
        />

        {/* Project Info */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Project Information</Text>
          {[
            ["Customer", toDisplay(header.customer)],
            ["Address", toDisplay(header.project_address)],
            ["K-Style Color", getValue("k_style_gutter_color", materials?.colors?.kStyleGutterColor) || "—"],
            ["Downspout Color", getValue("downspout_color", materials?.colors?.downspoutColor) || "—"],
          ].map(([label, value]) => (
            <View key={label} style={s.detailItem}>
              <Text style={s.detailLabel}>{label}</Text>
              <Text style={s.detailValue}>{value}</Text>
            </View>
          ))}
        </View>

        {/* Material Order */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Material Order</Text>
          <TableRow header cells={["Item", { text: "QTY", align: "right" }, "Unit"]} widths={matW} />
          {[
            ['Gutter Coil 15"', fmtNum(getValue("gutter_coil_total_ft", materials?.gutterCoil?.totalFt)), `FT (${fmtNum(getValue("gutter_coil_total_lbs", materials?.gutterCoil?.totalLbs))} lbs)`],
            ['Right End Caps - 6" K-Style', fmtInt(getValue("right_end_caps_qty", materials?.endCaps?.right?.qty)), "EA"],
            ['Left End Caps - 6" K-Style', fmtInt(getValue("left_end_caps_qty", materials?.endCaps?.left?.qty)), "EA"],
            ['3" x 4" Downpipe 10\'ft', fmtInt(getValue("downpipe_qty", materials?.downpipe?.qty)), "EA"],
            ['3" x 4" - 6" One Piece Offset', fmtInt(getValue("one_piece_offset_qty", materials?.onePieceOffset?.qty)), "EA"],
            ['3" x 4" -(A) Elbow', fmtInt(getValue("elbow_a_qty", materials?.elbow?.qty)), "EA"],
            ["Spray Paint", fmtInt(getValue("spray_paint_qty", materials?.sprayPaint?.qty)), "CAN"],
            ['#8 x 1/2" Zip Screws', fmtInt(getValue("zip_screws_qty", materials?.zipScrews?.qty)), "EA"],
            ['6" Hidden Hangers', fmtInt(getValue("hidden_hangers_qty", materials?.internal?.hiddenHangers)), "EA"],
            ['#10 x 1-1/2" Box Screws', fmtInt(getValue("box_screws_qty", materials?.internal?.boxScrews)), "EA"],
          ].map(([item, qty, unit]) => (
            <TableRow key={item} cells={[item, { text: qty, align: "right" }, unit]} widths={matW} />
          ))}
        </View>

        {/* Internal Reference */}
        <View style={[s.section, s.internalSection]}>
          <Text style={s.sectionTitle}>Internal Reference (Do Not Print for Customer)</Text>
          <TableRow header cells={["Item", { text: "QTY", align: "right" }]} widths={intW} />
          {[
            ["Total Downspouts", fmtInt(getValue("total_downspouts", materials?.internal?.totalDownspouts))],
            ["Total End Caps", fmtInt(getValue("total_endcaps", materials?.internal?.totalEndcaps))],
            ["Rectangular Outlets", fmtInt(getValue("rectangular_outlets", materials?.internal?.rectangularOutlets))],
            ["Internal Screws (6 per offset/elbow)", fmtInt(getValue("internal_screws", materials?.internal?.internalScrews))],
          ].map(([item, qty]) => (
            <TableRow key={item} cells={[item, { text: qty, align: "right" }]} widths={intW} />
          ))}
        </View>
      </Page>
    </Document>
  );
}
