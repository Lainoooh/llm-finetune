import React, { useEffect, useMemo, useState } from "react";

const statusText = {
  online: "在线",
  running: "训练中",
  succeeded: "成功",
  failed: "失败",
  draft: "草稿",
  waiting: "等待完成",
};

const statusPalette = {
  online: ["#ecfdf5", "#047857", "#a7f3d0"],
  running: ["#eef2ff", "#4338ca", "#c7d2fe"],
  succeeded: ["#ecfdf5", "#047857", "#a7f3d0"],
  failed: ["#fff1f2", "#be123c", "#fecdd3"],
  draft: ["#f8fafc", "#475569", "#e2e8f0"],
  waiting: ["#fffbeb", "#b45309", "#fde68a"],
};

const initialServers = [
  {
    id: "srv-a",
    name: "A100-训练机-01",
    host: "10.20.1.11",
    user: "root",
    password: "********",
    status: "online",
    gpu: "4 × NVIDIA A100 80GB",
    cuda: "12.1",
    torch: "2.4.0+cu121",
    llamafactory: "0.9.2.dev0",
    workDir: "/workspace/finetune-platform",
    disk: "3.8TB / 7.0TB",
  },
  {
    id: "srv-b",
    name: "H800-训练机-02",
    host: "10.20.1.22",
    user: "root",
    password: "********",
    status: "online",
    gpu: "8 × NVIDIA H800 80GB",
    cuda: "12.4",
    torch: "2.5.1+cu124",
    llamafactory: "0.9.3",
    workDir: "/data/finetune-platform",
    disk: "9.2TB / 15.0TB",
  },
];

const initialTask = {
  id: "bt-001",
  name: "customer_service_v1",
  modelName: "customer_service_v1",
  status: "waiting",
  subtasks: [
    {
      id: "task_001",
      name: "rank16_lr5e-5",
      serverName: "A100-训练机-01",
      status: "succeeded",
      gpu: "0,1",
      learningRate: "5e-5",
      epoch: 3,
      batchSize: 2,
      step: 500,
      loss: 0.91,
      score: 76.2,
      outputDir: "/workspace/finetune-platform/outputs/customer_service_v1/task_001",
    },
    {
      id: "task_002",
      name: "rank32_lr5e-5",
      serverName: "H800-训练机-02",
      status: "running",
      gpu: "2,3,4,5",
      learningRate: "5e-5",
      epoch: 3,
      batchSize: 2,
      step: 500,
      loss: 0.81,
      score: null,
      outputDir: "/data/finetune-platform/outputs/customer_service_v1/task_002",
    },
    {
      id: "task_003",
      name: "rank16_lr1e-4",
      serverName: "A100-训练机-01",
      status: "failed",
      gpu: "3",
      learningRate: "1e-4",
      epoch: 2,
      batchSize: 1,
      step: 300,
      loss: 0.99,
      score: 73.6,
      outputDir: "/workspace/finetune-platform/outputs/customer_service_v1/task_003",
    },
  ],
};

const lossData = [
  { step: 0, a: 2.41, b: 2.38, c: 2.44 },
  { step: 100, a: 1.82, b: 1.78, c: 1.91 },
  { step: 200, a: 1.43, b: 1.36, c: 1.51 },
  { step: 300, a: 1.21, b: 1.08, c: 1.29 },
  { step: 400, a: 1.06, b: 0.94, c: 1.16 },
  { step: 500, a: 0.98, b: 0.86, c: 1.05 },
  { step: 600, a: 0.91, b: 0.81, c: 0.99 },
];

