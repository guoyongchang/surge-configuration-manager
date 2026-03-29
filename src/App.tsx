import { useEffect, useState } from "react";
import { Routes, Route } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import SubscriptionsPage from "./pages/Subscriptions";
import RulesPage from "./pages/Rules";
import ExtraNodesPage from "./pages/ExtraNodes";
import OutputPage from "./pages/Output";
import SettingsPage from "./pages/Settings";
import HttpListenPage from "./pages/HttpListenPage";
import MitmPage from "./pages/MitmPage";
import HostPage from "./pages/HostPage";
import UrlRewritePage from "./pages/UrlRewritePage";
import CloudSyncPage from "./pages/CloudSyncPage";
import { Button } from "@/components/ui/button";
import { checkForUpdate, installUpdate, type UpdateInfo } from "@/lib/api";
import { RefreshCw, X, Sun, Moon } from "lucide-react";

export default function App() {
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  const [installing, setInstalling] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    return (localStorage.getItem("scm_theme") as "dark" | "light") ?? "light";
  });

  useEffect(() => {
    const html = document.documentElement;
    if (theme === "light") {
      html.classList.add("light");
    } else {
      html.classList.remove("light");
    }
    localStorage.setItem("scm_theme", theme);
  }, [theme]);

  useEffect(() => {
    checkForUpdate()
      .then((info) => { if (info) setUpdate(info); })
      .catch(() => {}); // silently ignore on startup
  }, []);

  const handleInstall = async () => {
    setInstalling(true);
    try {
      await installUpdate(); // downloads, installs, then app.exit(0) — may not return
    } catch {
      setInstalling(false); // only reached if install failed
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-12 shrink-0 flex items-center justify-between px-4 border-b border-border bg-background/80 backdrop-blur">
          <div className="text-sm text-muted-foreground">
            Surge Configuration Manager
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            </Button>
            <Button size="sm">Generate Config</Button>
          </div>
        </header>

        {update && (
          <div
            className="shrink-0 flex items-center justify-between gap-4 px-4 py-2 text-sm border-b"
            style={{
              background: "color-mix(in srgb, var(--color-info) 10%, transparent)",
              borderColor: "color-mix(in srgb, var(--color-info) 25%, transparent)",
            }}
          >
            <span style={{ color: "var(--color-info)" }}>
              New version <strong>v{update.version}</strong> is available
              <span className="text-muted-foreground ml-2">(current: v{update.current_version})</span>
            </span>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                style={{ borderColor: "color-mix(in srgb, var(--color-info) 40%, transparent)", color: "var(--color-info)" }}
                onClick={handleInstall}
                disabled={installing}
              >
                <RefreshCw className={`w-3 h-3 mr-1 ${installing ? "animate-spin" : ""}`} />
                {installing ? "Installing..." : "Install & Restart"}
              </Button>
              <button
                onClick={() => setUpdate(null)}
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Dismiss"
                disabled={installing}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          <Routes>
            <Route path="/" element={<SubscriptionsPage />} />
            <Route path="/rules" element={<RulesPage />} />
            <Route path="/nodes" element={<ExtraNodesPage />} />
            <Route path="/output" element={<OutputPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/http-listen" element={<HttpListenPage />} />
            <Route path="/mitm" element={<MitmPage />} />
            <Route path="/hosts" element={<HostPage />} />
            <Route path="/url-rewrites" element={<UrlRewritePage />} />
            <Route path="/cloud-sync" element={<CloudSyncPage />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}
