export function TaskListPage({ task, setPage, S, statusPalette }) {
  const rows = [
    {
      id: task.id,
      name: task.name,
      modelName: task.modelName,
      status: task.status,
      baseModel: "Qwen/Qwen3-8B",
      subtaskCount: task.subtasks.length,
      runningCount: task.subtasks.filter((s) => s.status === "running").length,
    },
    { id: "bt-002", name: "risk_signal_v2", modelName: "risk_signal_v2", status: "draft", baseModel: "Qwen/Qwen3-14B", subtaskCount: 0, runningCount: 0 },
    { id: "bt-003", name: "inquiry_generation_abtest", modelName: "inquiry_generation_abtest", status: "succeeded", baseModel: "Qwen/Qwen3-8B", subtaskCount: 4, runningCount: 0 },
  ];

  return (
    <Card S={S}>
      <SectionTitle
        title="任务列表"
        desc={`共 ${rows.length} 个微调训练任务`}
        actions={
          <>
            <Button secondary S={S}>导入任务</Button>
            <Button S={S}>新建微调训练任务</Button>
          </>
        }
        S={S}
      />
      <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 16 }}>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>任务名</th>
              <th style={S.th}>状态</th>
              <th style={S.th}>模型名</th>
              <th style={S.th}>基模</th>
              <th style={S.th}>子任务</th>
              <th style={S.th}>操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td style={S.td}>
                  <button onClick={() => setPage("taskDetail")} style={{ border: 0, background: "transparent", fontWeight: 800, cursor: "pointer", color: S.page.color }}>
                    {r.name}
                  </button>
                  <div style={{ color: S.page.background === "#0a0a0a" ? "#6b7280" : "#94a3b8", fontSize: 12 }}>{r.id}</div>
                </td>
                <td style={S.td}>
                  <Badge status={r.status} statusPalette={statusPalette} />
                </td>
                <td style={S.td}>{r.modelName}</td>
                <td style={S.td}>{r.baseModel}</td>
                <td style={S.td}>
                  总数 {r.subtaskCount} / 训练中 {r.runningCount}
                </td>
                <td style={S.td}>
                  <div style={{ display: "flex", gap: 8 }}>
                    <Button secondary onClick={() => setPage("taskDetail")} S={S}>
                      详情
                    </Button>
                    <Button secondary S={S}>复制</Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
