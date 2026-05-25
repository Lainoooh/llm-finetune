import { useState, useRef } from "react";
import { Card } from "../components/Card";
import { SectionTitle } from "../components/SectionTitle";
import { Button } from "../components/Button";
import { Badge } from "../components/Badge";
import { Field } from "../components/Field";
import { ConfirmDialog } from "../components/ConfirmDialog";
import Spinner from "../components/Spinner";
import { Pagination } from "../components/Pagination";
import { createServer, deleteServer as deleteServerApi, getProbeTask, probeDraftServer, probeServer, updateServer } from "../api/serversApi";

function SegmentedOptions({ label, options, value, onChange, S }) {
  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 500, color: S.page.color, marginBottom: 8 }}>{label}</div>
      <div style={{ display: "flex", gap: 8 }}>
        {options.map((option) => {
          const active = value === option.key;
          return (
            <button
              key={option.key}
              onClick={() => onChange(option.key)}
              style={{
                padding: "8px 16px",
                border: active ? "1px solid #667eea" : `1px solid ${S.card.border.split(" ")[2]}`,
                borderRadius: 8,
                background: active ? (S.page.background === "#0a0a0a" ? "#667eea20" : "#667eea10") : "transparent",
                color: active ? "#667eea" : S.page.color,
                fontSize: 14,
                fontWeight: active ? 600 : 400,
                cursor: "pointer",
                transition: "all 0.2s",
              }}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function IconServer({ size = 18, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="8" x="2" y="2" rx="2" ry="2" /><rect width="20" height="8" x="2" y="14" rx="2" ry="2" />
      <line x1="6" x2="6.01" y1="6" y2="6" /><line x1="6" x2="6.01" y1="18" y2="18" />
    </svg>
  );
}
function IconCpu({ size = 16, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="16" height="16" x="4" y="4" rx="2" /><rect width="6" height="6" x="9" y="9" rx="1" />
      <path d="M15 2v2" /><path d="M15 20v2" /><path d="M2 15h2" /><path d="M2 9h2" /><path d="M20 15h2" /><path d="M20 9h2" /><path d="M9 2v2" /><path d="M9 20v2" />
    </svg>
  );
}
function IconZap({ size = 16, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" />
    </svg>
  );
}
function IconLayers({ size = 16, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" />
      <path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65" /><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65" />
    </svg>
  );
}
function IconRefreshCw({ size = 14, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" /><path d="M8 16H3v5" />
    </svg>
  );
}
function IconCheckCircle({ size = 14, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.801 10A10 10 0 1 1 17 3.335" /><path d="m9 11 3 3L22 4" />
    </svg>
  );
}

function EnvBadge({ tone = "blue", children, S }) {
  const ec = S.envCards;
  const tones = {
    green: { bg: ec.badgeGreenBg, text: ec.badgeGreenText, border: ec.badgeGreenBorder },
    blue: { bg: ec.badgeBlueBg, text: ec.badgeBlueText, border: ec.badgeBlueBorder },
    amber: { bg: ec.badgeAmberBg, text: ec.badgeAmberText, border: ec.badgeAmberBorder },
    slate: { bg: ec.badgeSlateBg, text: ec.badgeSlateText, border: ec.badgeSlateBorder },
  };
  const t = tones[tone] || tones.blue;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", borderRadius: 10, border: `1px solid ${t.border}`, background: t.bg, color: t.text, padding: "3px 10px", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>
      {children}
    </span>
  );
}

function EnvSkeleton({ width = "100%", height = 16, S }) {
  return <div style={{ width, height, borderRadius: 6, background: S.envCards.skeletonBg, animation: "pulse 1.5s ease-in-out infinite" }} />;
}

function DetailRow({ label, value, badge, loading, S }) {
  const ec = S.envCards;
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, borderBottom: `1px solid ${ec.innerBorder}`, padding: "10px 0" }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: ec.subtitle }}>{label}</span>
      {loading ? <EnvSkeleton width={140} height={16} S={S} /> : (
        <span style={{ display: "flex", alignItems: "center", gap: 8, textAlign: "right", fontSize: 13, fontWeight: 800, color: ec.value }}>
          {value}
          {badge ? <EnvBadge tone="slate" S={S}>{badge}</EnvBadge> : null}
        </span>
      )}
    </div>
  );
}

function MiniProgress({ percent, loading, S }) {
  const ec = S.envCards;
  if (loading) return <EnvSkeleton height={8} S={S} />;
  const tone = percent >= 85 ? ec.progressAmber : ec.progressBlue;
  return (
    <div style={{ marginTop: 10, height: 8, overflow: "hidden", borderRadius: 4, background: ec.progressBarBg }}>
      <div style={{ width: `${percent}%`, height: "100%", borderRadius: 4, background: tone, transition: "width 0.3s" }} />
    </div>
  );
}

