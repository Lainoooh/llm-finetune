import { useEffect, useState } from "react";
import { Stat } from "../components/Stat";
import { Card } from "../components/Card";
import { Button } from "../components/Button";
import { SectionTitle } from "../components/SectionTitle";
import { LossChart } from "../components/LossChart";
import { TaskTable } from "../components/TaskTable";
import { compareEval, compareReadiness, runCompare } from "../api/tasksApi";

export function ComparePage({ task, lossSeries, setPage, S, statusPalette }) {
  const [readiness, setReadiness] = useState({ ready: false, blockers: [] });
  const [evalItems, setEvalItems] = useState([]);

  useEffect(() => {
    if (!task?.taskCode && !task?.id) return;
    const code = task.taskCode || task.id;
    compareReadiness(code).then(setReadiness).catch(() => setReadiness({ ready: false, blockers: ["对比状态加载失败"] }));
    compareEval(code).then((data) => setEvalItems(data.items || [])).catch(() => setEvalItems([]));
  }, [task?.id, task?.taskCode]);

  async function exportReport() {
    const code = task.taskCode || task.id;
    window.open(`/api/tasks/${encodeURIComponent(code)}/compare/export`, "_blank");
  }

  async function executeCompare() {
    try {
      const result = await runCompare(task.taskCode || task.id);
      alert(`综合比较已完成：${result.compareCode}`);
    } catch (error) {
      alert(`综合比较失败：${error.message}`);
    }
  }

  const success = (task.subtasks || []).filter((s) => s.status === "succeeded").length;
  const running = (task.subtasks || []).filter((s) => s.status === "running").length;

  return (
    <div>
      {!readiness.ready ? (
        <div style={{ border: "1px solid #fde68a", background: "#fffbeb", color: "#b45309", borderRadius: 8, padding: 14, marginBottom: 16 }}>
          当前不满足比较条件：{readiness.blockers?.join("；") || `仍有 ${running} 个子任务在训练中`}
        </div>
      ) : null}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 16 }}>
        <Stat title="子任务数量" value={task.subtasks?.length || 0} desc="统一模型名" S={S} />
        <Stat title="成功完成" value={success} desc="可评测导出" S={S} />
        <Stat title="比较状态" value={readiness.ready ? "可执行" : "等待"} desc="全部完成后执行" S={S} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 16, marginTop: 20 }}>
        <Card S={S}>
          <SectionTitle title="Train Loss 对比" S={S} />
          <LossChart series={lossSeries} />
        </Card>
        <Card S={S}>
          <SectionTitle title="评测结果对比" S={S} />
          <div>
            {evalItems.map((item) => (
              <div key={item.subtaskCode} style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: S.page.color }}>
                  <span>{item.name}</span>
                  <span>{item.score ?? "待评测"}</span>
                </div>
                <div style={{ height: 10, background: "#e2e8f0", borderRadius: 999 }}>
                  <div style={{ width: `${Math.min(Number(item.score || 0), 100)}%`, height: "100%", background: "#0f172a", borderRadius: 999 }} />
                </div>
              </div>
            ))}
            {evalItems.length === 0 ? <div style={{ color: "#64748b" }}>暂无评测结果</div> : null}
          </div>
        </Card>
      </div>
      <Card style={{ marginTop: 20 }} S={S}>
        <SectionTitle title="参数与结果汇总" actions={<><Button secondary onClick={exportReport} S={S}>导出报告</Button><Button disabled={!readiness.ready} onClick={executeCompare} S={S}>执行综合比较</Button></>} S={S} />
        <TaskTable subtasks={task.subtasks || []} onClone={() => {}} onConfig={() => setPage("subtask")} onDelete={() => {}} S={S} statusPalette={statusPalette} />
      </Card>
    </div>
  );
}
