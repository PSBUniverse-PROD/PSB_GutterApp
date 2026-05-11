/**
 * Server Component — GutterPage.js
 *
 * Runs on the server. Loads data, then passes it to the View.
 *
 * WHAT TO DO:
 *   1. Import your load function from "../data/gutter.actions"
 *   2. Call it with `await`
 *   3. Pass the result as props to GutterView
 *
 * RULES:
 *   - No useState, useEffect, or onClick here — those go in the View.
 *   - Do NOT wrap JSX in try/catch (causes a React lint error).
 */
import GutterView from "./GutterView";
// import { loadGutterData } from "../data/gutter.actions";

export const dynamic = "force-dynamic";

export default async function GutterPage() {
  // TODO: Load your data here
  // const { items } = await loadGutterData();

  return <GutterView />;
}
