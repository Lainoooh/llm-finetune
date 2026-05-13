export function TaskTable({ subtasks, onClone, onConfig, S, statusPalette }) {
  return (
    <div style={{ marginTop: 20, overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 16 }}>
      <table style={{ ...S.table, minWidth: 1180 }}>
        <thead>
          <tr>
            <th style={S.th}>子任务</th>
            <th style={S.th}>状态</th>
            <th style={S.th}>服务器</th>
            <th style={S.th}>GPU</th>
            <th style={S.th}>训练参数</th>
            <th style={S.th}>训练/评测结果</th>
            <th style={S.th}>操作</th>
          </tr>
        </thead>
        <tbody>
          {subtasks.map((s) => (
            <tr key={s.id}>
              <td style={S.td}>
                <button onClick={onConfig} style={{ border: 0, background: "transparent", fontWeight: 800, cursor: "pointer", color: S.page.color }}>
                  {s.id}
                </button>
                <div>
                  <button onClick={onConfig} style={{ border: 0, background: "transparent", color: S.page.background === "#0a0a0a" ? "#9ca3af" : "#64748b", cursor: "pointer", fontSize: 12 }}>
                    {s.name}
                  </button>
                </div>
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
                <div style={{ display: "flex", gap: 6 }}>
                  <Metric label="LR" value={s.learningRate} />
                  <Metric label="EP" value={s.epoch} />
                  <Metric label="BS" value={s.batchSize} />
                  <Metric label="ST" value={s.step} />
                </div>
              </td>
              <td style={S.td}>
                <div style={{ display: "flex", gap: 6 }}>
                  <Metric label="LOSS" value={s.loss} />
                  <Metric label="EVAL" value={s.score ?? "待评测"} />
                </div>
              </td>
              <td style={S.td}>
                <div style={{ display: "flex", gap: 8 }}>
                  <Button secondary onClick={() => onClone(s)} S={S}>
                    复制
                  </Button>
                  <Button secondary onClick={onConfig} S={S}>
                    配置
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
