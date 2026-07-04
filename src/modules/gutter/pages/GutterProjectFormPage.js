import { loadGutterSetup, loadGutterProject, loadProjectSnapshots } from "../data/gutter.server";
import GutterProjectFormView from "./GutterProjectFormView";

export const dynamic = "force-dynamic";

export default async function GutterProjectFormPage({ params, searchParams }) {
  const resolvedParams = await params;
  const projectId = resolvedParams?.id || null;
  const isEdit = !!projectId;

  const setup = await loadGutterSetup();

  let projectData = null;
  let snapshotCount = 0;
  if (isEdit) {
    projectData = await loadGutterProject(projectId);
    try {
      const snapshots = await loadProjectSnapshots(projectId);
      snapshotCount = snapshots?.length || 0;
    } catch {
      // Non-blocking: form can still load without snapshot count
    }
  }

  return (
    <GutterProjectFormView
      mode={isEdit ? "edit" : "create"}
      projectId={projectId}
      setup={setup}
      projectData={projectData}
      snapshotCount={snapshotCount}
    />
  );
}
