import { useEffect, useState } from "react";
import { AdminPage } from "./pages/AdminPage";
import { ReportPage } from "./pages/ReportPage";
import { SurveyPage } from "./pages/SurveyPage";
import { parseHashRoute } from "./routing";

function App() {
  const [route, setRoute] = useState(() => parseHashRoute(window.location.hash));

  useEffect(() => {
    const update = () => setRoute(parseHashRoute(window.location.hash));
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);

  return <div className="app-shell">
    <header className="topbar"><img className="dymon-logo" src="/dymon-asia-logo.png" alt="Dymon Asia Capital" /></header>
    <div className="page-rule" aria-hidden="true" />
    {route.kind === "admin" && <AdminPage />}
    {route.kind === "survey" && <SurveyPage access={route.access} />}
    {route.kind === "report" && <ReportPage access={route.access} />}
    {route.kind === "not_found" && <main><h1>Page not found</h1><p>Check the link and try again.</p></main>}
  </div>;
}

export default App;
