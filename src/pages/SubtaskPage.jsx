import { useState, useEffect, useRef } from "react";
import { Card } from "../components/Card";
import { Button } from "../components/Button";
import { Badge } from "../components/Badge";
import { Metric } from "../components/Metric";
import { Field } from "../components/Field";
import { Info } from "../components/Info";
import { SectionTitle } from "../components/SectionTitle";
import { Breadcrumb } from "../layouts/Breadcrumb";
import { logs, yamlText, evalYaml, datasetInfo, directoryLines } from "../data/mockData";

export function SubtaskPage({ task, servers, setPage, S, statusPalette }) {
  const [serverId, setServerId] = useState(servers[1].id);
  const [tab, setTab] = useState("base");
  const [mode, setMode] = useState("visual");
  const [yaml, setYaml] = useState(yamlText);
  const [count, setCount] = useState(6);
  const selected = servers.find((s) => s.id === serverId) || servers[0];

  // 滑动指示器状态
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });
  const tabRefs = useRef({});

  // 当前子任务（模拟数据，实际应该从路由或状态获取）
  const currentSubtask = task.subtasks[1]; // task_002

  // 统计信息
  const success = task.subtasks.filter((s) => s.status === "succeeded").length;
  const running = task.subtasks.filter((s) => s.status === "running").length;
  const failed = task.subtasks.filter((s) => s.status === "failed").length;
  const pending = task.subtasks.length - success - running - failed;

  // 更新滑动指示器位置
  useEffect(() => {
    const currentTabElement = tabRefs.current[tab];
    if (currentTabElement) {
      setIndicatorStyle({
        left: currentTabElement.offsetLeft,
        width: currentTabElement.offsetWidth,
      });
    }
  }, [tab]);

  useEffect(() => {
    const timer = setInterval(() => setCount((v) => Math.min(v + 1, logs.length)), 1200);
    return () => clearInterval(timer);
  }, []);

  function stopTraining() {
    console.log("停止训练");
    alert("停止训练功能开发中...");
  }

  function startTraining() {
    console.log("启动/重试训练");
    alert("启动训练功能开发中...");
  }

  function saveConfig() {
    console.log("保存配置");
    alert("配置已保存（模拟）");
  }

  function uploadFiles() {
    console.log("上传训练/评测文件");
    alert("上传文件功能开发中...");
  }

  function syncToRemote() {
    console.log("同步到远程");
    alert("同步到远程功能开发中...");
  }

  function refreshDirectory() {
    console.log("刷新目录");
    alert("刷新目录功能开发中...");
  }

  function downloadLogs() {
    console.log("下载日志");
    alert("下载日志功能开发中...");
  }

  function loadTest() {
    console.log("加载测试");
    alert("加载测试功能开发中...");
  }

  function executeEval() {
    console.log("执行评测");
    alert("执行评测功能开发中...");
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
      <Breadcrumb page="subtask" setPage={setPage} task={{ name: task.name }} S={S} />
      <div style={{ borderBottom: "1px solid", borderColor: S.card.border.split(" ")[2], paddingBottom: 16, marginBottom: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ color: S.page.color, fontWeight: 700, fontSize: 18 }}>{task.name}</span>
              <Badge status={task.status} statusPalette={statusPalette} />
            </div>
            <div style={{ fontSize: 12, color: S.page.background === "#F8F9FA" ? "#9CA3AF" : "#6b7280", marginTop: 4, display: "flex", alignItems: "center", gap: 8 }}>
              <span>{task.id}</span>
              <span style={{ color: S.page.background === "#F8F9FA" ? "#D1D5DB" : "#4b5563" }}>|</span>
              <span>训练模型名：{task.modelName}</span>
              <span style={{ color: S.page.background === "#F8F9FA" ? "#D1D5DB" : "#4b5563" }}>|</span>
              <span>基模：{task.baseModel}</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Button secondary onClick={() => setPage("taskDetail")} S={S}>
              返回任务详情
            </Button>
            <Button secondary onClick={stopTraining} S={S}>停止训练</Button>
            <Button onClick={startTraining} S={S}>启动 / 重试</Button>
          </div>
        </div>

        {/* 统计信息 */}
        <div style={{ display: "flex", gap: 16, fontSize: 13, alignItems: "center", marginTop: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: "#10b981" }}></div>
            <span style={{ color: S.page.background === "#F8F9FA" ? "#6B7280" : "#9ca3af" }}>成功: {success}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: "#004EA2" }}></div>
            <span style={{ color: S.page.background === "#F8F9FA" ? "#6B7280" : "#9ca3af" }}>运行中: {running}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: "#ef4444" }}></div>
            <span style={{ color: S.page.background === "#F8F9FA" ? "#6B7280" : "#9ca3af" }}>失败: {failed}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ color: S.page.background === "#F8F9FA" ? "#6B7280" : "#9ca3af" }}>待处理: {pending}</span>
          </div>
          <div style={{ fontWeight: 600, color: S.page.color }}>总计: {task.subtasks.length}</div>

          {/* 当前子任务状态 */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: 16, paddingLeft: 16, borderLeft: "2px solid", borderColor: S.page.background === "#F8F9FA" ? "#E5E7EB" : "#374151" }}>
            <span style={{ color: S.page.background === "#F8F9FA" ? "#6B7280" : "#9ca3af" }}>当前子任务状态:</span>
            <Badge status={currentSubtask.status} statusPalette={statusPalette} />
          </div>
        </div>
      </div>
      {/* 滑动导航 - 拉通整个页面宽度 */}
      <div style={{ margin: "8px -24px 0 -24px", padding: "0 24px", background: S.page.background === "#0a0a0a" ? "#1a1a1a" : "#F3F4F6", borderTop: "1px solid", borderBottom: "1px solid", borderColor: S.page.background === "#0a0a0a" ? "#2a3a4a" : "#E5E7EB" }}>
        <div style={{ display: "flex", position: "relative" }}>
          {/* 滑动指示器 */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: indicatorStyle.left,
              width: indicatorStyle.width,
              height: "100%",
              background: S.page.background === "#0a0a0a" ? "#004EA2" : "#E0F2FE",
              transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
              zIndex: 0,
            }}
          />
          {tabs.map(([key, label]) => (
            <button
              key={key}
              ref={(el) => (tabRefs.current[key] = el)}
              onClick={() => setTab(key)}
              style={{
                border: 0,
                borderRadius: 0,
                padding: "12px 20px",
                cursor: "pointer",
                fontWeight: 600,
                fontSize: 14,
                background: "transparent",
                color: tab === key ? "#004EA2" : (S.page.background === "#0a0a0a" ? "#9ca3af" : "#64748b"),
                position: "relative",
                zIndex: 1,
                transition: "color 0.2s ease-out",
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div style={{ marginTop: 20 }}>
        {tab === "base" && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 16 }}>
              <Field label="微调训练任务模型名" value="customer_service_v1" onChange={() => {}} S={S} />
              <Field label="子任务名称" value="rank32_lr5e-5" onChange={() => {}} S={S} />
              <label>
                <div style={{ color: S.page.background === "#0a0a0a" ? "#9ca3af" : "#64748b", fontSize: 13, marginBottom: 6 }}>远程服务器</div>
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
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
              <Button onClick={saveConfig} S={S}>保存配置</Button>
            </div>
          </div>
        )}
        {tab === "dataset" && (
          <div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginBottom: 16 }}>
              <Button secondary onClick={uploadFiles} S={S}>上传训练/评测文件</Button>
              <Button onClick={syncToRemote} S={S}>同步到远程</Button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 16 }}>
              <Field label="训练集" value="qa_sft_train_202605" onChange={() => {}} S={S} />
              <Field label="评测集" value="qa_sft_eval_202605" onChange={() => {}} S={S} />
            </div>
            <pre style={{ marginTop: 16, padding: 16, background: S.page.background === "#0a0a0a" ? "#2d2d2d" : "#f8fafc", borderRadius: 16, overflow: "auto", color: S.page.color }}>{datasetInfo}</pre>
          </div>
        )}
        {tab === "params" && (
          <div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginBottom: 16 }}>
              <Button secondary onClick={() => setMode("visual")} S={S}>
                可视化
              </Button>
              <Button secondary onClick={() => setMode("yaml")} S={S}>
                YAML
              </Button>
            </div>
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
            <SectionTitle title="远程目录" actions={<Button secondary onClick={refreshDirectory} S={S}>刷新目录</Button>} S={S} />
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
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
              <Button secondary onClick={downloadLogs} S={S}>下载日志</Button>
            </div>
            <pre style={{ background: S.page.background === "#0a0a0a" ? "#0f172a" : "#0f172a", color: "#e2e8f0", borderRadius: 16, padding: 16, height: 430, overflow: "auto" }}>
              {logs.slice(0, count).map((line) => (
                <div key={line}>{line}</div>
              ))}
            </pre>
          </div>
        )}
        {tab === "eval" && (
          <div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginBottom: 16 }}>
              <Button secondary onClick={loadTest} S={S}>加载测试</Button>
              <Button onClick={executeEval} S={S}>执行评测</Button>
            </div>
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