const logs = [
  "[2026-05-06 10:21:01] precheck: ssh connected, workspace writable",
  "[2026-05-06 10:21:03] detected llamafactory-cli: 0.9.3",
  "[2026-05-06 10:21:05] dataset_info.json synced on remote server",
  "[2026-05-06 10:21:09] CUDA_VISIBLE_DEVICES=2,3,4,5",
  "[2026-05-06 10:21:11] llamafactory-cli train configs/train.yaml",
  "[2026-05-06 10:22:20] step=10 loss=2.114 lr=4.1e-06 grad_norm=0.82",
  "[2026-05-06 10:24:22] step=20 loss=1.932 lr=8.3e-06 grad_norm=0.77",
  "[2026-05-06 10:26:23] step=30 loss=1.734 lr=1.2e-05 grad_norm=0.69",
  "[2026-05-06 10:28:25] step=40 loss=1.571 lr=1.6e-05 grad_norm=0.61",
];

const yamlText = `model_name_or_path: /models/Qwen/Qwen3-8B
stage: sft
do_train: true
finetuning_type: lora
lora_rank: 32
lora_alpha: 64
dataset: qa_sft_train_202605
eval_dataset: qa_sft_eval_202605
template: qwen
output_dir: /data/finetune-platform/outputs/customer_service_v1/task_002
learning_rate: 0.00005
num_train_epochs: 3
per_device_train_batch_size: 2
save_steps: 500
bf16: true`;

const evalYaml = `model_name_or_path: /models/Qwen/Qwen3-8B
adapter_name_or_path: /data/finetune-platform/outputs/customer_service_v1/task_002/adapter
finetuning_type: lora
template: qwen
task: ceval_validation
lang: zh
n_shot: 5
batch_size: 4`;

const datasetInfo = `{
  "qa_sft_train_202605": {
    "file_name": "qa_sft_train_202605.jsonl",
    "columns": {
      "prompt": "instruction",
      "query": "input",
      "response": "output"
    }
  }
}`;

const directoryLines = [
  "outputs/customer_service_v1/",
  "  task_002/",
  "    configs/train.yaml",
  "    logs/train.log",
  "    adapter/",
  "    eval/",
];

const S = {
  page: { minHeight: "100vh", background: "#f1f5f9", color: "#0f172a", fontFamily: "Arial, sans-serif" },
  layout: { display: "flex" },
  sidebar: { width: 288, height: "100vh", flexShrink: 0, background: "#fff", borderRight: "1px solid #e2e8f0", padding: 20, boxSizing: "border-box" },
  brand: { background: "#0f172a", color: "#fff", borderRadius: 18, padding: 16, marginBottom: 24 },
  navBtn: { width: "100%", textAlign: "left", border: 0, borderRadius: 12, padding: "10px 12px", marginBottom: 6, cursor: "pointer", fontWeight: 600 },
  main: { height: "100vh", overflow: "auto", flex: 1, padding: 28, boxSizing: "border-box" },
  card: { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 18, padding: 20, boxShadow: "0 1px 2px rgba(15,23,42,0.05)" },
  row: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" },
  btn: { border: 0, borderRadius: 10, padding: "8px 12px", cursor: "pointer", fontWeight: 700, fontSize: 12 },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  th: { background: "#f8fafc", color: "#64748b", textTransform: "uppercase", fontSize: 11, textAlign: "left", padding: "12px 14px", borderBottom: "1px solid #e2e8f0" },
  td: { padding: "12px 14px", borderBottom: "1px solid #e2e8f0", verticalAlign: "middle" },
  input: { width: "100%", boxSizing: "border-box", border: "1px solid #cbd5e1", borderRadius: 10, padding: "9px 10px", fontSize: 13 },
};

function runSelfTests() {
  const allowed = Object.keys(statusText);
  console.assert(initialServers.length === 2, "server seed count should be 2");
  console.assert(initialTask.subtasks.length === 3, "subtask seed count should be 3");
  console.assert(initialTask.subtasks.every((t) => allowed.includes(t.status)), "all statuses should be known");
  console.assert(initialTask.subtasks.every((t) => t.learningRate && t.epoch && t.batchSize && t.step), "subtasks should include LR/EP/BS/ST");
  console.assert(lossData.every((x) => typeof x.step === "number"), "lossData should contain numeric steps");
  console.assert(["user", "password", "host", "workDir"].every((k) => k in initialServers[0]), "server edit fields must exist");
}

