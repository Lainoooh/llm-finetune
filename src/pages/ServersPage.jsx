import { useState } from "react";
import { Card } from "../components/Card";
import { SectionTitle } from "../components/SectionTitle";
import { Button } from "../components/Button";
import { Badge } from "../components/Badge";
import { Field } from "../components/Field";
import { Info } from "../components/Info";
import { S, statusText } from "../styles/styles";

export function ServersPage({ servers, setServers }) {
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
      <Card>
        <SectionTitle
          title="服务器列表"
          desc={`共 ${servers.length} 台服务器`}
          actions={
            <>
              <Button secondary>导入服务器</Button>
              <Button>新增服务器</Button>
            </>
          }
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
                    <Badge status={s.status} />
                  </td>
                  <td style={S.td}>{s.gpu}</td>
                  <td style={S.td}>{s.cuda}</td>
                  <td style={S.td}>{s.llamafactory}</td>
                  <td style={S.td}>{s.disk}</td>
                  <td style={S.td}>
                    <div style={{ display: "flex", gap: 8 }}>
                      <Button secondary onClick={() => openDetail(s.id)}>
                        详情
                      </Button>
                      <Button secondary onClick={() => openDetail(s.id)}>
                        编辑
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ ...S.row, color: "#64748b", fontSize: 13, marginTop: 14 }}>
          <span>当前第 1 页，每页 10 条</span>
          <div style={{ display: "flex", gap: 8 }}>
            <Button secondary disabled>
              上一页
            </Button>
            <Button secondary disabled>
              下一页
            </Button>
          </div>
        </div>
      </Card>
      {open ? (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, zIndex: 50 }}>
          <div style={{ background: "#fff", borderRadius: 24, padding: 24, width: "min(980px, 100%)", maxHeight: "90vh", overflow: "auto" }}>
            <div style={{ ...S.row, borderBottom: "1px solid #e2e8f0", paddingBottom: 16 }}>
              <div>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <b style={{ fontSize: 20 }}>{selected.name}</b>
                  <Badge status={selected.status} />
                </div>
                <div style={{ color: "#64748b", marginTop: 6, fontSize: 13 }}>服务器连接信息与环境信息</div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <Button secondary onClick={() => setOpen(false)}>
                  取消
                </Button>
                <Button onClick={saveServer}>保存</Button>
              </div>
            </div>
            <SectionTitle title="可编辑连接配置" />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 16 }}>
              <Field label="连接账号" value={draft.user} onChange={(e) => setDraft({ ...draft, user: e.target.value })} />
              <Field label="连接密码" type="password" value={draft.password} onChange={(e) => setDraft({ ...draft, password: e.target.value })} />
              <Field label="连接地址" value={draft.host} onChange={(e) => setDraft({ ...draft, host: e.target.value })} />
              <Field label="工作目录" value={draft.workDir} onChange={(e) => setDraft({ ...draft, workDir: e.target.value })} />
            </div>
            <SectionTitle title="环境信息" />
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
