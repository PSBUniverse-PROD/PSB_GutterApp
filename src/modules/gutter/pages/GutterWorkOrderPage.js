import { loadGutterProject, loadGutterWorkOrder } from "../data/gutter.actions";
import { getSupabaseAdmin } from "@/core/supabase/admin";
import GutterWorkOrderView from "./GutterWorkOrderView";

export const dynamic = "force-dynamic";

export default async function GutterWorkOrderPage({ params }) {
  const resolvedParams = await params;
  const projectId = resolvedParams?.id || null;

  const projectData = await loadGutterProject(projectId);
  const workOrderData = await loadGutterWorkOrder(projectId);

  // Resolve manufacturer name from header
  let manufacturerName = null;
  const mfrId = projectData?.projectHeader?.manufacturer_id;
  if (mfrId) {
    const supabase = getSupabaseAdmin();
    const { data } = await supabase.from("gtr_s_manufacturers").select("name").eq("manufacturer_id", mfrId).maybeSingle();
    manufacturerName = data?.name || null;
  }

  return (
    <GutterWorkOrderView
      projectId={projectId}
      projectData={projectData}
      manufacturerName={manufacturerName}
      workOrderData={workOrderData}
    />
  );
}