function Button({ children, secondary, onClick, disabled }) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      style={{ ...S.btn, background: secondary ? "#fff" : "#0f172a", color: secondary ? "#334155" : "#fff", border: secondary ? "1px solid #cbd5e1" : "1px solid #0f172a", opacity: disabled ? 0.5 : 1 }}
    >
      {children}
    </button>
  );
}

function Card({ children, style }) {
  return <section style={{ ...S.card, ...style }}>{children}</section>;
}

function Badge({ status }) {
  const [bg, fg, bd] = statusPalette[status] || statusPalette.draft;
  return <span style={{ display: "inline-block", background: bg, color: fg, border: `1px solid ${bd}`, borderLeft: `4px solid ${fg}`, borderRadius: 6, padding: "5px 9px", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>{statusText[status] || status}</span>;
}

function SectionTitle({ title, desc, actions }) {
  return <div style={{ ...S.row, marginBottom: 16 }}><div><div style={{ fontWeight: 800 }}>{title}</div>{desc ? <div style={{ color: "#64748b", fontSize: 13, marginTop: 4 }}>{desc}</div> : null}</div>{actions ? <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{actions}</div> : null}</div>;
}

function Info({ label, value }) {
  return <div style={{ border: "1px solid #e2e8f0", borderRadius: 14, padding: 14, background: "#fff" }}><div style={{ color: "#64748b", fontSize: 12 }}>{label}</div><div style={{ fontWeight: 700, marginTop: 6, wordBreak: "break-all" }}>{value}</div></div>;
}

function Field({ label, value, onChange, type = "text" }) {
  return <label style={{ display: "block" }}><div style={{ color: "#64748b", fontSize: 12, marginBottom: 6 }}>{label}</div><input type={type} value={value} onChange={onChange} style={S.input} /></label>;
}

function Sidebar({ page, setPage }) {
  const items = [["dashboard", "总览"], ["servers", "服务器"], ["tasks", "微调训练任务"], ["compare", "综合对比"]];
  const active = (key) => (key === "tasks" ? ["tasks", "taskDetail", "subtask"].includes(page) : page === key);
  return <aside style={S.sidebar}><div style={S.brand}><div style={{ fontWeight: 800 }}>微调工具平台</div><div style={{ color: "#cbd5e1", fontSize: 12, marginTop: 4 }}>LLaMA-Factory Orchestrator</div></div>{items.map(([key, label]) => <button key={key} onClick={() => setPage(key)} style={{ ...S.navBtn, background: active(key) ? "#0f172a" : "transparent", color: active(key) ? "#fff" : "#475569" }}>{label}</button>)}<div style={{ marginTop: 40, background: "#f8fafc", borderRadius: 16, padding: 14, fontSize: 12, color: "#64748b", lineHeight: 1.7 }}>并行启动；失败不自动重试；所有子任务完成后再比较。</div></aside>;
}

function Breadcrumb({ page, setPage, task }) {
  const items = [];
  if (page === "dashboard") items.push(["总览", "dashboard"]);
  if (page === "servers") items.push(["服务器", "servers"]);
  if (page === "compare") items.push(["综合对比", "compare"]);
  if (["tasks", "taskDetail", "subtask"].includes(page)) {
    items.push(["微调训练任务", "tasks"]);
    if (["taskDetail", "subtask"].includes(page)) items.push([task.name, "taskDetail"]);
    if (page === "subtask") items.push(["task_002 配置", "subtask"]);
  }
  return <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16, fontSize: 13 }}>{items.map(([label, target], i) => <React.Fragment key={`${target}-${i}`}>{i > 0 ? <span style={{ color: "#cbd5e1" }}>/</span> : null}<button onClick={() => setPage(target)} style={{ border: 0, borderRadius: 8, padding: "6px 9px", background: i === items.length - 1 ? "#0f172a" : "#fff", color: i === items.length - 1 ? "#fff" : "#64748b", cursor: "pointer" }}>{label}</button></React.Fragment>)}</div>;
}

