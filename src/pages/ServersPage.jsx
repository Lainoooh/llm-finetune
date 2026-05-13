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

  return (
    <div>
      <Card S={S}>
        <SectionTitle
          title="服务器列表"
          desc={`共 ${servers.length} 台服务器`}
          actions={
            <>
              <Button secondary S={S}>导入服务器</Button>
              <Button S={S}>新增服务器</Button>
            </>
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
                      <Button secondary onClick={() => openDetail(s.id)} S={S}>
                        详情
                      </Button>
                      <Button secondary onClick={() => openDetail(s.id)} S={S}>
                        编辑
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ ...S.row, color: S.page.background === "#1a1a1a" ? "#9ca3af" : "#64748b", fontSize: 13, marginTop: 14 }}>
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
                  <b style={{ fontSize: 20, color: S.page.color }}>{selected.name}</b>
                  <Badge status={selected.status} statusPalette={statusPalette} />
                </div>
                <div style={{ color: S.page.background === "#1a1a1a" ? "#9ca3af" : "#64748b", marginTop: 6, fontSize: 13 }}>服务器连接信息与环境信息</div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <Button secondary onClick={() => setOpen(false)} S={S}>
                  取消
                </Button>
                <Button onClick={saveServer} S={S}>保存</Button>
              </div>
            </div>
            <SectionTitle title="可编辑连接配置" S={S} />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 16 }}>
              <Field label="连接账号" value={draft.user} onChange={(e) => setDraft({ ...draft, user: e.target.value })} S={S} />
              <Field label="连接密码" type="password" value={draft.password} onChange={(e) => setDraft({ ...draft, password: e.target.value })} S={S} />
              <Field label="连接地址" value={draft.host} onChange={(e) => setDraft({ ...draft, host: e.target.value })} S={S} />
              <Field label="工作目录" value={draft.workDir} onChange={(e) => setDraft({ ...draft, workDir: e.target.value })} S={S} />
            </div>
            <SectionTitle title="环境信息" S={S} />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 16 }}>
              <Info label="GPU" value={selected.gpu} />
              <Info label="CUDA" value={selected.cuda} />
              <Info label="PyTorch" value={selected.torch} />
              <Info label="LLaMA-Factory" value={selected.llamafactory} />
              <Info label="磁盘" value={selected.disk} />
              <Info label="状态" value={statusText[selected.status]} />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
