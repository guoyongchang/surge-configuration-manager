import { NavLink, useLocation } from "react-router-dom";
import {
  CloudDownload,
  ListFilter,
  Server,
  FileOutput,
  Settings,
} from "lucide-react";

const navItems = [
  { to: "/", icon: CloudDownload, label: "Subscriptions" },
  { to: "/rules", icon: ListFilter, label: "Rules" },
  { to: "/nodes", icon: Server, label: "Extra Nodes" },
  { to: "/output", icon: FileOutput, label: "Output" },
];

export default function Sidebar() {
  const location = useLocation();

  return (
    <aside className="flex flex-col w-60 h-full bg-sidebar border-r border-border shrink-0">
      <div className="px-4 pt-5 pb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center text-white font-bold text-sm">
            S
          </div>
          <div>
            <div className="text-sm font-semibold text-text-primary">
              Surge Manager
            </div>
            <div className="text-xs text-text-secondary">v0.1.0</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 space-y-1">
        {navItems.map((item) => {
          const isActive =
            item.to === "/"
              ? location.pathname === "/"
              : location.pathname.startsWith(item.to);
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                isActive
                  ? "bg-accent/15 text-accent"
                  : "text-text-secondary hover:text-text-primary hover:bg-white/5"
              }`}
            >
              <item.icon size={18} />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="px-3 pb-4">
        <NavLink
          to="/settings"
          className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-text-secondary hover:text-text-primary hover:bg-white/5 transition-colors"
        >
          <Settings size={18} />
          <span>Settings</span>
        </NavLink>
      </div>
    </aside>
  );
}