function Stat({ title, value, desc }) {
  return <Card><div style={{ color: "#64748b", fontSize: 13 }}>{title}</div><div style={{ fontSize: 28, fontWeight: 800, marginTop: 8 }}>{value}</div><div style={{ color: "#64748b", fontSize: 12, marginTop: 4 }}>{desc}</div></Card>;
}

function LossChart() {
  const width = 760;
  const height = 250;
  const pad = 30;
  const x = (step) => pad + (step / 600) * (width - pad * 2);
  const y = (v) => height - pad - ((v - 0.7) / (2.5 - 0.7)) * (height - pad * 2);
  const pts = (k) => lossData.map((d) => `${x(d.step)},${y(d[k])}`).join(" ");
  return <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: 300, background: "#f8fafc", borderRadius: 16 }}><line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} stroke="#cbd5e1" /><line x1={pad} y1={pad} x2={pad} y2={height - pad} stroke="#cbd5e1" /><polyline points={pts("a")} fill="none" stroke="#0f172a" strokeWidth="3" /><polyline points={pts("b")} fill="none" stroke="#6366f1" strokeWidth="3" /><polyline points={pts("c")} fill="none" stroke="#10b981" strokeWidth="3" /></svg>;
}

function Dashboard({ servers, task, setPage }) {
  const running = task.subtasks.filter((x) => x.status === "running").length;
  const failed = task.subtasks.filter((x) => x.status === "failed").length;
  return <><div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 16 }}><Stat title="远程服务器" value={servers.length} desc="服务器数量" /><Stat title="子任务总数" value={task.subtasks.length} desc="并行训练" /><Stat title="训练中" value={running} desc="正在执行" /><Stat title="失败任务" value={failed} desc="手动重试" /></div><Card style={{ marginTop: 20 }}><SectionTitle title="训练 Loss 趋势" actions={<Button secondary onClick={() => setPage("compare")}>查看对比</Button>} /><LossChart /></Card></>;
}

function ServersPage({ servers, setServers }) {
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(servers[0].id);
  const [draft, setDraft] = useState({ user: "", password: "", host: "", workDir: "" });
  const selected = servers.find((s) => s.id === selectedId) || servers[0];

  function openDetail(id) {
    const server = servers.find((s) => s.id === id) || servers[0];
    setSelectedId(server.id);
    setDraft({ user: server.user, password: server.password, host: server.host, workDir: server.workDir });
    setOpen(true);
  }

  function saveServer() {
    setServers((list) => list.map((s) => (s.id === selected.id ? { ...s, ...draft } : s)));
    setOpen(false);
  }

  return <div><Card><SectionTitle title="服务器列表" desc={`共 ${servers.length} 台服务器`} actions={<><Button secondary>导入服务器</Button><Button>新增服务器</Button></>} /><div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 16 }}><table style={S.table}><thead><tr><th style={S.th}>服务器名称</th><th style={S.th}>连接地址</th><th style={S.th}>状态</th><th style={S.th}>GPU</th><th style={S.th}>CUDA</th><th style={S.th}>LLaMA-Factory</th><th style={S.th}>磁盘</th><th style={S.th}>操作</th></tr></thead><tbody>{servers.map((s) => <tr key={s.id}><td style={S.td}><b>{s.name}</b></td><td style={S.td}>{s.user}@{s.host}</td><td style={S.td}><Badge status={s.status} /></td><td style={S.td}>{s.gpu}</td><td style={S.td}>{s.cuda}</td><td style={S.td}>{s.llamafactory}</td><td style={S.td}>{s.disk}</td><td style={S.td}><div style={{ display: "flex", gap: 8 }}><Button secondary onClick={() => openDetail(s.id)}>详情</Button><Button secondary onClick={() => openDetail(s.id)}>编辑</Button></div></td></tr>)}</tbody></table></div><div style={{ ...S.row, color: "#64748b", fontSize: 13, marginTop: 14 }}><span>当前第 1 页，每页 10 条</span><div style={{ display: "flex", gap: 8 }}><Button secondary disabled>上一页</Button><Button secondary disabled>下一页</Button></div></div></Card>{open ? <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, zIndex: 50 }}><div style={{ background: "#fff", borderRadius: 24, padding: 24, width: "min(980px, 100%)", maxHeight: "90vh", overflow: "auto" }}><div style={{ ...S.row, borderBottom: "1px solid #e2e8f0", paddingBottom: 16 }}><div><div style={{ display: "flex", gap: 12, alignItems: "center" }}><b style={{ fontSize: 20 }}>{selected.name}</b><Badge status={selected.status} /></div><div style={{ color: "#64748b", marginTop: 6, fontSize: 13 }}>服务器连接信息与环境信息</div></div><div style={{ display: "flex", gap: 8 }}><Button secondary onClick={() => setOpen(false)}>取消</Button><Button onClick={saveServer}>保存</Button></div></div><SectionTitle title="可编辑连接配置" /><div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 16 }}><Field label="连接账号" value={draft.user} onChange={(e) => setDraft({ ...draft, user: e.target.value })} /><Field label="连接密码" type="password" value={draft.password} onChange={(e) => setDraft({ ...draft, password: e.target.value })} /><Field label="连接地址" value={draft.host} onChange={(e) => setDraft({ ...draft, host: e.target.value })} /><Field label="工作目录" value={draft.workDir} onChange={(e) => setDraft({ ...draft, workDir: e.target.value })} /></div><SectionTitle title="环境信息" /><div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 16 }}><Info label="GPU" value={selected.gpu} /><Info label="CUDA" value={selected.cuda} /><Info label="PyTorch" value={selected.torch} /><Info label="LLaMA-Factory" value={selected.llamafactory} /><Info label="磁盘" value={selected.disk} /><Info label="状态" value={statusText[selected.status]} /></div></div></div> : null}</div>;
}

