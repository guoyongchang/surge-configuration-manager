import { Routes, Route } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import SubscriptionsPage from "./pages/Subscriptions";
import RulesPage from "./pages/Rules";
import ExtraNodesPage from "./pages/ExtraNodes";
import OutputPage from "./pages/Output";

export default function App() {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-bg">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-12 shrink-0 flex items-center justify-between px-4 border-b border-border bg-bg/80 backdrop-blur">
          <div className="text-sm text-text-secondary">
            Surge Configuration Manager
          </div>
          <button className="px-4 py-1.5 bg-accent hover:bg-accent-hover text-white text-sm rounded-md font-medium transition-colors">
            Generate Config
          </button>
        </header>
        <div className="flex-1 overflow-y-auto">
          <Routes>
            <Route path="/" element={<SubscriptionsPage />} />
            <Route path="/rules" element={<RulesPage />} />
            <Route path="/nodes" element={<ExtraNodesPage />} />
            <Route path="/output" element={<OutputPage />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}
