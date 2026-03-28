import { useState } from "react";
import {
  FolderOpen,
  Zap,
  CheckCircle,
  XCircle,
  Clock,
  ChevronDown,
} from "lucide-react";

interface BuildRecord {
  id: string;
  filename: string;
  description: string;
  time: string;
  status: "success" | "error" | "pending";
}

const mockBuilds: BuildRecord[] = [
  {
    id: "1",
    filename: "main_v1.4.0.conf",
    description: "Based on 1,847 Merged rules",
    time: "10:51",
    status: "success",
  },
  {
    id: "2",
    filename: "backup_3oct.conf",
    description: "Based on 1,847 Merged rules",
    time: "17:16",
    status: "success",
  },
  {
    id: "3",
    filename: "trial_config.conf",
    description: "Build 3: Http_only at line 43",
    time: "N/A",
    status: "error",
  },
  {
    id: "4",
    filename: "legacy_v3.conf",
    description: "Restored v3 Configuration",
    time: "Yesterday",
    status: "success",
  },
];

function StatusIcon({ status }: { status: BuildRecord["status"] }) {
  if (status === "success")
    return <CheckCircle size={16} className="text-success" />;
  if (status === "error") return <XCircle size={16} className="text-danger" />;
  return <Clock size={16} className="text-warning" />;
}

export default function OutputPage() {
  const [template] = useState("Modern_Minimalist_v9.conf");
  const [outputPath] = useState(
    "~/Library/Application Support/Surge/Profiles/"
  );
  const [autoRegenerate, setAutoRegenerate] = useState(true);
  const [minifyOutput, setMinifyOutput] = useState(false);
  const [autoUpload, setAutoUpload] = useState(true);

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-text-primary">
          Build Configuration
        </h1>
        <p className="text-xs text-text-secondary mt-1">
          Define your template logic and file destinations for the final Surge
          profile.
        </p>
      </div>

      <div className="flex gap-6">
        {/* Left column: Settings */}
        <div className="flex-1 space-y-5">
          {/* Template */}
          <div>
            <label className="text-xs text-text-secondary mb-1.5 block">
              Template
            </label>
            <button className="w-full flex items-center justify-between bg-surface border border-border rounded-md px-3 py-2 text-sm text-text-primary hover:border-accent/30 transition-colors">
              <span>{template}</span>
              <ChevronDown size={14} className="text-text-secondary" />
            </button>
            <div className="text-xs text-text-secondary mt-1">
              Using the latest official template and variables.
            </div>
          </div>

          {/* Output Path */}
          <div>
            <label className="text-xs text-text-secondary mb-1.5 block">
              Output Path
            </label>
            <div className="flex gap-2">
              <div className="flex-1 bg-surface border border-border rounded-md px-3 py-2 text-sm text-text-primary font-mono truncate">
                {outputPath}
              </div>
              <button className="px-3 bg-surface border border-border rounded-md text-text-secondary hover:text-text-primary transition-colors">
                <FolderOpen size={16} />
              </button>
            </div>
          </div>

          {/* Toggles */}
          <div className="space-y-4">
            <ToggleRow
              label="Regenerate on refresh"
              description="Automatically rebuild on local file change"
              checked={autoRegenerate}
              onChange={setAutoRegenerate}
            />
            <ToggleRow
              label="Minify Output"
              description="Remove comments and whitespace"
              checked={minifyOutput}
              onChange={setMinifyOutput}
            />
            <ToggleRow
              label="Auto-upload to Remote"
              description="Push generated file to Git or iCloud"
              checked={autoUpload}
              onChange={setAutoUpload}
            />
          </div>
        </div>

        {/* Right column: Generate + History */}
        <div className="w-80 space-y-4">
          {/* Generate button */}
          <button className="w-full py-8 bg-accent hover:bg-accent-hover rounded-lg flex flex-col items-center gap-2 transition-colors">
            <Zap size={28} className="text-white" />
            <span className="text-white font-semibold text-lg">
              Generate Config
            </span>
          </button>

          {/* Status */}
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-text-secondary">Status:</span>
              <span className="text-success font-medium">● Ready</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-text-secondary">Last Build:</span>
              <span className="text-text-primary">2m 45s ago</span>
            </div>
          </div>

          {/* Build History */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-text-primary">
                Build History
              </h3>
              <button className="text-xs text-accent hover:text-accent-hover transition-colors">
                Clear All
              </button>
            </div>
            <div className="space-y-2">
              {mockBuilds.map((build) => (
                <div
                  key={build.id}
                  className="flex items-center gap-3 bg-surface border border-border rounded-md px-3 py-2.5"
                >
                  <StatusIcon status={build.status} />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-text-primary truncate">
                      {build.filename}
                    </div>
                    <div className="text-xs text-text-secondary truncate">
                      {build.description}
                    </div>
                  </div>
                  <span className="text-xs text-text-secondary shrink-0">
                    {build.time}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <div className="text-sm text-text-primary">{label}</div>
        <div className="text-xs text-text-secondary">{description}</div>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`w-10 h-6 rounded-full relative transition-colors ${
          checked ? "bg-accent" : "bg-white/10"
        }`}
      >
        <span
          className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
            checked ? "left-5" : "left-1"
          }`}
        />
      </button>
    </div>
  );
}
