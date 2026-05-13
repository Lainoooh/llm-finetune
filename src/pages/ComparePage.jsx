import { Stat } from "../components/Stat";
import { Card } from "../components/Card";
import { Button } from "../components/Button";
import { SectionTitle } from "../components/SectionTitle";
import { LossChart } from "../components/LossChart";
import { TaskTable } from "../components/TaskTable";

export function ComparePage({ task, setPage }) {
  const allDone = task.subtasks.every((s) => ["succeeded", "failed"].includes(s.status));
  const success = task.subtasks.filter((s) => s.status === "succeeded").length;
  const running = task.subtasks.filter((s) => s.status === "running").length;

  return (
    <div>
      {!allDone ? (
        <div style={{ border: "1px solid #fde68a", background: "#fffbeb", color: "#b45309", borderRadius: 16, padding: 14, marginBottom: 16 }}>
          当前不满足比较条件：仍有 {running} 个子任务在训练中。
        </div>
      ) : null}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 16 }}>
        <Stat title="子任务数量" value={task.subtasks.length} desc="统一模型名" />
        <Stat title="成功完成" value={success} desc="可评测导出" />
        <Stat title="比较状态" value={allDone ? "可执行" : "等待"} desc="全部完成后执行" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 16, marginTop: 20 }}>
        <Card>
          <SectionTitle title="Train Loss 对比" />
          <LossChart />
        </Card>
        <Card>
          <SectionTitle title="评测结果对比" />
          <div>
            {[76.2, 80.1, 73.6].map((x, i) => (
              <div key={i} style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                  <span>task_00{i + 1}</span>
                  <span>{x}</span>
                </div>
                <div style={{ height: 10, background: "#e2e8f0", borderRadius: 999 }}>
                  <div style={{ width: `${x}%`, height: "100%", background: "#0f172a", borderRadius: 999 }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
      <Card style={{ marginTop: 20 }}>
        <SectionTitle
          title="参数与结果汇总"
          actions={
            <>
              <Button secondary>导出报告</Button>
              <Button disabled={!allDone}>执行综合比较</Button>
            </>
          }
        />
        <TaskTable subtasks={task.subtasks} onClone={() => {}} onConfig={() => setPage("subtask")} />
      </Card>
    </div>
  );
}