function TaskListPage({ task, setPage }) {
  const rows = [
    { id: task.id, name: task.name, modelName: task.modelName, status: task.status, baseModel: "Qwen/Qwen3-8B", subtaskCount: task.subtasks.length, runningCount: task.subtasks.filter((s) => s.status === "running").length },
    { id: "bt-002", name: "risk_signal_v2", modelName: "risk_signal_v2", status: "draft", baseModel: "Qwen/Qwen3-14B", subtaskCount: 0, runningCount: 0 },
    { id: "bt-003", name: "inquiry_generation_abtest", modelName: "inquiry_generation_abtest", status: "succeeded", baseModel: "Qwen/Qwen3-8B", subtaskCount: 4, runningCount: 0 },
  ];
  return <Card><SectionTitle title="任务列表" desc={`共 ${rows.length} 个微调训练任务`} actions={<><Button secondary>导入任务</Button><Button>新建微调训练任务</Button></>} /><div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 16 }}><table style={S.table}><thead><tr><th style={S.th}>任务名</th><th style={S.th}>状态</th><th style={S.th}>模型名</th><th style={S.th}>基模</th><th style={S.th}>子任务</th><th style={S.th}>操作</th></tr></thead><tbody>{rows.map((r) => <tr key={r.id}><td style={S.td}><button onClick={() => setPage("taskDetail")} style={{ border: 0, background: "transparent", fontWeight: 800, cursor: "pointer" }}>{r.name}</button><div style={{ color: "#94a3b8", fontSize: 12 }}>{r.id}</div></td><td style={S.td}><Badge status={r.status} /></td><td style={S.td}>{r.modelName}</td><td style={S.td}>{r.baseModel}</td><td style={S.td}>总数 {r.subtaskCount} / 训练中 {r.runningCount}</td><td style={S.td}><div style={{ display: "flex", gap: 8 }}><Button secondary onClick={() => setPage("taskDetail")}>详情</Button><Button secondary>复制</Button></div></td></tr>)}</tbody></table></div></Card>;
}

