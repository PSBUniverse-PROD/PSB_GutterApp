import { loadGutterSetup, loadGutterProject, loadPurchaseOrder } from "../data/gutter.server";
import GutterPurchaseOrderView from "./GutterPurchaseOrderView";

export const dynamic = "force-dynamic";

export default async function GutterPurchaseOrderPage({ params }) {
  const resolvedParams = await params;
  const projectId = resolvedParams?.id || null;

  const [projectData, purchaseOrder, setup] = await Promise.all([
    loadGutterProject(projectId),
    loadPurchaseOrder(projectId),
    loadGutterSetup(),
  ]);

  return (
    <GutterPurchaseOrderView
      projectId={projectId}
      projectData={projectData}
      storedPurchaseOrder={purchaseOrder}
      setup={setup}
    />
  );
}
