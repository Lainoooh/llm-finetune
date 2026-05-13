import { Stat } from "../components/Stat";
import { Card } from "../components/Card";
import { SectionTitle } from "../components/SectionTitle";
import { Button } from "../components/Button";
import { LossChart } from "../components/LossChart";

export function Dashboard({ servers, task, setPage }) {
  const running = task.subtasks.filter((x) => x.status === "running").length;
  const failed = task.subtasks.filter((x) => x.status === "failed").length;

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 16 }}>
        <Stat title="远程服务器" value={servers.length} desc="服务器数量" />
        <Stat title="子任务总数" value={task.subtasks.length} desc="并行训练" />
        <Stat title="训练中" value={running} desc="正在执行" />
        <Stat title="失败任务" value={failed} desc="手动重试" />
      </div>
      <Card style={{ marginTop: 20 }}>
        <SectionTitle title="训练 Loss 趋势" actions={<Button secondary onClick={() => setPage("compare")}>查看对比</Button>} />
        <LossChart />
      </Card>
    </>
  );
}