function Metric({ label, value, wide }) {
  return <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, height: 36, minWidth: wide ? 150 : 58, border: "1px solid #e2e8f0", borderRadius: 8, background: "#f8fafc", padding: "0 8px" }}><span style={{ color: "#94a3b8", fontSize: 10, fontWeight: 800 }}>{label}</span><span style={{ fontWeight: 800, fontSize: 12, maxWidth: 115, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</span></div>;
}

function TaskTable({ subtasks, onClone, onConfig }) {
  return <div style={{ marginTop: 20, overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 16 }}><table style={{ ...S.table, minWidth: 1180 }}><thead><tr><th style={S.th}>子任务</th><th style={S.th}>状态</th><th style={S.th}>服务器</th><th style={S.th}>GPU</th><th style={S.th}>训练参数</th><th style={S.th}>训练/评测结果</th><th style={S.th}>操作</th></tr></thead><tbody>{subtasks.map((s) => <tr key={s.id}><td style={S.td}><button onClick={onConfig} style={{ border: 0, background: "transparent", fontWeight: 800, cursor: "pointer" }}>{s.id}</button><div><button onClick={onConfig} style={{ border: 0, background: "transparent", color: "#64748b", cursor: "pointer", fontSize: 12 }}>{s.name}</button></div></td><td style={S.td}><Badge status={s.status} /></td><td style={S.td}><Metric label="SVR" value={s.serverName} wide /></td><td style={S.td}><Metric label="GPU" value={s.gpu} /></td><td style={S.td}><div style={{ display: "flex", gap: 6 }}><Metric label="LR" value={s.learningRate} /><Metric label="EP" value={s.epoch} /><Metric label="BS" value={s.batchSize} /><Metric label="ST" value={s.step} /></div></td><td style={S.td}><div style={{ display: "flex", gap: 6 }}><Metric label="LOSS" value={s.loss} /><Metric label="EVAL" value={s.score ?? "待评测"} /></div></td><td style={S.td}><div style={{ display: "flex", gap: 8 }}><Button secondary onClick={() => onClone(s)}>复制</Button><Button secondary onClick={onConfig}>配置</Button></div></td></tr>)}</tbody></table></div>;
}

function TaskDetailPage({ task, setTask, setPage }) {
  function cloneTask(sub) {
    const next = `task_${String(task.subtasks.length + 1).padStart(3, "0")}`;
    setTask({ ...task, subtasks: [...task.subtasks, { ...sub, id: next, name: `${sub.name}_copy`, status: "draft", score: null }] });
  }
  function startAll() {
    setTask({ ...task, status: "running", subtasks: task.subtasks.map((s) => (["draft", "failed"].includes(s.status) ? { ...s, status: "running" } : s)) });
  }
  const running = task.subtasks.filter((s) => s.status === "running").length;
  const succeeded = task.subtasks.filter((s) => s.status === "succeeded").length;
  const failed = task.subtasks.filter((s) => s.status === "failed").length;
  return <Card><div style={{ ...S.row, borderBottom: "1px solid #e2e8f0", paddingBottom: 16 }}><div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><Metric label="ID" value={task.id} wide /><Metric label="MODEL" value={task.modelName} wide /><Badge status={task.status} /></div><div style={{ display: "flex", gap: 8 }}><Button secondary>新建子任务</Button><Button onClick={startAll}>并行启动任务</Button></div></div><div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12, marginTop: 16 }}><Info label="TOTAL" value={task.subtasks.length} /><Info label="RUNNING" value={running} /><Info label="SUCCEEDED" value={succeeded} /><Info label="FAILED" value={failed} /></div><TaskTable subtasks={task.subtasks} onClone={cloneTask} onConfig={() => setPage("subtask")} /></Card>;
}

