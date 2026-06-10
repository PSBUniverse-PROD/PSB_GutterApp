import { loadGutterProject, loadGutterSetup, loadPurchaseOrder, loadGutterWorkOrder } from "../data/gutter.actions";
import GutterPrintView from "./GutterPrintView";

export const dynamic = "force-dynamic";

export default async function GutterPrintPage({ params }) {
  const resolvedParams = await params;
  const projectId = resolvedParams?.id || null;

  const [projectData, setup, purchaseOrder, workOrderData] = await Promise.all([
    loadGutterProject(projectId),
    loadGutterSetup(),
    loadPurchaseOrder(projectId),
    loadGutterWorkOrder(projectId),
  ]);

  return (
    <GutterPrintView
      projectId={projectId}
      projectData={projectData}
      setup={setup}
      storedPurchaseOrder={purchaseOrder}
      workOrderData={workOrderData}
    />
  );
}
