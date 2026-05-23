import { useEffect, useState } from "react";
import { Card } from "../components/Card";
import { SectionTitle } from "../components/SectionTitle";
import { Button } from "../components/Button";
import { Field } from "../components/Field";
import { createScript, listScripts, renderScript, testScript } from "../api/scriptsApi";

export function ScriptsPage({ servers, S }) {
  const [scripts, setScripts] = useState([]);
  const [selectedKey, setSelectedKey] = useState("");
  const [rendered, setRendered] = useState("");
  const [testOutput, setTestOutput] = useState("");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({
    key: "",
    name: "",
    category: "custom",
    template: "echo hello",
    paramSchema: { properties: {} },
    timeoutMs: 120000,
    riskLevel: "medium",
  });

  async function load() {
    const data = await listScripts();
    setScripts(data || []);
    if (!selectedKey && data?.length) setSelectedKey(data[0].key);
  }

  useEffect(() => {
    load().catch((error) => setTestOutput(error.message));
  }, []);

  async function handleRender(key = selectedKey) {
    try {
      const data = await renderScript(key, { work_dir: "/home/jovyan/work", gpu_ids: "0" });
      setRendered(data.rendered);
    } catch (error) {
      setRendered(`渲染失败：${error.message}`);
    }
  }

  async function handleTest(key = selectedKey) {
    try {
      const data = await testScript(key, { serverId: servers[0]?.id || "", params: { work_dir: "/home/jovyan/work", gpu_ids: "0" } });
      setTestOutput(`${data.runCode} ${data.status}\n${data.stdout || ""}`);
    } catch (error) {
      setTestOutput(`测试执行失败：${error.message}`);
    }
  }

  async function saveScript() {
    try {
      await createScript(draft);
      setOpen(false);
      await load();
    } catch (error) {
      alert(`保存脚本失败：${error.message}`);
    }
  }

  return (
    <Card S={S}>
      <SectionTitle title="脚本配置" desc="远程命令模板可视化配置、渲染和测试执行" actions={<Button onClick={() => setOpen(true)} S={S}>新建脚本</Button>} S={S} />
      <div style={{ display: "grid", gridTemplateColumns: "minmax(360px, 1fr) minmax(420px, 1.2fr)", gap: 16 }}>
        <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 6 }}>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>Key</th>
                <th style={S.th}>名称</th>
                <th style={S.th}>分类</th>
                <th style={S.th}>状态</th>
                <th style={S.th}>操作</th>
              </tr>
            </thead>
            <tbody>
              {scripts.map((item) => (
                <tr key={`${item.key}-${item.version}`}>
                  <td style={S.td}>{item.key}</td>
                  <td style={S.td}>{item.name}</td>
                  <td style={S.td}>{item.category}</td>
                  <td style={S.td}>{item.status}</td>
                  <td style={S.td}>
                    <div style={{ display: "flex", gap: 8 }}>
                      <Button secondary onClick={() => { setSelectedKey(item.key); handleRender(item.key); }} S={S}>渲染</Button>
                      <Button secondary onClick={() => { setSelectedKey(item.key); handleTest(item.key); }} S={S}>测试</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ display: "grid", gap: 12 }}>
          <div>
            <b style={{ color: S.page.color }}>渲染结果</b>
            <pre style={{ background: "#0f172a", color: "#e2e8f0", padding: 16, borderRadius: 8, minHeight: 220, overflow: "auto" }}>{rendered || "选择脚本后点击渲染"}</pre>
          </div>
          <div>
            <b style={{ color: S.page.color }}>测试输出</b>
            <pre style={{ background: "#0f172a", color: "#e2e8f0", padding: 16, borderRadius: 8, minHeight: 160, overflow: "auto" }}>{testOutput || "选择脚本后点击测试"}</pre>
          </div>
        </div>
      </div>

      {open ? (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, zIndex: 50 }}>
          <div style={{ background: S.card.background, borderRadius: 8, padding: 24, width: "min(760px, 100%)" }}>
            <SectionTitle title="新建脚本" actions={<><Button secondary onClick={() => setOpen(false)} S={S}>取消</Button><Button onClick={saveScript} disabled={!draft.key || !draft.name} S={S}>保存</Button></>} S={S} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="脚本 Key" value={draft.key} onChange={(e) => setDraft({ ...draft, key: e.target.value })} S={S} />
              <Field label="名称" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} S={S} />
              <Field label="分类" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} S={S} />
              <Field label="风险等级" value={draft.riskLevel} onChange={(e) => setDraft({ ...draft, riskLevel: e.target.value })} S={S} />
            </div>
            <div style={{ marginTop: 12 }}>
              <div style={{ color: "#64748b", fontSize: 13, marginBottom: 6 }}>脚本模板</div>
              <textarea value={draft.template} onChange={(e) => setDraft({ ...draft, template: e.target.value })} style={{ ...S.input, minHeight: 180, fontFamily: "monospace" }} />
            </div>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