function SubtaskPage({ servers, setPage }) {
  const [serverId, setServerId] = useState(servers[1].id);
  const [tab, setTab] = useState("base");
  const [mode, setMode] = useState("visual");
  const [yaml, setYaml] = useState(yamlText);
  const [count, setCount] = useState(6);
  const selected = servers.find((s) => s.id === serverId) || servers[0];
  useEffect(() => {
    const timer = setInterval(() => setCount((v) => Math.min(v + 1, logs.length)), 1200);
    return () => clearInterval(timer);
  }, []);
  const tabs = [["base", "基础配置"], ["dataset", "数据集"], ["params", "训练参数"], ["files", "远程目录"], ["logs", "训练日志"], ["eval", "测试评测"]];
  return <Card><div style={{ ...S.row, borderBottom: "1px solid #e2e8f0", paddingBottom: 16 }}><div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><Metric label="TASK" value="task_002" wide /><Metric label="NAME" value="rank32_lr5e-5" wide /><Badge status="running" /></div><div style={{ display: "flex", gap: 8 }}><Button secondary onClick={() => setPage("taskDetail")}>返回任务详情</Button><Button secondary>停止训练</Button><Button>启动 / 重试</Button></div></div><div style={{ display: "flex", gap: 8, marginTop: 16, padding: 8, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 16, flexWrap: "wrap" }}>{tabs.map(([key, label]) => <button key={key} onClick={() => setTab(key)} style={{ ...S.btn, background: tab === key ? "#0f172a" : "transparent", color: tab === key ? "#fff" : "#475569" }}>{label}</button>)}</div><div style={{ marginTop: 20, minHeight: 520 }}>{tab === "base" && <div><SectionTitle title="基础配置" actions={<Button secondary>保存配置</Button>} /><div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 16 }}><Field label="微调训练任务模型名" value="customer_service_v1" onChange={() => {}} /><Field label="子任务名称" value="rank32_lr5e-5" onChange={() => {}} /><label><div style={{ color: "#64748b", fontSize: 12, marginBottom: 6 }}>远程服务器</div><select value={serverId} onChange={(e) => setServerId(e.target.value)} style={S.input}>{servers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label><Field label="GPU" value="2,3,4,5" onChange={() => {}} /><Field label="基模路径" value="/models/Qwen/Qwen3-8B" onChange={() => {}} /><Field label="统一输出目录" value={`${selected.workDir}/outputs/customer_service_v1/task_002`} onChange={() => {}} /></div><div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 16, marginTop: 16 }}><Info label="服务器 CUDA" value={selected.cuda} /><Info label="LLaMA-Factory" value={selected.llamafactory} /><Info label="磁盘空间" value={selected.disk} /></div></div>}{tab === "dataset" && <div><SectionTitle title="数据集与 dataset_info.json" actions={<><Button secondary>上传训练/评测文件</Button><Button>同步到远程</Button></>} /><div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 16 }}><Field label="训练集" value="qa_sft_train_202605" onChange={() => {}} /><Field label="评测集" value="qa_sft_eval_202605" onChange={() => {}} /></div><pre style={{ marginTop: 16, padding: 16, background: "#f8fafc", borderRadius: 16, overflow: "auto" }}>{datasetInfo}</pre></div>}{tab === "params" && <div><SectionTitle title="训练参数配置" actions={<div><Button secondary onClick={() => setMode("visual")}>可视化</Button> <Button secondary onClick={() => setMode("yaml")}>YAML</Button></div>} />{mode === "visual" ? <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 16 }}><Field label="训练阶段" value="sft" onChange={() => {}} /><Field label="微调方式" value="lora" onChange={() => {}} /><Field label="LR" value="5e-5" onChange={() => {}} /><Field label="epoch" value="3" onChange={() => {}} /><Field label="batch_size" value="2" onChange={() => {}} /><Field label="step" value="500" onChange={() => {}} /><Field label="cutoff_len" value="4096" onChange={() => {}} /><Field label="bf16" value="true" onChange={() => {}} /></div> : <textarea value={yaml} onChange={(e) => setYaml(e.target.value)} style={{ width: "100%", height: 430, borderRadius: 16, padding: 16, background: "#0f172a", color: "#e2e8f0", fontFamily: "monospace" }} />}</div>}{tab === "files" && <div><SectionTitle title="远程目录" actions={<Button secondary>刷新目录</Button>} /><Info label="输出目录" value={`${selected.workDir}/outputs/customer_service_v1/task_002`} /><pre style={{ marginTop: 16, background: "#f8fafc", borderRadius: 16, padding: 16 }}>{directoryLines.map((line) => <div key={line}>{line}</div>)}</pre></div>}{tab === "logs" && <div><SectionTitle title="实时训练日志" actions={<Button secondary>下载日志</Button>} /><pre style={{ background: "#0f172a", color: "#e2e8f0", borderRadius: 16, padding: 16, height: 430, overflow: "auto" }}>{logs.slice(0, count).map((line) => <div key={line}>{line}</div>)}</pre></div>}{tab === "eval" && <div><SectionTitle title="模型测试与评测" actions={<><Button secondary>加载测试</Button><Button>执行评测</Button></>} /><div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 16 }}><Info label="Adapter 加载测试" value="通过" /><Info label="业务评测脚本" value="运行中" /><Info label="结果可视化" value="待完成" /></div><pre style={{ marginTop: 16, background: "#f8fafc", borderRadius: 16, padding: 16 }}>{evalYaml}</pre></div>}</div></Card>;
}

