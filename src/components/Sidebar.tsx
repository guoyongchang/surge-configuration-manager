import { NavLink, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  CloudDownload,
  ListFilter,
  Server,
  FileOutput,
  Network,
  Shield,
  Globe,
  BookMarked,
  Cloud,
  Sun,
  Moon,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const navItems = [
  { to: "/", icon: CloudDownload, labelKey: "nav.subscriptions" },
  { to: "/rules", icon: ListFilter, labelKey: "nav.rules" },
  { to: "/nodes", icon: Server, labelKey: "nav.extraNodes" },
  { to: "/http-listen", icon: Network, labelKey: "nav.httpListen" },
  { to: "/mitm", icon: Shield, labelKey: "nav.mitm" },
  { to: "/hosts", icon: Globe, labelKey: "nav.hosts" },
  { to: "/url-rewrites", icon: BookMarked, labelKey: "nav.urlRewrites" },
  { to: "/cloud-sync", icon: Cloud, labelKey: "nav.cloudSync" },
  { to: "/output", icon: FileOutput, labelKey: "nav.output" },
] as const;

interface Props {
  theme: "dark" | "light";
  onThemeToggle: () => void;
}

export default function Sidebar({ theme, onThemeToggle }: Props) {
  const location = useLocation();
  const { t, i18n } = useTranslation();

  const toggleLanguage = () => {
    i18n.changeLanguage(i18n.language === "zh" ? "en" : "zh");
  };

  return (
    <aside className="flex flex-col w-56 h-full bg-sidebar border-r border-sidebar-border shrink-0">
      {/* Logo + Generate Config */}
      <div className="px-3 pt-5 pb-3">
        <div className="flex items-center gap-2 mb-3">
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
        <Button size="sm" className="w-full">
          {t("actions.generateConfig")}
        </Button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 space-y-0.5">
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

      {/* Bottom controls — spaced to opposite ends */}
      <div className="px-3 pb-4 flex items-center justify-between">
        <button
          onClick={toggleLanguage}
          className="px-2 py-1.5 rounded-md text-xs font-semibold text-muted-foreground hover:text-sidebar-foreground hover:bg-muted/50 transition-colors"
          title={(i18n.resolvedLanguage ?? i18n.language) === "zh" ? "Switch to English" : "切换为中文"}
        >
          {(i18n.resolvedLanguage ?? i18n.language) === "zh" ? "EN" : "中"}
        </button>
        <button
          onClick={onThemeToggle}
          className="p-1.5 rounded-md text-muted-foreground hover:text-sidebar-foreground hover:bg-muted/50 transition-colors"
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
          {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
        </button>
      </div>
    </aside>
  );
}
