import { NavLink, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  CloudDownload,
  ListFilter,
  Server,
  FileOutput,
  Settings,
} from "lucide-react";

const navItems = [
  { to: "/", icon: CloudDownload, labelKey: "nav.subscriptions" },
  { to: "/rules", icon: ListFilter, labelKey: "nav.rules" },
  { to: "/nodes", icon: Server, labelKey: "nav.extraNodes" },
  { to: "/output", icon: FileOutput, labelKey: "nav.output" },
] as const;

export default function Sidebar() {
  const location = useLocation();
  const { t, i18n } = useTranslation("common");

  const toggleLanguage = () => {
    i18n.changeLanguage(i18n.language === "zh" ? "en" : "zh");
  };

  return (
    <aside className="flex flex-col w-60 h-full bg-sidebar border-r border-sidebar-border shrink-0">
      <div className="px-4 pt-5 pb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm">
            S
          </div>
          <div>
            <div className="text-sm font-semibold text-sidebar-foreground">
              Surge Manager
            </div>
            <div className="text-xs text-muted-foreground">v0.1.0</div>
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
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:text-sidebar-foreground hover:bg-muted/50"
              }`}
            >
              <item.icon size={18} />
              <span>{t(item.labelKey)}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="px-3 pb-4">
        <div className="flex items-center gap-1">
          <NavLink
            to="/settings"
            className="flex flex-1 items-center gap-3 px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-sidebar-foreground hover:bg-muted/50 transition-colors"
          >
            <Settings size={18} />
            <span>{t("nav.settings")}</span>
          </NavLink>
          <button
            onClick={toggleLanguage}
            className="px-2 py-1.5 rounded-md text-xs font-semibold text-muted-foreground hover:text-sidebar-foreground hover:bg-muted/50 transition-colors shrink-0"
            title={(i18n.resolvedLanguage ?? i18n.language) === "zh" ? "Switch to English" : "切换为中文"}
          >
            {(i18n.resolvedLanguage ?? i18n.language) === "zh" ? "EN" : "中"}
          </button>
        </div>
      </div>
    </aside>
  );
}
