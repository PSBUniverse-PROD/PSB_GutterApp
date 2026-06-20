import { loadGutterProjects } from "../data/gutter.server";
import GutterView from "./GutterView";

export const dynamic = "force-dynamic";

export default async function GutterPage() {
  const { projects, statuses } = await loadGutterProjects();
  return <GutterView projects={projects} statuses={statuses} />;
}
