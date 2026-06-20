import { loadGutterSetup, loadGutterProject } from "../data/gutter.server";
import GutterProjectFormView from "./GutterProjectFormView";

export const dynamic = "force-dynamic";

export default async function GutterProjectFormPage({ params, searchParams }) {
  const resolvedParams = await params;
  const projectId = resolvedParams?.id || null;
  const isEdit = !!projectId;

  const setup = await loadGutterSetup();

  let projectData = null;
  if (isEdit) {
    projectData = await loadGutterProject(projectId);
  }

  return (
    <GutterProjectFormView
      mode={isEdit ? "edit" : "create"}
      projectId={projectId}
      setup={setup}
      projectData={projectData}
    />
  );
}
