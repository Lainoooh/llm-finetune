import { useState } from "react";
import { Card } from "../components/Card";
import { SectionTitle } from "../components/SectionTitle";
import { Button } from "../components/Button";
import { Badge } from "../components/Badge";
import { Field } from "../components/Field";
import { Info } from "../components/Info";
import { statusText } from "../styles/themes";

export function ServersPage({ servers, setServers, S, statusPalette }) {
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [draft, setDraft] = useState({ name: "", user: "", password: "", host: "", workDir: "" });
  const [testing, setTesting] = useState(false);
  const selected = selectedId ? servers.find((s) => s.id === selectedId) : null;
  const isNew = !selectedId;

  function openNew() {
    setSelectedId(null);
    setDraft({ name: "", user: "", password: "", host: "", workDir: "" });
    setOpen(true);
  }

  function openEdit(id) {
    const server = servers.find((s) => s.id === id);
    if (!server) return;
    setSelectedId(server.id);
    setDraft({ name: server.name, user: server.user, password: server.password, host: server.host, workDir: server.workDir });
    setOpen(true);
  }

  function saveServer() {
    if (isNew) {
      // 新增服务器
      const newServer = {
        id: `srv-${Date.now()}`,
        ...draft,
        status: "online",
        gpu: "待检测",
        cuda: "待检测",
        torch: "待检测",
        llamafactory: "待检测",
        disk: "待检测",
      };
      setServers((list) => [...list, newServer]);
    } else {
      // 编辑服务器
      setServers((list) => list.map((s) => (s.id === selectedId ? { ...s, ...draft } : s)));
    }
    setOpen(false);
  }

  function deleteServer(id) {
    if (confirm("确定要删除这台服务器吗？")) {
      setServers((list) => list.filter((s) => s.id !== id));
    }
  }

  function testConnection() {
    setTesting(true);
    // 模拟连通性测试
    setTimeout(() => {
      setTesting(false);
      alert("连通性测试成功！环境信息已刷新。");
    }, 1500);
  }

  return (
    <div>
      <Card S={S}>
        <SectionTitle
          title="服务器列表"
          desc={`共 ${servers.length} 台服务器`}
          actions={
            <Button onClick={openNew} S={S}>新增服务器</Button>
          }
          S={S}
        />
        <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 16 }}>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>服务器名称</th>
                <th style={S.th}>连接地址</th>
                <th style={S.th}>状态</th>
                <th style={S.th}>GPU</th>
                <th style={S.th}>CUDA</th>
                <th style={S.th}>LLaMA-Factory</th>
                <th style={S.th}>磁盘</th>
                <th style={S.th}>操作</th>
              </tr>
            </thead>
            <tbody>
              {servers.map((s) => (
                <tr key={s.id}>
                  <td style={S.td}>
                    <b>{s.name}</b>
                  </td>
                  <td style={S.td}>
                    {s.user}@{s.host}
                  </td>
                  <td style={S.td}>
                    <Badge status={s.status} statusPalette={statusPalette} />
                  </td>
                  <td style={S.td}>{s.gpu}</td>
                  <td style={S.td}>{s.cuda}</td>
                  <td style={S.td}>{s.llamafactory}</td>
                  <td style={S.td}>{s.disk}</td>
                  <td style={S.td}>
                    <div style={{ display: "flex", gap: 8 }}>
                      <Button secondary onClick={() => openEdit(s.id)} S={S}>
                        编辑
                      </Button>
                      <Button secondary onClick={() => deleteServer(s.id)} S={S}>
                        删除
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ ...S.row, color: S.page.background === "#0a0a0a" ? "#9ca3af" : "#64748b", fontSize: 13, marginTop: 14 }}>
          <span>当前第 1 页，每页 10 条</span>
          <div style={{ display: "flex", gap: 8 }}>
            <Button secondary disabled S={S}>
              上一页
            </Button>
            <Button secondary disabled S={S}>
              下一页
            </Button>
          </div>
        </div>
      </Card>
      {open ? (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, zIndex: 50 }}>
          <div style={{ background: S.card.background, borderRadius: 24, padding: 24, width: "min(980px, 100%)", maxHeight: "90vh", overflow: "auto" }}>
            <div style={{ ...S.row, borderBottom: "1px solid", borderColor: S.card.border.split(" ")[2], paddingBottom: 16 }}>
              <div>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <b style={{ fontSize: 20, color: S.page.color }}>{isNew ? "新增服务器" : "编辑服务器"}</b>
                  {!isNew && <Badge status={selected.status} statusPalette={statusPalette} />}
                </div>
                <div style={{ color: S.page.background === "#0a0a0a" ? "#9ca3af" : "#64748b", marginTop: 6, fontSize: 13 }}>
                  {isNew ? "配置新服务器的连接信息" : "服务器连接信息与环境信息"}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <Button secondary onClick={() => setOpen(false)} S={S}>
                  取消
                </Button>
                <Button onClick={saveServer} S={S}>保存</Button>
              </div>
            </div>

            <SectionTitle title="连接配置" S={S} />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 16 }}>
              <Field label="服务器名称" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} S={S} />
              <Field label="连接账号" value={draft.user} onChange={(e) => setDraft({ ...draft, user: e.target.value })} S={S} />
              <Field label="连接地址" value={draft.host} onChange={(e) => setDraft({ ...draft, host: e.target.value })} S={S} />
              <Field label="连接密码" type="password" value={draft.password} onChange={(e) => setDraft({ ...draft, password: e.target.value })} S={S} />
              <Field label="工作目录" value={draft.workDir} onChange={(e) => setDraft({ ...draft, workDir: e.target.value })} S={S} />
            </div>
            <div style={{ marginTop: 16 }}>
              <Button secondary onClick={testConnection} disabled={testing} S={S}>
                {testing ? "测试中..." : "连通性测试"}
              </Button>
            </div>

            {!isNew && (
              <>
                <div style={{ borderTop: `1px solid ${S.card.border.split(" ")[2]}`, marginTop: 24, marginBottom: 24 }} />
                <SectionTitle title="环境信息" S={S} />
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 16 }}>
                  <Info label="GPU" value={selected.gpu} />
                  <Info label="CUDA" value={selected.cuda} />
                  <Info label="PyTorch" value={selected.torch} />
                  <Info label="LLaMA-Factory" value={selected.llamafactory} />
                  <Info label="磁盘" value={selected.disk} />
                  <Info label="状态" value={statusText[selected.status]} />
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
