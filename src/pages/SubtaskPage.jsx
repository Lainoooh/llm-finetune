import { useState, useEffect } from "react";
import { Card } from "../components/Card";
import { Button } from "../components/Button";
import { Badge } from "../components/Badge";
import { Metric } from "../components/Metric";
import { Field } from "../components/Field";
import { Info } from "../components/Info";
import { SectionTitle } from "../components/SectionTitle";
import { logs, yamlText, evalYaml, datasetInfo, directoryLines } from "../data/mockData";

export function SubtaskPage({ servers, setPage, S, statusPalette }) {
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
      <div style={{ ...S.row, borderBottom: "1px solid", borderColor: S.card.border.split(" ")[2], paddingBottom: 16 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Metric label="TASK" value="task_002" wide />
          <Metric label="NAME" value="rank32_lr5e-5" wide />
          <Badge status="running" statusPalette={statusPalette} />
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Button secondary onClick={() => setPage("taskDetail")} S={S}>
            返回任务详情
          </Button>
          <Button secondary S={S}>停止训练</Button>
          <Button S={S}>启动 / 重试</Button>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 16, padding: 8, background: S.page.background === "#0a0a0a" ? "#2d2d2d" : "#f8fafc", border: "1px solid", borderColor: S.card.border.split(" ")[2], borderRadius: 16, flexWrap: "wrap" }}>
        {tabs.map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              ...S.btn,
              background: tab === key ? (S.page.background === "#0a0a0a" ? "#667eea" : "#0f172a") : "transparent",
              color: tab === key ? "#fff" : (S.page.background === "#0a0a0a" ? "#9ca3af" : "#475569"),
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <div style={{ marginTop: 20, minHeight: 520 }}>
        {tab === "base" && (
          <div>
            <SectionTitle title="基础配置" actions={<Button secondary S={S}>保存配置</Button>} S={S} />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 16 }}>
              <Field label="微调训练任务模型名" value="customer_service_v1" onChange={() => {}} S={S} />
              <Field label="子任务名称" value="rank32_lr5e-5" onChange={() => {}} S={S} />
              <label>
                <div style={{ color: S.page.background === "#0a0a0a" ? "#9ca3af" : "#64748b", fontSize: 12, marginBottom: 6 }}>远程服务器</div>
                <select value={serverId} onChange={(e) => setServerId(e.target.value)} style={S.input}>
                  {servers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <Field label="GPU" value="2,3,4,5" onChange={() => {}} S={S} />
              <Field label="基模路径" value="/models/Qwen/Qwen3-8B" onChange={() => {}} S={S} />
              <Field label="统一输出目录" value={`${selected.workDir}/outputs/customer_service_v1/task_002`} onChange={() => {}} S={S} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 16, marginTop: 16 }}>
              <Info label="服务器 CUDA" value={selected.cuda} />
              <Info label="LLaMA-Factory" value={selected.llamafactory} />
              <Info label="磁盘空间" value={selected.disk} />
            </div>
          </div>
        )}
        {tab === "dataset" && (
          <div>
            <SectionTitle
              title="数据集与 dataset_info.json"
              actions={
                <>
                  <Button secondary S={S}>上传训练/评测文件</Button>
                  <Button S={S}>同步到远程</Button>
                </>
              }
              S={S}
            />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 16 }}>
              <Field label="训练集" value="qa_sft_train_202605" onChange={() => {}} S={S} />
              <Field label="评测集" value="qa_sft_eval_202605" onChange={() => {}} S={S} />
            </div>
            <pre style={{ marginTop: 16, padding: 16, background: S.page.background === "#0a0a0a" ? "#2d2d2d" : "#f8fafc", borderRadius: 16, overflow: "auto", color: S.page.color }}>{datasetInfo}</pre>
          </div>
        )}
        {tab === "params" && (
          <div>
            <SectionTitle
              title="训练参数配置"
              actions={
                <div>
                  <Button secondary onClick={() => setMode("visual")} S={S}>
                    可视化
                  </Button>{" "}
                  <Button secondary onClick={() => setMode("yaml")} S={S}>
                    YAML
                  </Button>
                </div>
              }
              S={S}
            />
            {mode === "visual" ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 16 }}>
                <Field label="训练阶段" value="sft" onChange={() => {}} S={S} />
                <Field label="微调方式" value="lora" onChange={() => {}} S={S} />
                <Field label="LR" value="5e-5" onChange={() => {}} S={S} />
                <Field label="epoch" value="3" onChange={() => {}} S={S} />
                <Field label="batch_size" value="2" onChange={() => {}} S={S} />
                <Field label="step" value="500" onChange={() => {}} S={S} />
                <Field label="cutoff_len" value="4096" onChange={() => {}} S={S} />
                <Field label="bf16" value="true" onChange={() => {}} S={S} />
              </div>
            ) : (
              <textarea value={yaml} onChange={(e) => setYaml(e.target.value)} style={{ width: "100%", height: 430, borderRadius: 16, padding: 16, background: S.page.background === "#0a0a0a" ? "#0f172a" : "#0f172a", color: "#e2e8f0", fontFamily: "monospace", border: "1px solid", borderColor: S.card.border.split(" ")[2] }} />
            )}
          </div>
        )}
        {tab === "files" && (
          <div>
            <SectionTitle title="远程目录" actions={<Button secondary S={S}>刷新目录</Button>} S={S} />
            <Info label="输出目录" value={`${selected.workDir}/outputs/customer_service_v1/task_002`} />
            <pre style={{ marginTop: 16, background: S.page.background === "#0a0a0a" ? "#2d2d2d" : "#f8fafc", borderRadius: 16, padding: 16, color: S.page.color }}>
              {directoryLines.map((line) => (
                <div key={line}>{line}</div>
              ))}
            </pre>
          </div>
        )}
        {tab === "logs" && (
          <div>
            <SectionTitle title="实时训练日志" actions={<Button secondary S={S}>下载日志</Button>} S={S} />
            <pre style={{ background: S.page.background === "#0a0a0a" ? "#0f172a" : "#0f172a", color: "#e2e8f0", borderRadius: 16, padding: 16, height: 430, overflow: "auto" }}>
              {logs.slice(0, count).map((line) => (
                <div key={line}>{line}</div>
              ))}
            </pre>
          </div>
        )}
        {tab === "eval" && (
          <div>
            <SectionTitle
              title="模型测试与评测"
              actions={
                <>
                  <Button secondary S={S}>加载测试</Button>
                  <Button S={S}>执行评测</Button>
                </>
              }
              S={S}
            />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 16 }}>
              <Info label="Adapter 加载测试" value="通过" />
              <Info label="业务评测脚本" value="运行中" />
              <Info label="结果可视化" value="待完成" />
            </div>
            <pre style={{ marginTop: 16, background: S.page.background === "#0a0a0a" ? "#2d2d2d" : "#f8fafc", borderRadius: 16, padding: 16, color: S.page.color }}>{evalYaml}</pre>
          </div>
        )}
      </div>
    </Card>
  );
}
