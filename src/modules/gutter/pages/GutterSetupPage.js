import { loadGutterSetup } from "../data/gutter.server";
import GutterSetupView from "./setup/GutterSetupView";
import "./setup/setup-workspace.css";

export const dynamic = "force-dynamic";

export default async function GutterSetupPage() {
  const setup = await loadGutterSetup();
  return <GutterSetupView setup={setup} />;
}
