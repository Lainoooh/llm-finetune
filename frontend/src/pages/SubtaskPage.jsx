import { useEffect, useMemo, useRef, useState } from "react";
import { Card } from "../components/Card";
import { Button } from "../components/Button";
import { Badge } from "../components/Badge";
import { Field } from "../components/Field";
import { Info } from "../components/Info";
import { SectionTitle } from "../components/SectionTitle";
import { Breadcrumb } from "../layouts/Breadcrumb";
import { evaluateSubtask, getRemoteFiles, getSubtaskLogs, startSubtask, stopSubtask, syncSubtask, updateSubtask } from "../api/tasksApi";

export function SubtaskPage({ task, subtask, servers, refreshTask, setPage, S, statusPalette }) {
  const [tab, setTab] = useState("base");
  const [draft, setDraft] = useState(subtask || {});
  const [logs, setLogs] = useState([]);
  const [directoryLines, setDirectoryLines] = useState([]);
  const [busy, setBusy] = useState("");
  const [mode, setMode] = useState("visual");
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });
  const tabRefs = useRef({});

  useEffect(() => {
    setDraft(subtask || {});
  }, [subtask]);

  useEffect(() => {
    if (!subtask) return;
    getSubtaskLogs(subtask.subtaskCode || subtask.id).then((data) => setLogs(data.lines || [])).catch(() => setLogs(subtask.logs || []));
    getRemoteFiles(subtask.subtaskCode || subtask.id).then((data) => setDirectoryLines(data.lines || [])).catch(() => setDirectoryLines(subtask.directoryLines || []));
  }, [subtask]);

  useEffect(() => {
    const currentTabElement = tabRefs.current[tab];
    if (currentTabElement) {
      setIndicatorStyle({
        left: currentTabElement.offsetLeft,
        width: currentTabElement.offsetWidth,
      });
    }
  }, [tab]);

  const selectedServer = useMemo(() => servers.find((item) => item.id === draft.serverId) || servers[0] || {}, [draft.serverId, servers]);
  const subtaskCode = draft.subtaskCode || draft.id;
  const subtasks = task.subtasks || [];
  const success = subtasks.filter((s) => s.status === "succeeded").length;
  const running = subtasks.filter((s) => s.status === "running").length;
  const failed = subtasks.filter((s) => s.status === "failed").length;
  const pending = subtasks.length - success - running - failed;

  if (!subtask) {
    return <Card S={S}>暂无子任务，请先在任务详情中新建子任务。</Card>;
  }

  async function withBusy(label, action) {
    setBusy(label);
    try {
      await action();
      await refreshTask();
    } catch (error) {
      alert(`${label}失败：${error.message}`);
    } finally {
      setBusy("");
    }
  }

  async function saveConfig() {
    await withBusy("保存配置", async () => {
      const payload = {
        name: draft.name,
        serverId: draft.serverId,
        gpu: draft.gpu,
        learningRate: draft.learningRate,
        epoch: Number(draft.epoch || 1),
        batchSize: Number(draft.batchSize || 1),
        step: Number(draft.step || 100),
        outputDir: draft.outputDir,
        trainYaml: draft.trainYaml,
        evalYaml: draft.evalYaml,
        datasetInfo: draft.datasetInfo,
      };
      await updateSubtask(subtaskCode, payload);
    });
  }

  const tabs = [
    ["base", "基础配置"],
    ["dataset", "数据集"],
    ["params", "训练参数"],
    ["files", "远程目录"],
    ["logs", "训练日志"],
    ["eval", "测试评测"],
  ];

  return (
    <Card S={S}>
      <Breadcrumb page="subtask" setPage={setPage} task={{ ...task, subtaskName: `${subtaskCode} 配置` }} S={S} />
      <div style={{ borderBottom: "1px solid", borderColor: S.card.border.split(" ")[2], paddingBottom: 16, marginBottom: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ color: S.page.color, fontWeight: 700, fontSize: 18 }}>{task.name}</span>
              <Badge status={task.status} statusPalette={statusPalette} />
            </div>
            <div style={{ fontSize: 12, color: S.page.background === "#F8F9FA" ? "#9CA3AF" : "#6b7280", marginTop: 4, display: "flex", alignItems: "center", gap: 8 }}>
              <span>{task.taskCode || task.id}</span>
              <span style={{ color: S.page.background === "#F8F9FA" ? "#D1D5DB" : "#4b5563" }}>|</span>
              <span>训练模型名：{task.modelName}</span>
              <span style={{ color: S.page.background === "#F8F9FA" ? "#D1D5DB" : "#4b5563" }}>|</span>
              <span>基模：{task.baseModel}</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Button secondary onClick={() => setPage("taskDetail")} S={S}>返回任务详情</Button>
            <Button secondary onClick={() => withBusy("停止训练", () => stopSubtask(subtaskCode))} disabled={!!busy} S={S}>停止训练</Button>
            <Button onClick={() => withBusy("启动训练", () => startSubtask(subtaskCode))} disabled={!!busy} S={S}>{busy || "启动 / 重试"}</Button>
          </div>
        </div>

        <div style={{ display: "flex", gap: 16, fontSize: 13, alignItems: "center", marginTop: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: "#10b981" }} />
            <span style={{ color: S.page.background === "#F8F9FA" ? "#6B7280" : "#9ca3af" }}>成功: {success}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: "#004EA2" }} />
            <span style={{ color: S.page.background === "#F8F9FA" ? "#6B7280" : "#9ca3af" }}>运行中: {running}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: "#ef4444" }} />
            <span style={{ color: S.page.background === "#F8F9FA" ? "#6B7280" : "#9ca3af" }}>失败: {failed}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ color: S.page.background === "#F8F9FA" ? "#6B7280" : "#9ca3af" }}>待处理: {pending}</span>
          </div>
          <div style={{ fontWeight: 600, color: S.page.color }}>总计: {subtasks.length}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: 16, paddingLeft: 16, borderLeft: "2px solid", borderColor: S.page.background === "#F8F9FA" ? "#E5E7EB" : "#374151" }}>
            <span style={{ color: S.page.background === "#F8F9FA" ? "#6B7280" : "#9ca3af" }}>当前子任务状态:</span>
            <Badge status={draft.status} statusPalette={statusPalette} />
          </div>
        </div>
      </div>

      <div style={{ margin: "8px -24px 0 -24px", padding: "0 24px", background: S.page.background === "#0a0a0a" ? "#1a1a1a" : "#F3F4F6", borderTop: "1px solid", borderBottom: "1px solid", borderColor: S.page.background === "#0a0a0a" ? "#2a3a4a" : "#E5E7EB" }}>
        <div style={{ display: "flex", position: "relative" }}>
          <div style={{ position: "absolute", top: 0, left: indicatorStyle.left, width: indicatorStyle.width, height: "100%", background: S.page.background === "#0a0a0a" ? "#004EA2" : "#E0F2FE", transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)", zIndex: 0 }} />
          <div style={{ position: "absolute", top: 0, left: indicatorStyle.left, width: indicatorStyle.width, height: 3, background: "#004EA2", transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)", zIndex: 2 }} />
          {tabs.map(([key, label]) => (
            <button
              key={key}
              ref={(el) => (tabRefs.current[key] = el)}
              onClick={() => setTab(key)}
              style={{ border: 0, borderRadius: 0, padding: "12px 20px", cursor: "pointer", fontWeight: 600, fontSize: 14, background: "transparent", color: tab === key ? "#004EA2" : (S.page.background === "#0a0a0a" ? "#9ca3af" : "#64748b"), position: "relative", zIndex: 1, transition: "color 0.2s ease-out", fontFamily: "inherit" }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 20 }}>
        {tab === "base" ? (
          <div>
            <div style={{ background: S.page.background === "#0a0a0a" ? "#1a1a1a" : "#FFFFFF", border: "1px solid", borderColor: S.card.border.split(" ")[2], borderRadius: 12, padding: 16, marginBottom: 12 }}>
              <label>
              <div style={{ color: S.page.background === "#0a0a0a" ? "#9ca3af" : "#64748b", fontSize: 13, marginBottom: 6 }}>远程服务器</div>
              <select value={draft.serverId || ""} onChange={(e) => setDraft({ ...draft, serverId: e.target.value })} style={S.input}>
                {servers.map((server) => <option key={server.id} value={server.id}>{server.name}</option>)}
              </select>
            </label>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12, fontSize: 13, color: S.page.background === "#0a0a0a" ? "#9ca3af" : "#6B7280", flexWrap: "wrap" }}>
                <span>连接: {selectedServer.host || selectedServer.endpoint || "-"}</span>
                <span style={{ color: S.page.background === "#0a0a0a" ? "#3a3a3a" : "#D1D5DB" }}>|</span>
                <span>显卡: {String(selectedServer.gpu || "-").replace(/NVIDIA\s*/g, "").replace(/\s*×\s*/g, "×")}</span>
                <span style={{ color: S.page.background === "#0a0a0a" ? "#3a3a3a" : "#D1D5DB" }}>|</span>
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>状态: <Badge status={selectedServer.status || "draft"} statusPalette={statusPalette} /></span>
                <span style={{ color: S.page.background === "#0a0a0a" ? "#3a3a3a" : "#D1D5DB" }}>|</span>
                <span>GPU: {selectedServer.gpuIds || selectedServer.acceleratorIds || "-"}</span>
                <span style={{ color: S.page.background === "#0a0a0a" ? "#3a3a3a" : "#D1D5DB" }}>|</span>
                <span>CUDA: {selectedServer.cuda || "-"}</span>
                <span style={{ color: S.page.background === "#0a0a0a" ? "#3a3a3a" : "#D1D5DB" }}>|</span>
                <span>磁盘: {selectedServer.disk || "-"}</span>
              </div>
            </div>

            <div style={{ background: S.page.background === "#0a0a0a" ? "#1a1a1a" : "#FFFFFF", border: "1px solid", borderColor: S.card.border.split(" ")[2], borderRadius: 12, padding: 16 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 200px", gap: 12, marginBottom: 12 }}>
              <Field label="子任务名称" value={draft.name || ""} onChange={(e) => setDraft({ ...draft, name: e.target.value })} S={S} />
              <Field label="GPU" value={draft.gpu || ""} onChange={(e) => setDraft({ ...draft, gpu: e.target.value })} S={S} />
              </div>
              <div style={{ marginBottom: 12 }}>
                <Field label="基模路径" value={task.baseModel || "-"} onChange={() => {}} S={S} />
              </div>
              <Field label="输出目录" value={draft.outputDir || ""} onChange={(e) => setDraft({ ...draft, outputDir: e.target.value })} S={S} />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
              <Button onClick={saveConfig} disabled={!!busy} S={S}>{busy === "保存配置" ? "保存中..." : "保存配置"}</Button>
            </div>
          </div>
        ) : null}

        {tab === "dataset" ? (
          <div style={{ display: "grid", gap: 12 }}>
            <SectionTitle title="数据集配置" actions={<Button onClick={saveConfig} disabled={!!busy} S={S}>保存数据集</Button>} S={S} />
            <textarea value={draft.datasetInfo || "{}"} onChange={(e) => setDraft({ ...draft, datasetInfo: e.target.value })} style={{ ...S.input, minHeight: 220, fontFamily: "monospace" }} />
          </div>
        ) : null}

        {tab === "params" ? (
          <div style={{ display: "grid", gap: 16 }}>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginBottom: 16 }}>
              <Button secondary onClick={() => setMode("visual")} S={S}>可视化</Button>
              <Button secondary onClick={() => setMode("yaml")} S={S}>YAML</Button>
              <Button onClick={saveConfig} disabled={!!busy} S={S}>保存参数</Button>
            </div>
            {mode === "visual" ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 16 }}>
              <Field label="训练阶段" value={draft.stage || "sft"} onChange={(e) => setDraft({ ...draft, stage: e.target.value })} S={S} />
              <Field label="微调方式" value={draft.finetuneType || "lora"} onChange={(e) => setDraft({ ...draft, finetuneType: e.target.value })} S={S} />
              <Field label="学习率" value={draft.learningRate || ""} onChange={(e) => setDraft({ ...draft, learningRate: e.target.value })} S={S} />
              <Field label="Epoch" value={draft.epoch || ""} onChange={(e) => setDraft({ ...draft, epoch: e.target.value })} S={S} />
              <Field label="Batch Size" value={draft.batchSize || ""} onChange={(e) => setDraft({ ...draft, batchSize: e.target.value })} S={S} />
              <Field label="Save Steps" value={draft.step || ""} onChange={(e) => setDraft({ ...draft, step: e.target.value })} S={S} />
              <Field label="cutoff_len" value={draft.cutoffLen || "4096"} onChange={(e) => setDraft({ ...draft, cutoffLen: e.target.value })} S={S} />
              <Field label="bf16" value={draft.bf16 || "true"} onChange={(e) => setDraft({ ...draft, bf16: e.target.value })} S={S} />
            </div>
            ) : (
            <textarea value={draft.trainYaml || ""} onChange={(e) => setDraft({ ...draft, trainYaml: e.target.value })} style={{ ...S.input, minHeight: 260, fontFamily: "monospace" }} />
            )}
          </div>
        ) : null}

        {tab === "files" ? (
          <div style={{ display: "grid", gap: 12 }}>
            <SectionTitle title="远程目录" actions={<><Button secondary onClick={() => withBusy("同步到远程", () => syncSubtask(subtaskCode))} disabled={!!busy} S={S}>同步到远程</Button><Button onClick={() => getRemoteFiles(subtaskCode).then((data) => setDirectoryLines(data.lines || []))} S={S}>刷新目录</Button></>} S={S} />
            <pre style={{ background: "#0f172a", color: "#e2e8f0", padding: 16, borderRadius: 8, minHeight: 220, overflow: "auto" }}>{directoryLines.join("\n") || "暂无远程目录数据"}</pre>
          </div>
        ) : null}

        {tab === "logs" ? (
          <div style={{ display: "grid", gap: 12 }}>
            <SectionTitle title="训练日志" actions={<Button onClick={() => getSubtaskLogs(subtaskCode).then((data) => setLogs(data.lines || []))} S={S}>刷新日志</Button>} S={S} />
            <pre style={{ background: "#0f172a", color: "#e2e8f0", padding: 16, borderRadius: 8, minHeight: 320, overflow: "auto" }}>{logs.join("\n") || "暂无训练日志"}</pre>
          </div>
        ) : null}

        {tab === "eval" ? (
          <div style={{ display: "grid", gap: 12 }}>
            <SectionTitle title="测试评测" actions={<Button onClick={() => withBusy("执行评测", () => evaluateSubtask(subtaskCode))} disabled={!!busy} S={S}>执行评测</Button>} S={S} />
            <textarea value={draft.evalYaml || ""} onChange={(e) => setDraft({ ...draft, evalYaml: e.target.value })} style={{ ...S.input, minHeight: 220, fontFamily: "monospace" }} />
            <Info label="当前评测分数" value={draft.score ?? "待评测"} />
          </div>
        ) : null}
      </div>
    </Card>
  );
}
