import { useState } from "react";
import { Card } from "../components/Card";
import { SectionTitle } from "../components/SectionTitle";
import { Button } from "../components/Button";
import { Badge } from "../components/Badge";
import { Field } from "../components/Field";
import { Info } from "../components/Info";
import { ConfirmDialog } from "../components/ConfirmDialog";
import Spinner from "../components/Spinner";
import { FilterBar } from "../components/FilterBar";
import { Pagination } from "../components/Pagination";
import { statusText } from "../styles/themes";

export function ServersPage({ servers, setServers, S, statusPalette }) {
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [draft, setDraft] = useState({ name: "", user: "", password: "", host: "", workDir: "", gpuIds: "", finetuneToolName: "LLaMA-Factory" });
  const [envInfo, setEnvInfo] = useState({ gpu: "", cuda: "", torch: "", finetuneTools: {}, disk: "", status: "" });
  const [testing, setTesting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, server: null });
  const [testingServers, setTestingServers] = useState(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const pageSize = 10;
  const selected = selectedId ? servers.find((s) => s.id === selectedId) : null;
  const isNew = !selectedId;

  // 搜索和筛选
  const filteredServers = servers.filter(server => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = (
      server.name.toLowerCase().includes(searchLower) ||
      server.host.toLowerCase().includes(searchLower)
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

  const availableTools = ["LLaMA-Factory"]; // 当前支持的微调工具列表

  function openNew() {
    setSelectedId(null);
    setDraft({ name: "", user: "", password: "", host: "", workDir: "", gpuIds: "", finetuneToolName: "LLaMA-Factory" });
    setEnvInfo({ gpu: "", cuda: "", torch: "", finetuneTools: {}, disk: "", status: "" });
    setOpen(true);
  }

  function openEdit(id) {
    const server = servers.find((s) => s.id === id);
    if (!server) return;
    setSelectedId(server.id);
    setDraft({
      name: server.name,
      user: server.user,
      password: server.password,
      host: server.host,
      workDir: server.workDir,
      gpuIds: server.gpuIds || "",
      finetuneToolName: server.finetuneToolName || "LLaMA-Factory"
    });
    setEnvInfo({ gpu: server.gpu, cuda: server.cuda, torch: server.torch, finetuneTools: server.finetuneTools || {}, disk: server.disk, status: server.status });
    setOpen(true);
  }

  function saveServer() {
    if (isNew) {
      // 新增服务器
      const newServer = {
        id: `srv-${Date.now()}`,
        ...draft,
        ...envInfo,
      };
      setServers((list) => [...list, newServer]);
    } else {
      // 编辑服务器
      setServers((list) => list.map((s) => (s.id === selectedId ? { ...s, ...draft, ...envInfo } : s)));
    }
    setOpen(false);
  }

  function deleteServer(id) {
    const server = servers.find((s) => s.id === id);
    setDeleteConfirm({ open: true, server });
  }

  function confirmDelete() {
    setServers((list) => list.filter((s) => s.id !== deleteConfirm.server.id));
    setDeleteConfirm({ open: false, server: null });
  }

  function testConnection() {
    setTesting(true);
    // 模拟连通性测试，30秒超时
    const timer = setTimeout(() => {
      // 模拟成功/失败（这里随机模拟，实际应该是真实的连接测试）
      const success = Math.random() > 0.3; // 70% 成功率
      if (success) {
        setEnvInfo({
          gpu: "4 × NVIDIA A100 80GB",
          cuda: "12.1",
          torch: "2.4.0+cu121",
          finetuneTools: {
            [draft.finetuneToolName]: "0.9.2.dev0"
          },
          disk: "3.8TB / 7.0TB",
          status: "online",
        });
      } else {
        // 失败时设置为断线状态
        setEnvInfo({
          gpu: "-",
          cuda: "-",
          torch: "-",
          finetuneTools: {},
          disk: "-",
          status: "offline",
        });
      }
      setTesting(false);
    }, 30000); // 30秒超时
  }

  function testServerConnection(serverId) {
    setTestingServers(prev => new Set(prev).add(serverId));
    // 模拟连通性测试，刷新所有环境信息
    setTimeout(() => {
      const success = Math.random() > 0.3; // 70% 成功率
      setServers(list => list.map(s => {
        if (s.id === serverId) {
          if (success) {
            // 成功：更新所有环境信息
            return {
              ...s,
              gpu: "4 × NVIDIA A100 80GB",
              cuda: "12.1",
              torch: "2.4.0+cu121",
              finetuneTools: {
                [s.finetuneToolName || "LLaMA-Factory"]: "0.9.2.dev0"
              },
              disk: "3.8TB / 7.0TB",
              status: "online",
            };
          } else {
            // 失败：设置为离线状态，清空环境信息
            return {
              ...s,
              gpu: "-",
              cuda: "-",
              torch: "-",
              finetuneTools: {},
              disk: "-",
              status: "offline",
            };
          }
        }
        return s;
      }));
      setTestingServers(prev => {
        const next = new Set(prev);
        next.delete(serverId);
        return next;
      });
    }, 2000);
  }

  function batchTestConnection() {
    currentServers.forEach(server => {
      testServerConnection(server.id);
    });
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
                <th style={S.th}>服务器名称</th>
                <th style={S.th}>连接地址</th>
                <th style={S.th}>运行显卡</th>
                <th style={S.th}>状态</th>
                <th style={S.th}>GPU</th>
                <th style={S.th}>CUDA</th>
                <th style={S.th}>微调工具</th>
                <th style={S.th}>磁盘</th>
                <th style={S.th}>操作</th>
              </tr>
            </thead>
            <tbody>
              {currentServers.map((s) => (
                <tr key={s.id}>
                  <td style={S.td}>
                    <b>{s.name}</b>
                  </td>
                  <td style={S.td}>
                    {s.host}
                  </td>
                  <td style={S.td}>{s.gpuIds || "-"}</td>
                  <td style={S.td}>
                    {testingServers.has(s.id) ? <Spinner size="small" /> : <Badge status={s.status} statusPalette={statusPalette} />}
                  </td>
                  <td style={S.td}>
                    {testingServers.has(s.id) ? <Spinner size="small" /> : (s.gpu?.replace(/NVIDIA\s*/g, '').replace(/\s*×\s*/g, '×') || "-")}
                  </td>
                  <td style={S.td}>
                    {testingServers.has(s.id) ? <Spinner size="small" /> : (s.cuda || "-")}
                  </td>
                  <td style={S.td}>
                    {testingServers.has(s.id) ? (
                      <Spinner size="small" />
                    ) : (
                      s.finetuneToolName && s.finetuneTools && s.finetuneTools[s.finetuneToolName]
                        ? `${s.finetuneToolName} ${s.finetuneTools[s.finetuneToolName]}`
                        : "-"
                    )}
                  </td>
                  <td style={S.td}>
                    {testingServers.has(s.id) ? (
                      <Spinner size="small" />
                    ) : (
                      (() => {
                        const match = s.disk.match(/^([\d.]+)TB\s*\/\s*([\d.]+)TB$/);
                        if (!match) return s.disk;
                        const used = parseFloat(match[1]);
                        const total = parseFloat(match[2]);
                        const percent = Math.round((used / total) * 100);
                        const color = percent > 80 ? "#ef4444" : percent > 60 ? "#f59e0b" : "#10b981";
                        return (
                          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            <div style={{ fontSize: 12, color: S.page.background === "#0a0a0a" ? "#9ca3af" : "#64748b" }}>
                              {s.disk} ({percent}%)
                            </div>
                            <div style={{ width: "100%", height: 6, background: S.page.background === "#0a0a0a" ? "#2d2d2d" : "#e5e7eb", borderRadius: 3, overflow: "hidden" }}>
                              <div style={{ width: `${percent}%`, height: "100%", background: color, transition: "width 0.3s" }} />
                            </div>
                          </div>
                        );
                      })()
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
              ))}
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
                <Button secondary onClick={testConnection} disabled={testing} S={S}>
                  {testing ? "测试中..." : "连通性测试"}
                </Button>
                <Button onClick={saveServer} S={S}>保存</Button>
              </div>
            </div>

            <SectionTitle title="连接配置" S={S} />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 16 }}>
              <Field label="服务器名称" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} S={S} />
              <Field label="运行显卡" value={draft.gpuIds} onChange={(e) => setDraft({ ...draft, gpuIds: e.target.value })} placeholder="例如: 0,1,2,3" S={S} />
              <Field label="连接账号" value={draft.user} onChange={(e) => setDraft({ ...draft, user: e.target.value })} S={S} />
              <Field label="连接地址" value={draft.host} onChange={(e) => setDraft({ ...draft, host: e.target.value })} S={S} />
              <Field label="连接密码" type="password" value={draft.password} onChange={(e) => setDraft({ ...draft, password: e.target.value })} S={S} />
              <Field label="工作目录" value={draft.workDir} onChange={(e) => setDraft({ ...draft, workDir: e.target.value })} S={S} />
            </div>

            {/* 微调工具选择 */}
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: S.page.color, marginBottom: 8 }}>微调工具</div>
              <div style={{ display: "flex", gap: 8 }}>
                {availableTools.map((tool) => (
                  <button
                    key={tool}
                    onClick={() => setDraft({ ...draft, finetuneToolName: tool })}
                    style={{
                      padding: "8px 16px",
                      border: draft.finetuneToolName === tool ? "1px solid #667eea" : `1px solid ${S.card.border.split(" ")[2]}`,
                      borderRadius: 8,
                      background: draft.finetuneToolName === tool ? (S.page.background === "#0a0a0a" ? "#667eea20" : "#667eea10") : "transparent",
                      color: draft.finetuneToolName === tool ? "#667eea" : S.page.color,
                      fontSize: 14,
                      fontWeight: draft.finetuneToolName === tool ? 600 : 400,
                      cursor: "pointer",
                      transition: "all 0.2s"
                    }}
                    onMouseEnter={(e) => {
                      if (draft.finetuneToolName !== tool) {
                        e.currentTarget.style.background = S.page.background === "#0a0a0a" ? "#2d2d2d" : "#f1f5f9";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (draft.finetuneToolName !== tool) {
                        e.currentTarget.style.background = "transparent";
                      }
                    }}
                  >
                    {tool}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ borderTop: `1px solid ${S.card.border.split(" ")[2]}`, marginTop: 24, marginBottom: 24 }} />
            <SectionTitle title="环境信息" S={S} />

            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 16 }}>
              <Info label="GPU" value={testing ? <Spinner size="small" /> : (envInfo.gpu || "-")} />
              <Info label="CUDA" value={testing ? <Spinner size="small" /> : (envInfo.cuda || "-")} />
              <Info label="PyTorch" value={testing ? <Spinner size="small" /> : (envInfo.torch || "-")} />
              <Info label="微调工具版本" value={testing ? <Spinner size="small" /> : (envInfo.finetuneTools[draft.finetuneToolName] || "-")} />
              <Info label="磁盘" value={testing ? <Spinner size="small" /> : (envInfo.disk || "-")} />
              <Info label="状态" value={testing ? <Spinner size="small" /> : (envInfo.status ? <Badge status={envInfo.status} statusPalette={statusPalette} /> : "-")} />
            </div>
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
