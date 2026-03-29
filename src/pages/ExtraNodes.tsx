import { useEffect, useState, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Plus, Server, Trash2, Loader2,
  PlayCircle, CheckCircle2, XCircle, AlertCircle, CheckSquare, Square, RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import type { ExtraNode, BatchNodeInput, NodeTestResult } from "@/types";
import * as api from "@/lib/api";
import { ConfirmDialog } from "@/components/ConfirmDialog";

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseNodeLine(line: string): { username: string; password: string; server: string; port: number } | null {
  const match = line.trim().match(/^([^:@]+):([^@]+)@([^:]+):(\d+)$/);
  if (!match) return null;
  const port = parseInt(match[4]);
  if (port < 1 || port > 65535) return null;
  const server = match[3].trim();
  if (!server || server.includes(" ")) return null;
  return { username: match[1].trim(), password: match[2].trim(), server, port };
}

function buildRefreshUrl(template: string, username: string): string {
  const baseUser = username.replace(/-sesstime-\d+$/i, "");
  return template.replace("{user}", baseUser);
}

/** Auto-convert a pasted URL into a template: user=big2024 → user={user} */
function autoTemplate(url: string): string {
  return url.replace(/([?&]user=)([^{&][^&]*)/, "$1{user}");
}

function countryFlag(code: string): string {
  if (!code || code.length !== 2) return "🌐";
  const offset = 127397;
  return [...code.toUpperCase()].map((c) => String.fromCodePoint(c.charCodeAt(0) + offset)).join("");
}

type ParsedLine =
  | { ok: true; input: BatchNodeInput }
  | { ok: false; lineNum: number; raw: string; reason: string };

function parseNodeLines(text: string, refreshTemplate: string): ParsedLine[] {
  const results: ParsedLine[] = [];
  text.split("\n").forEach((rawLine, idx) => {
    const line = rawLine.trim();
    if (!line) return;
    const p = parseNodeLine(line);
    if (!p) {
      const portMatch = line.match(/:(\d+)$/);
      const port = portMatch ? parseInt(portMatch[1]) : null;
      const reason = !line.includes("@")
        ? "Missing @ — expected user:pass@host:port"
        : port !== null && (port < 1 || port > 65535)
        ? `Port ${port} out of range (1–65535)`
        : "Invalid format — expected user:pass@host:port";
      results.push({ ok: false, lineNum: idx + 1, raw: line, reason });
    } else {
      results.push({
        ok: true,
        input: {
          name: p.username,
          nodeType: "socks5",
          server: p.server,
          port: p.port,
          username: p.username,
          password: p.password,
          refreshUrl: refreshTemplate.trim()
            ? buildRefreshUrl(refreshTemplate.trim(), p.username)
            : undefined,
        },
      });
    }
  });
  return results;
}


// ── Unified Add Node Dialog ───────────────────────────────────────────────────

type ProtoId = "socks5" | "socks5-tls" | "http" | "https" | "ss" | "vmess" | "trojan" | "hysteria2" | "tuic";

const PROTO_LABELS: Record<ProtoId, string> = {
  socks5: "SOCKS5", "socks5-tls": "SOCKS5-TLS", http: "HTTP", https: "HTTPS",
  ss: "Shadowsocks", vmess: "VMess", trojan: "Trojan", hysteria2: "Hysteria2", tuic: "TUIC",
};
const PROTO_DEFAULT_PORT: Record<ProtoId, string> = {
  socks5: "1080", "socks5-tls": "1080", http: "8080", https: "443",
  ss: "8388", vmess: "443", trojan: "443", hysteria2: "443", tuic: "443",
};
const SS_METHODS = ["aes-128-gcm", "aes-256-gcm", "chacha20-ietf-poly1305", "aes-128-cfb", "aes-256-cfb"];

function buildRawLine(proto: ProtoId, name: string, server: string, port: string, v: Record<string, string>): string {
  const base = `${name} = ${proto}, ${server}, ${port}`;
  switch (proto) {
    case "socks5": case "socks5-tls": case "http": case "https": {
      const auth = v.username && v.password ? `, ${v.username}, ${v.password}` : "";
      return `${base}${auth}`;
    }
    case "ss":
      return `${base}, encrypt-method=${v.method || "aes-128-gcm"}, password=${v.password || ""}`;
    case "vmess": {
      let line = `${base}, username=${v.uuid || ""}`;
      if (v.ws_path) line += `, ws=true, ws-path=${v.ws_path}`;
      if (v.tls === "true") line += `, tls=true`;
      return line;
    }
    case "trojan": {
      let line = `${base}, password=${v.password || ""}`;
      if (v.skip_verify === "true") line += `, skip-cert-verify=true`;
      return line;
    }
    case "hysteria2": {
      let line = `${base}, password=${v.password || ""}`;
      if (v.skip_verify === "true") line += `, skip-cert-verify=true`;
      return line;
    }
    case "tuic":
      return `${base}, token=${v.token || ""}, uuid=${v.uuid || ""}`;
  }
}

function AddNodeDialog({ onAdded }: { onAdded: () => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [mainTab, setMainTab] = useState<"single" | "batch">("single");

  // ── 逐个添加 state ──
  const [proto, setProto] = useState<ProtoId>("socks5");
  const [name, setName] = useState("");
  const [server, setServer] = useState("");
  const [port, setPort] = useState("1080");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [refreshUrl, setRefreshUrl] = useState("");

  // ── 批量添加 state ──
  const [batchTab, setBatchTab] = useState<"socks5" | "raw">("socks5");
  const [socks5Text, setSocks5Text] = useState("");
  const [refreshTemplate, setRefreshTemplate] = useState("");
  const [rawLines, setRawLines] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const setField = (k: string, v: string) => setFields((prev) => ({ ...prev, [k]: v }));

  const handleProtoChange = (p: ProtoId) => {
    setProto(p); setPort(PROTO_DEFAULT_PORT[p]); setFields({}); setError("");
  };

  const rawLine = name.trim() && server.trim()
    ? buildRawLine(proto, name.trim(), server.trim(), port, fields)
    : "";

  // Parse SOCKS5 lines
  const socks5Parsed = useMemo(() => parseNodeLines(socks5Text, refreshTemplate), [socks5Text, refreshTemplate]);
  const socks5Valid = useMemo(
    () => socks5Parsed.filter((l) => l.ok).map((l) => (l as { ok: true; input: BatchNodeInput }).input),
    [socks5Parsed]
  );
  const socks5Errors = useMemo(
    () => socks5Parsed.filter((l) => !l.ok) as { ok: false; lineNum: number; raw: string; reason: string }[],
    [socks5Parsed]
  );

  // Parse raw lines
  const rawParsed = useMemo(() => {
    return rawLines
      .split("\n")
      .map((l, i) => ({ lineNum: i + 1, line: l.trim() }))
      .filter(({ line }) => line && !line.startsWith("#"));
  }, [rawLines]);

  const handleClose = () => { setOpen(false); setError(""); };

  const handleSubmitSingle = async () => {
    if (!rawLine) return;
    setError(""); setLoading(true);
    try {
      await api.addNodeFromRawLine(rawLine, refreshUrl.trim() || undefined);
      setOpen(false);
      setName(""); setServer(""); setPort("1080"); setFields({}); setRefreshUrl(""); setError("");
      onAdded();
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitBatch = async () => {
    setError(""); setLoading(true);
    try {
      if (batchTab === "socks5") {
        if (socks5Valid.length === 0) return;
        await api.batchAddExtraNodes(socks5Valid);
      } else {
        if (rawParsed.length === 0) return;
        for (const { line } of rawParsed) {
          await api.addNodeFromRawLine(line);
        }
      }
      setOpen(false);
      setSocks5Text(""); setRefreshTemplate(""); setRawLines(""); setError("");
      onAdded();
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const batchCanSubmit = batchTab === "socks5" ? socks5Valid.length > 0 : rawParsed.length > 0;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else setOpen(true); }}>
      <DialogTrigger asChild>
        <Button><Plus size={16} />{t("extraNodes_dialog_trigger")}</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{t("extraNodes_dialog_title")}</DialogTitle></DialogHeader>

        {/* Main tab switcher */}
        <div className="flex gap-1 p-1 bg-muted rounded-lg">
          <button
            type="button"
            className={`flex-1 text-sm py-1.5 rounded-md transition-colors ${
              mainTab === "single" ? "bg-background shadow-sm font-medium" : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => { setMainTab("single"); setError(""); }}
          >
            {t("extraNodes_tabs_single")}
          </button>
          <button
            type="button"
            className={`flex-1 text-sm py-1.5 rounded-md transition-colors ${
              mainTab === "batch" ? "bg-background shadow-sm font-medium" : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => { setMainTab("batch"); setError(""); }}
          >
            {t("extraNodes_tabs_batch")}
          </button>
        </div>

        {mainTab === "single" ? (
          <div className="space-y-3 py-1">
            <div>
              <Label>{t("extraNodes_single_protocol")}</Label>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {(Object.keys(PROTO_LABELS) as ProtoId[]).map((p) => (
                  <button key={p} type="button"
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                      proto === p ? "bg-primary text-primary-foreground border-primary"
                        : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                    onClick={() => handleProtoChange(p)}
                  >
                    {PROTO_LABELS[p]}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label>{t("extraNodes_single_name")}</Label>
              <Input placeholder="e.g. HK-01" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <Label>{t("extraNodes_single_server")}</Label>
                <Input placeholder="1.2.3.4" value={server} onChange={(e) => setServer(e.target.value)} />
              </div>
              <div>
                <Label>{t("extraNodes_single_port")}</Label>
                <Input type="number" value={port} onChange={(e) => setPort(e.target.value)} />
              </div>
            </div>
            {(proto === "socks5" || proto === "socks5-tls" || proto === "http" || proto === "https") && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>{t("extraNodes_single_username")} <span className="text-muted-foreground font-normal text-xs">({t("extraNodes_single_optional")})</span></Label>
                  <Input value={fields.username ?? ""} onChange={(e) => setField("username", e.target.value)} />
                </div>
                <div>
                  <Label>{t("extraNodes_single_password")} <span className="text-muted-foreground font-normal text-xs">({t("extraNodes_single_optional")})</span></Label>
                  <Input value={fields.password ?? ""} onChange={(e) => setField("password", e.target.value)} />
                </div>
              </div>
            )}
            {proto === "ss" && (
              <>
                <div>
                  <Label>{t("extraNodes_single_encryptMethod")}</Label>
                  <select className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={fields.method ?? "aes-128-gcm"} onChange={(e) => setField("method", e.target.value)}>
                    {SS_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <Label>{t("extraNodes_single_password")}</Label>
                  <Input value={fields.password ?? ""} onChange={(e) => setField("password", e.target.value)} />
                </div>
              </>
            )}
            {proto === "vmess" && (
              <>
                <div>
                  <Label>UUID</Label>
                  <Input placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" value={fields.uuid ?? ""} onChange={(e) => setField("uuid", e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>WS Path <span className="text-muted-foreground font-normal text-xs">({t("extraNodes_single_optional")})</span></Label>
                    <Input placeholder="/path" value={fields.ws_path ?? ""} onChange={(e) => setField("ws_path", e.target.value)} />
                  </div>
                  <div>
                    <Label>TLS <span className="text-muted-foreground font-normal text-xs">({t("extraNodes_single_optional")})</span></Label>
                    <select className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      value={fields.tls ?? ""} onChange={(e) => setField("tls", e.target.value)}>
                      <option value="">{t("extraNodes_single_disabled")}</option>
                      <option value="true">true</option>
                    </select>
                  </div>
                </div>
              </>
            )}
            {(proto === "trojan" || proto === "hysteria2") && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>{t("extraNodes_single_password")}</Label>
                  <Input value={fields.password ?? ""} onChange={(e) => setField("password", e.target.value)} />
                </div>
                <div>
                  <Label>{t("extraNodes_single_skipVerify")}</Label>
                  <select className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={fields.skip_verify ?? ""} onChange={(e) => setField("skip_verify", e.target.value)}>
                    <option value="">{t("extraNodes_single_no")}</option>
                    <option value="true">{t("extraNodes_single_yes")}</option>
                  </select>
                </div>
              </div>
            )}
            {proto === "tuic" && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>UUID</Label>
                  <Input value={fields.uuid ?? ""} onChange={(e) => setField("uuid", e.target.value)} />
                </div>
                <div>
                  <Label>Token</Label>
                  <Input value={fields.token ?? ""} onChange={(e) => setField("token", e.target.value)} />
                </div>
              </div>
            )}
            <div>
              <Label>{t("extraNodes_single_refreshUrl")} <span className="text-muted-foreground font-normal text-xs">({t("extraNodes_single_optional")})</span></Label>
              <Input placeholder="https://example.com/refresh" value={refreshUrl} onChange={(e) => setRefreshUrl(e.target.value)} />
            </div>
            {rawLine && (
              <div className="rounded-md bg-muted px-3 py-2 text-xs font-mono text-muted-foreground break-all">{rawLine}</div>
            )}
            {error && <div className="text-xs text-destructive bg-destructive/10 rounded p-2">{error}</div>}
            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>{t("actions.cancel")}</Button>
              <Button onClick={handleSubmitSingle} disabled={loading || !rawLine}>
                {loading && <Loader2 size={14} className="animate-spin" />}{t("extraNodes_batch_addBtn")}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-3 py-1">
            {/* Batch sub-tab switcher */}
            <div className="flex gap-1 p-0.5 bg-muted/50 border border-border rounded-md">
              <button
                type="button"
                className={`flex-1 text-xs py-1 rounded transition-colors ${
                  batchTab === "socks5" ? "bg-background shadow-sm font-medium" : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => { setBatchTab("socks5"); setError(""); }}
              >
                {t("extraNodes_batch_socks5Tab")}
              </button>
              <button
                type="button"
                className={`flex-1 text-xs py-1 rounded transition-colors ${
                  batchTab === "raw" ? "bg-background shadow-sm font-medium" : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => { setBatchTab("raw"); setError(""); }}
              >
                {t("extraNodes_batch_rawTab")}
              </button>
            </div>

            {batchTab === "socks5" ? (
              <>
                <div>
                  <Label>{t("extraNodes_batch_nodeList")}</Label>
                  <p className="text-xs text-muted-foreground mb-1.5">{t("extraNodes_batch_nodeListHint")}</p>
                  <textarea
                    className="w-full h-36 rounded-md border border-input bg-transparent px-3 py-2 text-sm font-mono placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
                    placeholder={"big2024_75019-sesstime-10:N1iiJh@proxy-as.socks5.io:3000\nbig2024_75020-sesstime-10:N1iiJh@proxy-as.socks5.io:3000"}
                    value={socks5Text}
                    onChange={(e) => setSocks5Text(e.target.value)}
                  />
                </div>
                <div>
                  <Label>{t("extraNodes_batch_refreshTemplate")} <span className="text-muted-foreground font-normal">({t("extraNodes_single_optional")})</span></Label>
                  <p className="text-xs text-muted-foreground mb-1.5">{t("extraNodes_batch_refreshTemplateHint", { placeholder: "{user}" })}</p>
                  <Input
                    placeholder="https://example.com/refresh?user={user}"
                    value={refreshTemplate}
                    onChange={(e) => setRefreshTemplate(e.target.value)}
                    onBlur={(e) => setRefreshTemplate(autoTemplate(e.target.value))}
                  />
                </div>
                {socks5Text.trim() && (
                  <div className="flex items-center gap-3 text-xs">
                    {socks5Valid.length > 0 && (
                      <span className="flex items-center gap-1 text-success">
                        <CheckCircle2 size={12} /> {t("extraNodes_batch_valid", { count: socks5Valid.length })}
                      </span>
                    )}
                    {socks5Errors.length > 0 && (
                      <span className="flex items-center gap-1 text-destructive">
                        <XCircle size={12} /> {t("extraNodes_batch_invalid", { count: socks5Errors.length })}
                      </span>
                    )}
                  </div>
                )}
                {socks5Errors.length > 0 && (
                  <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2 space-y-1 max-h-24 overflow-y-auto">
                    {socks5Errors.map((e) => (
                      <div key={e.lineNum} className="text-xs text-destructive font-mono">
                        <span className="opacity-60">Line {e.lineNum}:</span> {e.reason}
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div>
                <Label>{t("extraNodes_batch_surgeLines")}</Label>
                <p className="text-xs text-muted-foreground mb-1.5">{t("extraNodes_batch_surgeLinesHint")}</p>
                <div className="text-xs text-muted-foreground font-mono bg-muted rounded px-3 py-2 mb-2 space-y-0.5">
                  <div>HK-SS = ss, 1.2.3.4, 8388, encrypt-method=aes-128-gcm, password=xxx</div>
                  <div>JP-VMess = vmess, 5.6.7.8, 443, username=UUID, tls=true</div>
                  <div>US-Trojan = trojan, 9.0.1.2, 443, password=xxx</div>
                  <div>SG-Hy2 = hysteria2, 3.4.5.6, 443, password=xxx</div>
                </div>
                <textarea
                  className="w-full h-32 rounded-md border border-input bg-transparent px-3 py-2 text-sm font-mono placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
                  placeholder={t("extraNodes_batch_surgeLinesPlaceholder")}
                  value={rawLines}
                  onChange={(e) => setRawLines(e.target.value)}
                />
                {rawParsed.length > 0 && (
                  <p className="text-xs text-success mt-1 flex items-center gap-1">
                    <CheckCircle2 size={12} /> {t("extraNodes_batch_willAdd", { count: rawParsed.length })}
                  </p>
                )}
              </div>
            )}

            {error && (
              <div className="text-xs text-destructive bg-destructive/10 rounded p-2">{error}</div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>{t("actions.cancel")}</Button>
              <Button onClick={handleSubmitBatch} disabled={loading || !batchCanSubmit}>
                {loading && <Loader2 size={14} className="animate-spin" />}
                {batchTab === "socks5"
                  ? (socks5Valid.length > 0 ? t("extraNodes_batch_importCount", { count: socks5Valid.length }) : t("extraNodes_batch_importBtn"))
                  : (rawParsed.length > 0 ? t("extraNodes_batch_addCount", { count: rawParsed.length }) : t("extraNodes_batch_addBtn"))}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Test Result Badge ─────────────────────────────────────────────────────────

type TestStatus = "idle" | "testing" | NodeTestResult;

function TestBadge({ status }: { status: TestStatus }) {
  const { t } = useTranslation();
  if (status === "idle") return null;
  if (status === "testing") {
    return (
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <Loader2 size={12} className="animate-spin" />{t("extraNodes_test_testing")}
      </div>
    );
  }
  if (status.error) {
    return (
      <div className="flex items-center gap-1 text-xs text-destructive" title={status.error}>
        <XCircle size={12} />{status.error.length > 20 ? t("extraNodes_test_failed") : status.error}
      </div>
    );
  }
  const pure = !status.is_proxy && !status.is_hosting;
  const flag = status.country_code ? countryFlag(status.country_code) : "🌐";
  return (
    <div className="flex flex-col items-end gap-0.5">
      <div className="flex items-center gap-1.5 text-xs">
        <span className="text-success font-mono font-medium">{status.latency_ms}ms</span>
        <span title={status.country ?? ""} className="text-base leading-none">{flag}</span>
        {pure ? (
          <span title="Clean IP" className="flex items-center gap-0.5 text-success">
            <CheckCircle2 size={11} />{t("extraNodes_test_clean")}
          </span>
        ) : (
          <span title="Proxy/hosting IP detected" className="flex items-center gap-0.5 text-warning">
            <AlertCircle size={11} />
            {status.is_hosting ? t("extraNodes_test_hosting") : t("extraNodes_test_proxy")}
          </span>
        )}
      </div>
      {status.ip && (
        <div className="text-xs text-muted-foreground font-mono">{status.ip}</div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const HISTORY_KEY = "scm_node_test_history";

function loadHistory(): Record<string, NodeTestResult> {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function saveHistory(results: Record<string, TestStatus>) {
  const toSave: Record<string, NodeTestResult> = {};
  for (const [id, s] of Object.entries(results)) {
    if (s !== "idle" && s !== "testing") toSave[id] = s;
  }
  localStorage.setItem(HISTORY_KEY, JSON.stringify(toSave));
}

export default function ExtraNodesPage() {
  const { t } = useTranslation();
  const [nodes, setNodes] = useState<ExtraNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [testResults, setTestResults] = useState<Record<string, TestStatus>>(() => loadHistory());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [refreshing, setRefreshing] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<{ title: string; description?: string; onConfirm: () => void } | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api.getExtraNodes();
      setNodes(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleRemove = async (id: string) => {
    await api.removeExtraNode(id);
    setNodes((prev) => prev.filter((n) => n.id !== id));
    setTestResults((prev) => {
      const next = { ...prev };
      delete next[id];
      saveHistory(next);
      return next;
    });
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelected(selected.size === nodes.length ? new Set() : new Set(nodes.map((n) => n.id)));
  };

  const handleBatchDelete = async () => {
    if (selected.size === 0) return;
    setDeleting(true);
    try {
      const ids = [...selected];
      await api.batchRemoveExtraNodes(ids);
      setNodes((prev) => prev.filter((n) => !selected.has(n.id)));
      setTestResults((prev) => {
        const next = { ...prev };
        ids.forEach((id) => delete next[id]);
        saveHistory(next);
        return next;
      });
      setSelected(new Set());
    } finally {
      setDeleting(false);
    }
  };

  const testNode = async (id: string) => {
    setTestResults((prev) => ({ ...prev, [id]: "testing" }));
    try {
      const result = await api.testExtraNode(id);
      setTestResults((prev) => {
        const next = { ...prev, [id]: result };
        saveHistory(next);
        return next;
      });
    } catch {
      const errResult: NodeTestResult = {
        id, latency_ms: null, ip: null, country: null, country_code: null,
        city: null, isp: null, is_proxy: null, is_hosting: null, error: "Error",
      };
      setTestResults((prev) => {
        const next = { ...prev, [id]: errResult };
        saveHistory(next);
        return next;
      });
    }
  };

  const handleTestAll = async () => {
    if (nodes.length === 0) return;
    const testing: Record<string, TestStatus> = {};
    nodes.forEach((n) => { testing[n.id] = "testing"; });
    setTestResults(testing);
    await Promise.all(nodes.map((n) => testNode(n.id)));
  };

  const refreshNode = async (id: string) => {
    setRefreshing((prev) => new Set(prev).add(id));
    try {
      await api.refreshExtraNode(id);
    } finally {
      setRefreshing((prev) => { const next = new Set(prev); next.delete(id); return next; });
    }
  };

  const isTesting = Object.values(testResults).some((s) => s === "testing");

  return (
    <div className="p-6 w-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-xs text-muted-foreground mb-1">{t("extraNodes_page_breadcrumb")}</div>
          <h1 className="text-xl font-bold">{t("extraNodes_page_title")}</h1>
          <p className="text-xs text-muted-foreground mt-1">
            {t("extraNodes_page_subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {selected.size > 0 && (
            <>
              <span className="text-xs text-muted-foreground mr-1">
                {t("extraNodes_page_selectedCount", { count: selected.size })}
              </span>
              <Button
                variant="destructive"
                size="icon"
                title={`Delete ${selected.size} selected nodes`}
                onClick={() => setConfirm({
                  title: t("extraNodes_page_deleteTitle", { count: selected.size }),
                  description: t("confirm.cannotUndo"),
                  onConfirm: () => { setConfirm(null); handleBatchDelete(); },
                })}
                disabled={deleting}
              >
                {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              </Button>
            </>
          )}
          {nodes.length > 0 && (
            <Button variant="outline" size="icon" title="Test all nodes" onClick={handleTestAll} disabled={isTesting}>
              {isTesting ? <Loader2 size={16} className="animate-spin" /> : <PlayCircle size={16} />}
            </Button>
          )}
          <AddNodeDialog onAdded={load} />
        </div>
      </div>

      {/* Select-all bar */}
      {nodes.length > 0 && !loading && (
        <div className="flex items-center gap-2 mb-3 px-1">
          <button onClick={toggleSelectAll} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
            {selected.size === nodes.length
              ? <CheckSquare size={14} className="text-primary" />
              : <Square size={14} />}
            {selected.size === nodes.length ? t("extraNodes_page_deselectAll") : t("extraNodes_page_selectAll")}
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 size={20} className="animate-spin mr-2" />{t("status.loading")}
        </div>
      ) : nodes.length === 0 ? (
        <div className="w-full py-10 border border-dashed border-border rounded-lg flex flex-col items-center gap-2 text-muted-foreground">
          <Server size={24} />
          <div className="text-sm font-medium">{t("extraNodes_page_empty")}</div>
          <div className="text-xs">{t("extraNodes_page_emptyHint")}</div>
        </div>
      ) : (
        <div className="space-y-2">
          {nodes.map((node) => {
            const status = testResults[node.id] ?? "idle";
            const isSelected = selected.has(node.id);
            return (
              <Card
                key={node.id}
                className={`py-0 gap-0 transition-colors cursor-pointer ${isSelected ? "ring-1 ring-primary bg-primary/5" : ""}`}
                onClick={() => toggleSelect(node.id)}
              >
                <CardContent className="flex items-center gap-3 px-4 py-3">
                  {/* Checkbox */}
                  <button
                    className="shrink-0 text-muted-foreground"
                    onClick={(e) => { e.stopPropagation(); toggleSelect(node.id); }}
                  >
                    {isSelected
                      ? <CheckSquare size={14} className="text-primary" />
                      : <Square size={14} />}
                  </button>
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Server size={16} className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{node.name}</span>
                      <Badge variant="secondary" className="font-mono text-xs uppercase">{node.node_type}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground font-mono mt-0.5">
                      {node.server}:{node.port}
                      {node.refresh_url && <span className="ml-2 text-primary">+ refresh</span>}
                    </div>
                    {status !== "idle" && status !== "testing" && !status.error && status.isp && (
                      <div className="text-xs text-muted-foreground mt-0.5 truncate max-w-xs">
                        {status.city && `${status.city}, `}{status.isp}
                      </div>
                    )}
                  </div>

                  <TestBadge status={status} />

                  <div className="flex items-center gap-0.5 shrink-0">
                      {/* Test button */}
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        title="Test node"
                        disabled={status === "testing"}
                        onClick={(e) => { e.stopPropagation(); testNode(node.id); }}
                      >
                        {status === "testing"
                          ? <Loader2 size={14} className="animate-spin" />
                          : <PlayCircle size={14} />}
                      </Button>
                      {/* Refresh button — only when refresh_url exists */}
                      {node.refresh_url && (
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          title="Refresh IP"
                          disabled={refreshing.has(node.id)}
                          onClick={(e) => { e.stopPropagation(); refreshNode(node.id); }}
                        >
                          <RefreshCw size={14} className={refreshing.has(node.id) ? "animate-spin" : ""} />
                        </Button>
                      )}
                      {/* Remove button — always visible */}
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        title="Remove"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirm({
                            title: t("extraNodes_page_removeTitle"),
                            description: t("extraNodes_page_removeDesc", { name: node.name }),
                            onConfirm: () => { setConfirm(null); handleRemove(node.id); },
                          });
                        }}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(open) => { if (!open) setConfirm(null); }}
        title={confirm?.title ?? ""}
        description={confirm?.description}
        onConfirm={confirm?.onConfirm ?? (() => {})}
      />
    </div>
  );
}