function HardwareMetric({ label, main, sub, percent, loading, S }) {
  const ec = S.envCards;
  const badgeTone = percent >= 85 ? "amber" : "blue";
  return (
    <div style={{ borderRadius: 14, border: `1px solid ${ec.innerBorder}`, background: ec.innerBg, padding: 14 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: ec.subtitle }}>{label}</div>
          {loading ? <EnvSkeleton width={120} height={20} S={S} /> : (
            <div style={{ marginTop: 4, fontSize: 14, fontWeight: 800, lineHeight: "20px", color: ec.title, wordBreak: "break-word" }}>{main}</div>
          )}
        </div>
        {typeof percent === "number" && !loading ? <EnvBadge tone={badgeTone} S={S}>{percent}%</EnvBadge> : null}
        {typeof percent === "number" && loading ? <EnvSkeleton width={48} height={24} S={S} /> : null}
      </div>
      {loading ? <div style={{ marginTop: 8 }}><EnvSkeleton width={100} height={14} S={S} /></div> : (
        <div style={{ marginTop: 6, fontSize: 12, fontWeight: 600, lineHeight: "16px", color: ec.subtitle, wordBreak: "break-word" }}>{sub}</div>
      )}
      {typeof percent === "number" ? <MiniProgress percent={percent} loading={loading} S={S} /> : null}
    </div>
  );
}

function EnvCard({ title, icon: Icon, children, right, loading, S }) {
  const ec = S.envCards;
  return (
    <div style={{ position: "relative", overflow: "hidden", borderRadius: 18, border: `1px solid ${ec.cardBorder}`, background: ec.cardBg, padding: 20, boxShadow: ec.cardShadow }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ display: "flex", width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 14, background: ec.iconBg, color: ec.iconColor }}>
            <Icon size={16} color={ec.iconColor} />
          </div>
          <h4 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: ec.title }}>{title}</h4>
        </div>
        {loading ? <EnvSkeleton width={80} height={24} S={S} /> : right}
      </div>
      {children}
    </div>
  );
}

function makeEmptyEnvInfo() {
  return {
    gpuInfo: { model: "", physicalCount: 0, visibleIds: [], selectedIds: "", driver: "", cuda: "" },
    hardwareInfo: {
      cpu: { model: "", cores: 0, threads: 0 },
      memory: { used: "", total: "", percent: 0 },
      disk: { used: "", total: "", percent: 0 },
    },
    finetuneEnvInfo: { python: "", pytorch: "", transformers: "", llamafactory: "" },
    probeItems: {},
    status: "",
    checkedAt: "",
    gpu: "",
    accelerator: "",
    cuda: "",
    acceleratorRuntime: "",
    torch: "",
    aiFramework: "",
    acceleratorIds: "",
    acceleratorCount: 0,
    acceleratorVendor: "",
    finetuneTools: {},
    finetuneEnv: "",
    disk: "",
  };
}

function normalizeEnvInfo(server = {}) {
  return {
    gpuInfo: server.gpuInfo || { model: "", physicalCount: 0, visibleIds: [], selectedIds: "", driver: "", cuda: "" },
    hardwareInfo: server.hardwareInfo || {
      cpu: { model: "", cores: 0, threads: 0 },
      memory: { used: "", total: "", percent: 0 },
      disk: { used: "", total: "", percent: 0 },
    },
    finetuneEnvInfo: server.finetuneEnvInfo || { python: "", pytorch: "", transformers: "", llamafactory: "" },
    probeItems: {},
    status: server.status || "",
    checkedAt: "",
    gpu: server.gpu || "",
    accelerator: server.accelerator || server.gpu || "",
    cuda: server.cuda || "",
    acceleratorRuntime: server.acceleratorRuntime || server.cuda || "",
    torch: server.torch || "",
    aiFramework: server.aiFramework || server.torch || "",
    acceleratorIds: server.acceleratorIds || server.gpuIds || "",
    acceleratorCount: Number(server.acceleratorCount || 0),
    acceleratorVendor: server.acceleratorVendor || "",
    finetuneTools: server.finetuneTools || {},
    finetuneEnv: server.finetuneEnv || "",
    disk: server.disk || "",
  };
}

