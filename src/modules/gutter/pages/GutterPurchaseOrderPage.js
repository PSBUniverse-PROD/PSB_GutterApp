import { loadGutterProject, loadPurchaseOrder } from "../data/gutter.server";
import GutterPurchaseOrderView from "./GutterPurchaseOrderView";

export const dynamic = "force-dynamic";

export default async function GutterPurchaseOrderPage({ params }) {
  const resolvedParams = await params;
  const projectId = resolvedParams?.id || null;

  const projectData = await loadGutterProject(projectId);
  const purchaseOrder = await loadPurchaseOrder(projectId);

  return (
    <GutterPurchaseOrderView
      projectId={projectId}
      projectData={projectData}
      storedPurchaseOrder={purchaseOrder}
    />
  );
}