function ComparePage({ task, setPage }) {
  const allDone = task.subtasks.every((s) => ["succeeded", "failed"].includes(s.status));
  const success = task.subtasks.filter((s) => s.status === "succeeded").length;
  const running = task.subtasks.filter((s) => s.status === "running").length;
  return <div>{!allDone ? <div style={{ border: "1px solid #fde68a", background: "#fffbeb", color: "#b45309", borderRadius: 16, padding: 14, marginBottom: 16 }}>当前不满足比较条件：仍有 {running} 个子任务在训练中。</div> : null}<div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 16 }}><Stat title="子任务数量" value={task.subtasks.length} desc="统一模型名" /><Stat title="成功完成" value={success} desc="可评测导出" /><Stat title="比较状态" value={allDone ? "可执行" : "等待"} desc="全部完成后执行" /></div><div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 16, marginTop: 20 }}><Card><SectionTitle title="Train Loss 对比" /><LossChart /></Card><Card><SectionTitle title="评测结果对比" /><div>{[76.2, 80.1, 73.6].map((x, i) => <div key={i} style={{ marginBottom: 12 }}><div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}><span>task_00{i + 1}</span><span>{x}</span></div><div style={{ height: 10, background: "#e2e8f0", borderRadius: 999 }}><div style={{ width: `${x}%`, height: "100%", background: "#0f172a", borderRadius: 999 }} /></div></div>)}</div></Card></div><Card style={{ marginTop: 20 }}><SectionTitle title="参数与结果汇总" actions={<><Button secondary>导出报告</Button><Button disabled={!allDone}>执行综合比较</Button></>} /><TaskTable subtasks={task.subtasks} onClone={() => {}} onConfig={() => setPage("subtask")} /></Card></div>;
}

export default function App() {
  const [page, setPage] = useState("dashboard");
  const [servers, setServers] = useState(initialServers);
  const [task, setTask] = useState(initialTask);

  useEffect(() => {
    runSelfTests();
  }, []);

  const content = useMemo(() => {
    if (page === "servers") return <ServersPage servers={servers} setServers={setServers} />;
    if (page === "tasks") return <TaskListPage task={task} setPage={setPage} />;
    if (page === "taskDetail") return <TaskDetailPage task={task} setTask={setTask} setPage={setPage} />;
    if (page === "subtask") return <SubtaskPage servers={servers} setPage={setPage} />;
    if (page === "compare") return <ComparePage task={task} setPage={setPage} />;
    return <Dashboard servers={servers} task={task} setPage={setPage} />;
  }, [page, servers, task]);

  return <div style={S.page}><div style={S.layout}><Sidebar page={page} setPage={setPage} /><main style={S.main}><Breadcrumb page={page} setPage={setPage} task={task} />{content}</main></div></div>;
}