function splitDeviceIds(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatGpuCount(ids, fallbackCount = 0) {
  const items = splitDeviceIds(ids);
  if (items.length) return `${items.length} 个（${items.join(",")}）`;
  if (fallbackCount) return `${fallbackCount} 个`;
  return "-";
}

function getConnectionAddress(server) {
  if (server.accessType === "jupyter") return server.jupyterBaseUrl || server.host || "-";
  return server.host || "-";
}

export function ServersPage({ servers, setServers, reloadServers, S, statusPalette }) {
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const defaultDraft = { name: "", accessType: "jupyter", user: "", password: "", host: "", sshPort: 22, sshKey: "", jupyterBaseUrl: "", token: "", workDir: "", gpuIds: "", finetuneToolName: "LLaMA-Factory", finetuneToolContainerName: "" };
  const [draft, setDraft] = useState(defaultDraft);
  const [envInfo, setEnvInfo] = useState(makeEmptyEnvInfo());
  const [secretVisible, setSecretVisible] = useState({ token: false, password: false });
  const [testing, setTesting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, server: null });
  const [testingServers, setTestingServers] = useState(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const draftProbeCodeRef = useRef(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const pageSize = 10;
  const selected = selectedId ? servers.find((s) => s.id === selectedId) : null;
  const isNew = !selectedId;

  // 搜索和筛选
  const filteredServers = servers.filter(server => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = (
      String(server.name || "").toLowerCase().includes(searchLower) ||
      getConnectionAddress(server).toLowerCase().includes(searchLower)
    );
    const matchesStatus = statusFilter === "all" || server.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // 分页计算
  const totalPages = Math.ceil(filteredServers.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const currentServers = filteredServers.slice(startIndex, endIndex);

  // 搜索处理
  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  // 状态筛选处理
  const handleStatusFilter = (status) => {
    setStatusFilter(status);
    setCurrentPage(1);
  };

  // 统计各状态数量
  const statusCounts = {
    all: servers.length,
    online: servers.filter(s => s.status === "online").length,
    offline: servers.filter(s => s.status === "offline").length,
  };

  const availableTools = ["LLaMA-Factory"];
  const accessTypes = [
    { key: "jupyter", label: "Jupyter" },
    { key: "ssh", label: "SSH" },
  ];

  function openNew() {
    setSelectedId(null);
    setDraft(defaultDraft);
    setEnvInfo(makeEmptyEnvInfo());
    setSecretVisible({ token: false, password: false });
    draftProbeCodeRef.current = null;
    setOpen(true);
  }

  function openEdit(id) {
    const server = servers.find((s) => s.id === id);
    if (!server) return;
    setSelectedId(server.id);
    setDraft({
      name: server.name,
      accessType: server.accessType || "jupyter",
      user: server.user,
      password: server.password,
      host: server.host,
      sshPort: server.sshPort || 22,
      sshKey: server.sshKey || "",
      jupyterBaseUrl: server.jupyterBaseUrl || "",
      token: server.token || "",
      workDir: server.workDir,
      gpuIds: server.gpuIds || "",
      finetuneToolName: server.finetuneToolName || "LLaMA-Factory",
      finetuneToolContainerName: server.finetuneToolContainerName || ""
    });
    setEnvInfo(normalizeEnvInfo(server));
    setSecretVisible({ token: false, password: false });
    setOpen(true);
  }

  async function saveServer() {
    const validation = validateDraft({ requireGpuIds: true });
    if (validation) {
      alert(validation);
      return;
    }
    try {
      if (isNew) {
        const payload = draftProbeCodeRef.current
          ? { ...draft, probeCode: draftProbeCodeRef.current }
          : draft;
        const created = await createServer(payload);
        setServers((list) => [...list, created]);
        draftProbeCodeRef.current = null;
      } else {
        const updated = await updateServer(selectedId, draft);
        setServers((list) => list.map((s) => (s.id === selectedId ? updated : s)));
      }
      setOpen(false);
      await reloadServers?.();
    } catch (error) {
      alert(`保存服务器失败：${error.message}`);
    }
  }

  function deleteServer(id) {
    const server = servers.find((s) => s.id === id);
    setDeleteConfirm({ open: true, server });
  }

  async function confirmDelete() {
    try {
      await deleteServerApi(deleteConfirm.server.id);
      setServers((list) => list.filter((s) => s.id !== deleteConfirm.server.id));
      setDeleteConfirm({ open: false, server: null });
    } catch (error) {
      alert(`删除服务器失败：${error.message}`);
    }
  }

  async function testConnection() {
    const validation = validateDraft();
    if (validation) {
      alert(validation);
      return;
    }
    setTesting(true);
    try {
      // 如果是编辑已有服务器，使用 probeServer 保存到数据库；否则用 probeDraftServer
      const task = selectedId
        ? await probeServer(selectedId)
        : await probeDraftServer(draft);
      const completedTask = await pollProbeTask(task.probeCode, (nextTask) => {
        applyProbeTaskToModal(nextTask);
        // 如果是编辑已有服务器，更新 servers 列表中的数据
        if (selectedId && nextTask.server) {
          setServers((list) =>
            list.map((s) => (s.id === selectedId ? { ...s, ...nextTask.server } : s))
          );
        }
      });
      // 新增服务器时，记住 draft 探测的 probeCode，保存时关联到新服务器
      if (!selectedId && completedTask) {
        draftProbeCodeRef.current = completedTask.probeCode;
      }
    } catch (error) {
      console.error("连通性测试失败:", error);
      setEnvInfo((prev) => ({
        ...prev,
        status: "offline",
        gpuInfo: { ...prev.gpuInfo, model: "-", driver: "-", cuda: "-" },
        hardwareInfo: {
          cpu: { model: "-", cores: 0, threads: 0 },
          memory: { used: "-", total: "-", percent: 0 },
          disk: { used: "-", total: "-", percent: 0 },
        },
        finetuneEnvInfo: { python: "-", pytorch: "-", transformers: "-", llamafactory: "-" },
        acceleratorIds: draft.gpuIds,
        acceleratorCount: splitDeviceIds(draft.gpuIds).length,
        finetuneTools: {},
        disk: "-",
      }));
      alert(`连通性测试失败：${error.message}`);
    } finally {
      setTesting(false);
    }
  }

  async function testServerConnection(serverId) {
    setTestingServers(prev => new Set(prev).add(serverId));
    try {
      const task = await probeServer(serverId);
      await pollProbeTask(task.probeCode, (nextTask) => {
        if (nextTask.server) {
          setServers(list => list.map(s => (s.id === serverId ? { ...s, ...nextTask.server } : s)));
        }
      });
    } catch (error) {
      console.error("服务器探测失败:", error);
      setServers(list => list.map(s => {
        if (s.id === serverId) {
          return {
            ...s,
            gpu: "-",
            cuda: "-",
            torch: "-",
            finetuneTools: {},
            disk: "-",
            status: "offline",
            lastError: error.message,
          };
        }
        return s;
      }));
      alert(`服务器探测失败：${error.message}`);
    } finally {
      setTestingServers(prev => {
        const next = new Set(prev);
        next.delete(serverId);
        return next;
      });
    }
  }

  function batchTestConnection() {
    currentServers.forEach(server => {
      testServerConnection(server.id);
    });
  }

  function validateDraft({ requireGpuIds = false } = {}) {
    if (!draft.name?.trim()) return "请填写服务器名称";
    if (requireGpuIds && !draft.gpuIds?.trim()) return "请填写设备编号";
    if (!draft.workDir?.trim()) return "请填写工作目录";
    if (!draft.finetuneToolName?.trim()) return "请选择微调工具";
    if (!draft.finetuneToolContainerName?.trim()) return "请填写微调工具容器名";
    if (draft.accessType === "jupyter") {
      if (!draft.jupyterBaseUrl?.trim()) return "请填写 Jupyter Base URL";
      if (!draft.token?.trim()) return "请填写 Jupyter Token";
      return "";
    }
    if (!draft.host?.trim()) return "请填写连接地址";
    if (!draft.user?.trim() && !draft.host.includes("@")) return "请填写连接账号，或在连接地址中使用 user@host";
    if (!draft.password?.trim() && !draft.sshKey?.trim()) return "请填写连接密码或 SSH Private Key";
    return "";
  }

  async function pollProbeTask(probeCode, onUpdate) {
    let latest = null;
    for (let index = 0; index < 120; index += 1) {
      latest = await getProbeTask(probeCode);
      onUpdate?.(latest);
      if (latest.status === "completed") return latest;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    throw new Error("探测任务超时，请稍后查看结果");
  }

  function applyProbeTaskToModal(task) {
    const hardware = task.items?.hardware || {};
    const finetuneEnv = task.items?.finetuneEnv || {};
    setEnvInfo((current) => {
      const next = { ...current, probeItems: task.items || {}, status: task.server?.status || current.status };
      if (hardware.status === "succeeded") {
        const d = hardware.data || {};
        if (d.gpuInfo) next.gpuInfo = d.gpuInfo;
        if (d.hardwareInfo) next.hardwareInfo = d.hardwareInfo;
        next.gpu = d.gpu || next.gpu;
        next.accelerator = d.accelerator || d.gpu || next.accelerator;
        next.cuda = d.acceleratorRuntime || next.cuda;
        next.acceleratorRuntime = d.acceleratorRuntime || next.acceleratorRuntime;
        next.acceleratorIds = d.acceleratorIds || next.acceleratorIds;
        next.acceleratorCount = Number(d.acceleratorCount || next.acceleratorCount || 0);
        next.disk = d.disk || next.disk;
        next.checkedAt = new Date().toLocaleString();
      }
      if (finetuneEnv.status === "succeeded") {
        const d = finetuneEnv.data || {};
        if (d.finetuneEnvInfo) next.finetuneEnvInfo = d.finetuneEnvInfo;
        next.torch = d.torch || next.torch;
        next.aiFramework = d.aiFramework || next.aiFramework;
        next.finetuneEnv = d.finetuneEnv || next.finetuneEnv;
        next.finetuneTools = d.finetuneTools || next.finetuneTools;
        if (!next.checkedAt) next.checkedAt = new Date().toLocaleString();
      }
      return next;
    });
  }

  function probeValue(itemType, fallback) {
    const item = envInfo.probeItems?.[itemType];
    if (!item || item.status === "queued" || item.status === "running") return testing ? <Spinner size="small" /> : fallback;
    if (item.status === "failed") return <span style={{ color: "#ef4444" }}>{item.error || "探测失败"}</span>;
    return fallback;
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Card style={{ flex: 1, display: 'flex', flexDirection: 'column' }} S={S}>
        {/* 标题行 */}
        <SectionTitle
          title="服务器列表"
          desc={`共 ${filteredServers.length} 台服务器${searchTerm ? ` (搜索结果)` : ''}`}
          actions={
            <div style={{ display: "flex", gap: 8 }}>
              <Button secondary onClick={batchTestConnection} S={S}>连通性检查</Button>
              <Button onClick={openNew} S={S}>新增服务器</Button>
            </div>
          }
          S={S}
          style={{ marginBottom: 8 }}
        />

        {/* 筛选行：状态标签（左） + 搜索框（右） */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 12,
        }}>
          {/* 左侧：状态筛选 */}
          <div style={{ display: 'flex', gap: 6 }}>
            {[
              { key: 'all', label: '全部', count: statusCounts.all },
              { key: 'online', label: '在线', count: statusCounts.online },
              { key: 'offline', label: '离线', count: statusCounts.offline },
            ].map(({ key, label, count }) => {
              const isActive = statusFilter === key;
              const activeColor = S.page.background === "#0a0a0a" ? "#8b5cf6" : "#004EA2";
              const activeBg = S.page.background === "#0a0a0a" ? "#8b5cf615" : "#F0F7FF";

              return (
                <button
                  key={key}
                  onClick={() => handleStatusFilter(key)}
                  style={{
                    padding: '7px 14px',
                    border: isActive
                      ? `2px solid ${activeColor}`
                      : `2px solid ${S.page.background === "#0a0a0a" ? "#374151" : "#e2e8f0"}`,
                    borderRadius: 8,
                    background: isActive
                      ? activeBg
                      : (S.page.background === "#0a0a0a" ? "#1f2937" : "#ffffff"),
                    color: isActive ? activeColor : S.page.color,
                    fontSize: 13,
                    fontWeight: isActive ? 600 : 500,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 7,
                    fontFamily: 'inherit',
                    whiteSpace: 'nowrap',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.borderColor = S.page.background === "#0a0a0a" ? "#4b5563" : "#cbd5e1";
                      e.currentTarget.style.background = S.page.background === "#0a0a0a" ? "#111827" : "#f8fafc";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.borderColor = S.page.background === "#0a0a0a" ? "#374151" : "#e2e8f0";
                      e.currentTarget.style.background = S.page.background === "#0a0a0a" ? "#1f2937" : "#ffffff";
                    }
                  }}
                >
                  {label}
                  {count !== undefined && (
                    <span style={{
                      padding: '2px 7px',
                      borderRadius: 5,
                      background: isActive
                        ? activeColor
                        : (S.page.background === "#0a0a0a" ? "#374151" : "#e5e7eb"),
                      color: isActive
                        ? '#fff'
                        : (S.page.background === "#0a0a0a" ? "#d1d5db" : "#6b7280"),
                      fontSize: 11,
                      fontWeight: 700,
                      minWidth: 20,
                      textAlign: 'center',
                    }}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* 右侧：搜索框 */}
          <div style={{ position: 'relative', width: 280 }}>
            <div style={{
              position: 'absolute',
              left: 14,
              top: '50%',
              transform: 'translateY(-50%)',
              pointerEvents: 'none',
              color: S.page.background === "#0a0a0a" ? "#6b7280" : "#94a3b8",
              display: 'flex',
              alignItems: 'center',
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
            </div>

            <input
              type="text"
              value={searchTerm}
              onChange={handleSearch}
              placeholder="搜索服务器名称、地址..."
              style={{
                width: '100%',
                fontSize: 14,
                padding: '10px 44px 10px 44px',
                border: `2px solid ${S.page.background === "#0a0a0a" ? "#374151" : "#e2e8f0"}`,
                borderRadius: 4,
                background: S.page.background === "#0a0a0a" ? "#1f2937" : "#ffffff",
                color: S.page.color,
                outline: 'none',
                transition: 'all 0.2s',
                fontFamily: 'inherit',
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#667eea';
                e.target.style.background = S.page.background === "#0a0a0a" ? "#111827" : "#f9fafb";
              }}
              onBlur={(e) => {
                e.target.style.borderColor = S.page.background === "#0a0a0a" ? "#374151" : "#e2e8f0";
                e.target.style.background = S.page.background === "#0a0a0a" ? "#1f2937" : "#ffffff";
              }}
            />

            {searchTerm && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setCurrentPage(1);
                }}
                style={{
                  position: 'absolute',
                  right: 14,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  border: 0,
                  background: S.page.background === "#0a0a0a" ? "#374151" : "#e5e7eb",
                  cursor: 'pointer',
                  padding: 6,
                  borderRadius: 4,
                  color: S.page.background === "#0a0a0a" ? "#9ca3af" : "#6b7280",
                  display: 'flex',
                  alignItems: 'center',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = S.page.background === "#0a0a0a" ? "#4b5563" : "#d1d5db";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = S.page.background === "#0a0a0a" ? "#374151" : "#e5e7eb";
                }}
                title="清除搜索"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* 可滚动区域：表格 */}
        <div style={{ flex: 1, overflow: 'auto' }}>
          <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 6 }}>
            <table style={S.table}>
            <thead>
              <tr>
                <th style={{ ...S.th, minWidth: 120 }}>服务器名称</th>
                <th style={{ ...S.th, minWidth: 140 }}>连接地址</th>
                <th style={{ ...S.th, width: 80 }}>连接方式</th>
                <th style={{ ...S.th, width: 70 }}>状态</th>
                <th style={{ ...S.th, minWidth: 130 }}>微调工具</th>
                <th style={{ ...S.th, minWidth: 160 }}>显卡型号</th>
                <th style={{ ...S.th, minWidth: 130 }}>磁盘</th>
                <th style={{ ...S.th, width: 80 }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {currentServers.map((s) => {
                const gi = s.gpuInfo || {};
                const hi = s.hardwareInfo || {};
                const dsk = hi.disk || {};
                const fi = s.finetuneEnvInfo || {};
                const gpuDisplay = gi.model ? `${gi.physicalCount || 0}×${gi.model.replace(/^NVIDIA\s*/i, "")}` : (s.accelerator || s.gpu || "-");
                const diskPercent = typeof dsk.percent === "number" && dsk.percent > 0 ? dsk.percent : (() => { const m = (s.disk || "").match(/^([\d.]+)TB\s*\/\s*([\d.]+)TB$/); return m ? Math.round(parseFloat(m[1]) / parseFloat(m[2]) * 100) : null; })();
                const diskText = dsk.used && dsk.total ? `${dsk.used} / ${dsk.total}` : (s.disk || "-");
                const toolVersion = fi.llamafactory || (s.finetuneTools && s.finetuneTools[s.finetuneToolName]) || "";
                return (
                <tr key={s.id}>
                  <td style={S.td}><b>{s.name}</b></td>
                  <td style={S.td}>{getConnectionAddress(s)}</td>
                  <td style={S.td}>{s.accessType === "ssh" ? "SSH" : "Jupyter"}</td>
                  <td style={S.td}>
                    {testingServers.has(s.id) ? <Spinner size="small" /> : <Badge status={s.status} statusPalette={statusPalette} />}
                  </td>
                  <td style={S.td}>
                    {testingServers.has(s.id) ? <Spinner size="small" /> : (
                      toolVersion ? `${s.finetuneToolName || "LLaMA-Factory"} ${toolVersion}` : (s.finetuneToolName || "-")
                    )}
                  </td>
                  <td style={S.td}>
                    {testingServers.has(s.id) ? <Spinner size="small" /> : gpuDisplay}
                  </td>
                  <td style={S.td}>
                    {testingServers.has(s.id) ? <Spinner size="small" /> : (
                      diskPercent != null ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          <div style={{ fontSize: 12, color: S.envCards.subtitle }}>{diskText} ({diskPercent}%)</div>
                          <div style={{ width: "100%", height: 6, background: S.envCards.progressBarBg, borderRadius: 3, overflow: "hidden" }}>
                            <div style={{ width: `${diskPercent}%`, height: "100%", background: diskPercent > 80 ? S.envCards.progressAmber : S.envCards.progressBlue, transition: "width 0.3s", borderRadius: 3 }} />
                          </div>
                        </div>
                      ) : diskText
                    )}
                  </td>
                  <td style={S.td}>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        onClick={() => testServerConnection(s.id)}
                        disabled={testingServers.has(s.id)}
                        style={{
                          border: 0,
                          background: "transparent",
                          cursor: testingServers.has(s.id) ? "not-allowed" : "pointer",
                          padding: 6,
                          borderRadius: 6,
                          color: S.page.background === "#0a0a0a" ? "#9ca3af" : "#6B7280",
                          transition: "all 0.2s",
                          opacity: testingServers.has(s.id) ? 0.5 : 1,
                        }}
                        onMouseEnter={(e) => {
                          if (!testingServers.has(s.id)) {
                            e.currentTarget.style.background = S.page.background === "#0a0a0a" ? "#2d2d2d" : "#F9FAFB";
                            e.currentTarget.style.color = S.page.background === "#0a0a0a" ? "#e5e7eb" : "#004EA2";
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!testingServers.has(s.id)) {
                            e.currentTarget.style.background = "transparent";
                            e.currentTarget.style.color = S.page.background === "#0a0a0a" ? "#9ca3af" : "#6B7280";
                          }
                        }}
                        title="连通性检查"
                      >
                        {testingServers.has(s.id) ? (
                          <Spinner size="small" />
                        ) : (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                          </svg>
                        )}
                      </button>
                      <button
                        onClick={() => openEdit(s.id)}
                        style={{
                          border: 0,
                          background: "transparent",
                          cursor: "pointer",
                          padding: 6,
                          borderRadius: 6,
                          color: S.page.background === "#0a0a0a" ? "#9ca3af" : "#6B7280",
                          transition: "all 0.2s",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = S.page.background === "#0a0a0a" ? "#2d2d2d" : "#F9FAFB";
                          e.currentTarget.style.color = S.page.background === "#0a0a0a" ? "#e5e7eb" : "#004EA2";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "transparent";
                          e.currentTarget.style.color = S.page.background === "#0a0a0a" ? "#9ca3af" : "#6B7280";
                        }}
                        title="编辑"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => deleteServer(s.id)}
                        style={{
                          border: 0,
                          background: "transparent",
                          cursor: "pointer",
                          padding: 6,
                          borderRadius: 6,
                          color: S.page.background === "#0a0a0a" ? "#9ca3af" : "#6B7280",
                          transition: "all 0.2s",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = S.page.background === "#0a0a0a" ? "#2d2d2d" : "#FEF2F2";
                          e.currentTarget.style.color = "#EF4444";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "transparent";
                          e.currentTarget.style.color = S.page.background === "#0a0a0a" ? "#9ca3af" : "#6B7280";
                        }}
                        title="删除"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          <line x1="10" y1="11" x2="10" y2="17" />
                          <line x1="14" y1="11" x2="14" y2="17" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 固定区域：分页 */}
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        pageSize={pageSize}
        totalItems={filteredServers.length}
        onPageChange={setCurrentPage}
        S={S}
      />
    </Card>

    {/* 弹窗 */}
    {open ? (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, zIndex: 50 }}>
          <div style={{ background: S.card.background, borderRadius: 24, padding: 24, width: "min(980px, 100%)", maxHeight: "90vh", overflow: "auto" }}>
            <div style={{ ...S.row, borderBottom: "1px solid", borderColor: S.card.border.split(" ")[2], paddingBottom: 16 }}>
              <div>
                <b style={{ fontSize: 20, color: S.page.color }}>{isNew ? "新增服务器" : "编辑服务器"}</b>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <Button secondary onClick={() => setOpen(false)} S={S}>
                  取消
                </Button>
                <Button onClick={saveServer} S={S}>保存</Button>
              </div>
            </div>

            <SectionTitle title="基础配置" S={S} />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 16 }}>
              <Field label="服务器名称" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} S={S} />
              <Field label="设备编号" value={draft.gpuIds} onChange={(e) => setDraft({ ...draft, gpuIds: e.target.value })} placeholder="例如: 0,1,2,3" S={S} />
              <Field label="工作目录" value={draft.workDir} onChange={(e) => setDraft({ ...draft, workDir: e.target.value })} S={S} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginTop: 16 }}>
              <SegmentedOptions
                label="连接方式"
                options={accessTypes}
                value={draft.accessType}
                onChange={(accessType) => setDraft({ ...draft, accessType })}
                S={S}
              />
              <SegmentedOptions
                label="微调工具"
                options={availableTools.map((tool) => ({ key: tool, label: tool }))}
                value={draft.finetuneToolName}
                onChange={(finetuneToolName) => setDraft({ ...draft, finetuneToolName })}
                S={S}
              />
              <Field label="微调工具容器名" value={draft.finetuneToolContainerName} onChange={(e) => setDraft({ ...draft, finetuneToolContainerName: e.target.value })} placeholder="例如: llamafactory" S={S} />
            </div>

            {draft.accessType === "jupyter" ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 16, marginTop: 16 }}>
                <Field label="Jupyter Base URL" value={draft.jupyterBaseUrl} onChange={(e) => setDraft({ ...draft, jupyterBaseUrl: e.target.value })} placeholder="例如: http://host:30009/jupyter" S={S} />
                <Field
                  label="Jupyter Token"
                  value={draft.token}
                  onChange={(e) => setDraft({ ...draft, token: e.target.value })}
                  placeholder="不填则使用后端默认 token"
                  revealable
                  revealed={secretVisible.token}
                  onToggleReveal={() => setSecretVisible((state) => ({ ...state, token: !state.token }))}
                  S={S}
                />
              </div>
            ) : (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 16, marginTop: 16 }}>
                  <Field label="连接账号" value={draft.user} onChange={(e) => setDraft({ ...draft, user: e.target.value })} S={S} />
                  <Field label="连接地址" value={draft.host} onChange={(e) => setDraft({ ...draft, host: e.target.value })} S={S} />
                  <Field
                    label="连接密码"
                    value={draft.password}
                    onChange={(e) => setDraft({ ...draft, password: e.target.value })}
                    revealable
                    revealed={secretVisible.password}
                    onToggleReveal={() => setSecretVisible((state) => ({ ...state, password: !state.password }))}
                    S={S}
                  />
                </div>
                <div style={{ marginTop: 16 }}>
                  <label style={{ display: "block" }}>
                    <div style={{ color: S.page.background === "#0a0a0a" ? "#9ca3af" : "#64748b", fontSize: 13, marginBottom: 6 }}>SSH Private Key</div>
                    <textarea
                      value={draft.sshKey}
                      onChange={(e) => setDraft({ ...draft, sshKey: e.target.value })}
                      placeholder="可填私钥内容；留空则使用密码"
                      style={{ ...S.input, minHeight: 86, fontFamily: "monospace" }}
                    />
                  </label>
                </div>
              </>
            )}

            <div style={{ borderTop: `1px solid ${S.card.border.split(" ")[2]}`, marginTop: 24, marginBottom: 24 }} />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ display: "flex", width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 14, background: S.envCards.sectionIconBg }}>
                  <IconServer size={18} color={S.envCards.sectionIconColor} />
                </div>
                <div style={{ fontWeight: 800, fontSize: 18, color: S.envCards.title }}>环境信息</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {testing ? (
                  <EnvBadge tone="amber" S={S}><span style={{ display: "inline-flex", marginRight: 4 }}><IconRefreshCw size={12} color={S.envCards.badgeAmberText} /></span> 检测中</EnvBadge>
                ) : envInfo.status === "online" ? (
                  <EnvBadge tone="green" S={S}><span style={{ display: "inline-flex", marginRight: 4 }}><IconCheckCircle size={12} color={S.envCards.badgeGreenText} /></span> 在线</EnvBadge>
                ) : envInfo.status === "offline" ? (
                  <EnvBadge tone="amber" S={S}>离线</EnvBadge>
                ) : (
                  <EnvBadge tone="slate" S={S}>未检测</EnvBadge>
                )}
                {envInfo.checkedAt ? <span style={{ fontSize: 13, fontWeight: 600, color: S.envCards.subtitle }}>最近检测：{envInfo.checkedAt}</span> : null}
                <button
                  onClick={() => testConnection()}
                  disabled={testing}
                  style={{
                    display: "flex", alignItems: "center", gap: 4,
                    padding: "4px 12px", borderRadius: 8, border: `1px solid ${S.envCards.cardBorder}`,
                    background: S.envCards.cardBg, color: S.envCards.subtitle,
                    fontSize: 13, fontWeight: 600, cursor: testing ? "not-allowed" : "pointer",
                    opacity: testing ? 0.6 : 1, transition: "all 0.2s",
                  }}
                >
                  <IconRefreshCw size={14} color={S.envCards.subtitle} />
                  {testing ? "检测中" : (envInfo.gpuInfo?.model && envInfo.hardwareInfo?.cpu?.model) ? "重新检测" : "连通性检测"}
                </button>
              </div>
            </div>

            {(() => {
              const hwLoading = testing && envInfo.probeItems?.hardware?.status !== "succeeded";
              const envLoading = testing && envInfo.probeItems?.finetuneEnv?.status !== "succeeded";
              const hwFailed = envInfo.probeItems?.hardware?.status === "failed";
              const envFailed = envInfo.probeItems?.finetuneEnv?.status === "failed";
              const gi = envInfo.gpuInfo || {};
              const hi = envInfo.hardwareInfo || {};
              const fi = envInfo.finetuneEnvInfo || {};
              const cpu = hi.cpu || {};
              const mem = hi.memory || {};
              const dsk = hi.disk || {};
              return (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {/* 服务器硬件 - 直接展示 CPU / 内存 / 磁盘 */}
                  {hwFailed ? (
                    <div style={{ fontSize: 13, color: "#ef4444", padding: "8px 0" }}>{envInfo.probeItems?.hardware?.error || "硬件探测失败"}</div>
                  ) : (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
                      <HardwareMetric label="CPU" main={`${cpu.cores || 0} 核 / ${cpu.threads || 0} 线程`} sub={cpu.model || "-"} loading={hwLoading} S={S} />
                      <HardwareMetric label="内存" main={`${mem.used || "-"} / ${mem.total || "-"}`} percent={typeof mem.percent === "number" && mem.percent > 0 ? mem.percent : undefined} loading={hwLoading} S={S} />
                      <HardwareMetric label="磁盘" main={`${dsk.used || "-"} / ${dsk.total || "-"}`} percent={typeof dsk.percent === "number" && dsk.percent > 0 ? dsk.percent : undefined} loading={hwLoading} S={S} />
                    </div>
                  )}

                  {/* GPU 资源 + 微调环境 */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                    <EnvCard title="GPU 资源" icon={IconZap} right={hwLoading ? null : <EnvBadge tone="blue" S={S}>{gi.physicalCount || 0} 张显卡</EnvBadge>} loading={false} S={S}>
                      {hwFailed ? (
                        <div style={{ fontSize: 13, color: "#ef4444", padding: "8px 0" }}>硬件探测失败</div>
                      ) : (
                        <div>
                          <DetailRow label="显卡型号" value={gi.model || "-"} loading={hwLoading} S={S} />
                          <DetailRow label="可见编号" value={(gi.visibleIds || []).join(", ") || "-"} loading={hwLoading} S={S} />
                          <DetailRow label="驱动版本" value={gi.driver || "-"} loading={hwLoading} S={S} />
                          <DetailRow label="CUDA 版本" value={gi.cuda || "-"} loading={hwLoading} S={S} />
                        </div>
                      )}
                    </EnvCard>

                    <EnvCard title="微调环境" icon={IconLayers} right={envLoading ? null : <EnvBadge tone="blue" S={S}>{draft.finetuneToolName || "LLaMA-Factory"}</EnvBadge>} loading={false} S={S}>
                      {envFailed ? (
                        <div style={{ fontSize: 13, color: "#ef4444", padding: "8px 0" }}>{envInfo.probeItems?.finetuneEnv?.error || "微调环境探测失败"}</div>
                      ) : (
                        <div>
                          <DetailRow label="Python" value={fi.python || "-"} loading={envLoading} S={S} />
                          <DetailRow label="PyTorch" value={fi.pytorch || "-"} badge={gi.cuda ? `CUDA ${gi.cuda}` : undefined} loading={envLoading} S={S} />
                          <DetailRow label="Transformers" value={fi.transformers || "-"} loading={envLoading} S={S} />
                          <DetailRow label="version" value={fi.llamafactory || "-"} loading={envLoading} S={S} />
                        </div>
                      )}
                    </EnvCard>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={deleteConfirm.open}
        title="删除服务器"
        message={`确定要删除服务器 "${deleteConfirm.server?.name}" 吗？删除后将无法恢复。`}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirm({ open: false, server: null })}
        confirmText="删除"
        danger={true}
        S={S}
      />
    </div>
  );
}
