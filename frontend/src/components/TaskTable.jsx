import { Badge } from "./Badge";
import { Button } from "./Button";
import { Metric } from "./Metric";

export function TaskTable({ subtasks, onClone, onConfig, onDelete, S, statusPalette }) {
  return (
    <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 6 }}>
      <table style={{ ...S.table, minWidth: 1000 }}>
        <thead>
          <tr>
            <th style={S.th}>子任务</th>
            <th style={S.th}>基模</th>
            <th style={S.th}>状态</th>
            <th style={S.th}>服务器</th>
            <th style={S.th}>GPU</th>
            <th style={S.th}>训练参数</th>
            <th style={S.th}>训练/评测结果</th>
            <th style={S.th}>操作</th>
          </tr>
        </thead>
        <tbody>
          {subtasks.map((s) => {
            const displayId = s.subtaskCode || s.id;
            return (
            <tr key={displayId}>
              <td style={S.td}>
                <button onClick={() => onConfig(s)} style={{ border: 0, background: "transparent", fontWeight: 800, cursor: "pointer", color: S.page.color, whiteSpace: "nowrap", display: "block", padding: 0, textAlign: "left" }}>
                  {s.name}
                </button>
                <button onClick={() => onConfig(s)} style={{ border: 0, background: "transparent", color: S.page.background === "#0a0a0a" ? "#9ca3af" : "#64748b", cursor: "pointer", fontSize: 12, whiteSpace: "nowrap", display: "block", marginTop: 2, padding: 0, textAlign: "left", fontFamily: "monospace" }}>
                  {displayId}
                </button>
              </td>
              <td style={S.td}>
                <span style={{ fontSize: 13, color: S.page.color, wordBreak: "break-all" }}>{s.baseModel || "-"}</span>
              </td>
              <td style={S.td}>
                <Badge status={s.status} statusPalette={statusPalette} />
              </td>
              <td style={S.td}>
                <Metric label="SVR" value={s.serverName} wide />
              </td>
              <td style={S.td}>
                <Metric label="GPU" value={s.gpu} />
              </td>
              <td style={S.td}>
                <div style={{ display: "flex", gap: 4 }}>
                  <Metric label="LR" value={s.learningRate} />
                  <Metric label="EP" value={s.epoch} />
                  <Metric label="BS" value={s.batchSize} />
                  <Metric label="ST" value={s.step} />
                </div>
              </td>
              <td style={S.td}>
                <div style={{ display: "flex", gap: 4 }}>
                  <Metric label="LOSS" value={s.loss} />
                  <Metric label="EVAL" value={s.score ?? "待评测"} />
                </div>
              </td>
              <td style={S.td}>
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    onClick={() => onClone(s)}
                    style={{
                      border: 0,
                      background: "transparent",
                      cursor: "pointer",
                      padding: 6,
                      borderRadius: 4,
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
                    title="复制子任务"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                  </button>
                  <button
                    onClick={() => onConfig(s)}
                    style={{
                      border: 0,
                      background: "transparent",
                      cursor: "pointer",
                      padding: 6,
                      borderRadius: 4,
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
                    title="编辑配置"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => onDelete(s)}
                    style={{
                      border: 0,
                      background: "transparent",
                      cursor: "pointer",
                      padding: 6,
                      borderRadius: 4,
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
                    title="删除子任务"
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
  );
}
