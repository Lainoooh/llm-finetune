import { useState, useRef, useEffect } from "react";
import { Card } from "../components/Card";
import { Button } from "../components/Button";
import { Badge } from "../components/Badge";
import { Metric } from "../components/Metric";
import { Info } from "../components/Info";
import { TaskTable } from "../components/TaskTable";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Breadcrumb } from "../layouts/Breadcrumb";
import { Pagination } from "../components/Pagination";

export function TaskDetailPage({ task, setTask, setPage, S, statusPalette }) {
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, subtask: null });
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("all");
  const [openStatusDropdown, setOpenStatusDropdown] = useState(false);
  const pageSize = 10;
  const dropdownRef = useRef(null);

  // 点击外部关闭下拉菜单
  useEffect(() => {
    function handleClickOutside(event) {
      if (openStatusDropdown && dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpenStatusDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openStatusDropdown]);

  // 搜索和筛选
  const filteredSubtasks = task.subtasks.filter(subtask => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = (
      subtask.id.toLowerCase().includes(searchLower) ||
      subtask.name.toLowerCase().includes(searchLower) ||
      subtask.serverName.toLowerCase().includes(searchLower) ||
      subtask.gpu.toLowerCase().includes(searchLower)
    );
    const matchesStatus = statusFilter === "all" || subtask.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // 分页逻辑
  const totalPages = Math.ceil(filteredSubtasks.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const currentSubtasks = filteredSubtasks.slice(startIndex, startIndex + pageSize);

  // 搜索处理
  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  // 状态筛选处理
  const handleStatusFilter = (status) => {
    setStatusFilter(status);
    setCurrentPage(1);
    setOpenStatusDropdown(false);
  };

  // 统计各状态数量
  const statusCounts = {
    all: task.subtasks.length,
    running: task.subtasks.filter(s => s.status === "running").length,
    succeeded: task.subtasks.filter(s => s.status === "succeeded").length,
    failed: task.subtasks.filter(s => s.status === "failed").length,
    draft: task.subtasks.filter(s => s.status === "draft").length,
  };

  const statusOptions = [
    { key: 'all', label: '全部', count: statusCounts.all },
    { key: 'running', label: '运行中', count: statusCounts.running },
    { key: 'succeeded', label: '已完成', count: statusCounts.succeeded },
    { key: 'failed', label: '失败', count: statusCounts.failed },
    { key: 'draft', label: '草稿', count: statusCounts.draft },
  ];

  function cloneTask(sub) {
    const next = `task_${String(task.subtasks.length + 1).padStart(3, "0")}`;
    setTask({ ...task, subtasks: [...task.subtasks, { ...sub, id: next, name: `${sub.name}_copy`, status: "draft", score: null }] });
  }

  function deleteSubtask(sub) {
    setDeleteConfirm({ open: true, subtask: sub });
  }

  function confirmDelete() {
    setTask({ ...task, subtasks: task.subtasks.filter((s) => s.id !== deleteConfirm.subtask.id) });
    setDeleteConfirm({ open: false, subtask: null });
  }

  function startAll() {
    setTask({ ...task, status: "running", subtasks: task.subtasks.map((s) => (["draft", "failed"].includes(s.status) ? { ...s, status: "running" } : s)) });
  }

  function createNewSubtask() {
    const next = `task_${String(task.subtasks.length + 1).padStart(3, "0")}`;
    const newSubtask = {
      id: next,
      name: `new_subtask_${task.subtasks.length + 1}`,
      serverName: "A100-训练机-01",
      status: "draft",
      gpu: "0,1",
      learningRate: "5e-5",
      epoch: 3,
      batchSize: 2,
      step: 500,
      loss: null,
      score: null,
      outputDir: `/workspace/finetune-platform/outputs/${task.name}/${next}`,
    };
    setTask({ ...task, subtasks: [...task.subtasks, newSubtask] });
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Card S={S} style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <Breadcrumb page="taskDetail" setPage={setPage} task={task} S={S} />

      {/* 顶部信息区域 */}
      <div style={{ borderBottom: "1px solid", borderColor: S.card.border.split(" ")[2], paddingBottom: 16, marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ color: S.page.color, fontWeight: 700, fontSize: 18 }}>{task.name}</span>
              <Badge status={task.status} statusPalette={statusPalette} />
            </div>
            <div style={{ fontSize: 12, color: S.page.background === "#F8F9FA" ? "#9CA3AF" : "#6b7280", marginTop: 4, display: "flex", alignItems: "center", gap: 8 }}>
              <span>{task.id}</span>
              <span style={{ color: S.page.background === "#F8F9FA" ? "#D1D5DB" : "#4b5563" }}>|</span>
              <span>训练模型名：{task.modelName}</span>
              <span style={{ color: S.page.background === "#F8F9FA" ? "#D1D5DB" : "#4b5563" }}>|</span>
              <span>基模：{task.baseModel}</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Button secondary onClick={createNewSubtask} S={S}>新建子任务</Button>
            <Button onClick={startAll} S={S}>并行启动任务</Button>
          </div>
        </div>

        {/* 统计信息和筛选栏 */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 13 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: "#10b981" }}></div>
            <span style={{ color: S.page.background === "#F8F9FA" ? "#6B7280" : "#9ca3af" }}>成功: {statusCounts.succeeded}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: "#004EA2" }}></div>
            <span style={{ color: S.page.background === "#F8F9FA" ? "#6B7280" : "#9ca3af" }}>运行中: {statusCounts.running}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: "#ef4444" }}></div>
            <span style={{ color: S.page.background === "#F8F9FA" ? "#6B7280" : "#9ca3af" }}>失败: {statusCounts.failed}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ color: S.page.background === "#F8F9FA" ? "#6B7280" : "#9ca3af" }}>草稿: {statusCounts.draft}</span>
          </div>
          <div style={{ fontWeight: 600, color: S.page.color }}>总计: {task.subtasks.length}</div>

          {/* 分隔线 */}
          <div style={{ width: 1, height: 20, background: S.page.background === "#0a0a0a" ? "#374151" : "#e2e8f0" }} />

          {/* 状态下拉筛选 */}
          <div style={{ position: 'relative' }} ref={dropdownRef}>
            <button
              onClick={() => setOpenStatusDropdown(!openStatusDropdown)}
              style={{
                padding: '7px 12px',
                border: `2px solid ${statusFilter !== 'all' ? '#004EA2' : (S.page.background === "#0a0a0a" ? "#374151" : "#e2e8f0")}`,
                borderRadius: 8,
                background: statusFilter !== 'all'
                  ? (S.page.background === "#0a0a0a" ? "#004EA215" : "#F0F7FF")
                  : (S.page.background === "#0a0a0a" ? "#1f2937" : "#ffffff"),
                color: statusFilter !== 'all' ? '#004EA2' : S.page.color,
                fontSize: 13,
                fontWeight: statusFilter !== 'all' ? 600 : 500,
                cursor: 'pointer',
                transition: 'all 0.15s',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontFamily: 'inherit',
              }}
              onMouseEnter={(e) => {
                if (statusFilter === 'all') {
                  e.currentTarget.style.borderColor = S.page.background === "#0a0a0a" ? "#4b5563" : "#cbd5e1";
                  e.currentTarget.style.background = S.page.background === "#0a0a0a" ? "#111827" : "#f8fafc";
                }
              }}
              onMouseLeave={(e) => {
                if (statusFilter === 'all') {
                  e.currentTarget.style.borderColor = S.page.background === "#0a0a0a" ? "#374151" : "#e2e8f0";
                  e.currentTarget.style.background = S.page.background === "#0a0a0a" ? "#1f2937" : "#ffffff";
                }
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
              </svg>
              {statusOptions.find(opt => opt.key === statusFilter)?.label || '全部'}
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  transform: openStatusDropdown ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s',
                }}
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>

            {/* 下拉菜单 */}
            {openStatusDropdown && (
              <div style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                left: 0,
                minWidth: 180,
                background: S.page.background === "#0a0a0a" ? "#1f2937" : "#ffffff",
                border: `1px solid ${S.page.background === "#0a0a0a" ? "#374151" : "#e2e8f0"}`,
                borderRadius: 10,
                boxShadow: S.page.background === "#0a0a0a"
                  ? '0 10px 25px rgba(0,0,0,0.5)'
                  : '0 10px 25px rgba(0,0,0,0.1)',
                zIndex: 100,
                maxHeight: 280,
                overflowY: 'auto',
                padding: 6,
              }}>
                {statusOptions.map((option) => (
                  <button
                    key={option.key}
                    onClick={() => handleStatusFilter(option.key)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: 0,
                      background: statusFilter === option.key
                        ? (S.page.background === "#0a0a0a" ? "#374151" : "#f1f5f9")
                        : 'transparent',
                      color: S.page.color,
                      fontSize: 13,
                      fontWeight: statusFilter === option.key ? 600 : 400,
                      cursor: 'pointer',
                      textAlign: 'left',
                      borderRadius: 6,
                      transition: 'all 0.15s',
                      fontFamily: 'inherit',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                    onMouseEnter={(e) => {
                      if (statusFilter !== option.key) {
                        e.currentTarget.style.background = S.page.background === "#0a0a0a" ? "#374151" : "#f1f5f9";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (statusFilter !== option.key) {
                        e.currentTarget.style.background = 'transparent';
                      }
                    }}
                  >
                    <span>{option.label}</span>
                    <span style={{
                      padding: '2px 7px',
                      borderRadius: 5,
                      background: S.page.background === "#0a0a0a" ? "#374151" : "#e5e7eb",
                      color: S.page.background === "#0a0a0a" ? "#d1d5db" : "#6b7280",
                      fontSize: 11,
                      fontWeight: 700,
                      minWidth: 20,
                      textAlign: 'center',
                    }}>
                      {option.count}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 分隔线 */}
          <div style={{ width: 1, height: 20, background: S.page.background === "#0a0a0a" ? "#374151" : "#e2e8f0" }} />

          {/* 搜索框 */}
          <div style={{ position: 'relative', width: 220 }}>
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
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
            </div>

            <input
              type="text"
              value={searchTerm}
              onChange={handleSearch}
              placeholder="搜索子任务..."
              style={{
                width: '100%',
                fontSize: 13,
                padding: '8px 38px 8px 38px',
                border: `2px solid ${S.page.background === "#0a0a0a" ? "#374151" : "#e2e8f0"}`,
                borderRadius: 4,
                background: S.page.background === "#0a0a0a" ? "#1f2937" : "#ffffff",
                color: S.page.color,
                outline: 'none',
                transition: 'all 0.2s',
                fontFamily: 'inherit',
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#004EA2';
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
                  right: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  border: 0,
                  background: S.page.background === "#0a0a0a" ? "#374151" : "#e5e7eb",
                  cursor: 'pointer',
                  padding: 4,
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
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        <TaskTable subtasks={currentSubtasks} onClone={cloneTask} onConfig={() => setPage("subtask")} onDelete={deleteSubtask} S={S} statusPalette={statusPalette} />
      </div>

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={filteredSubtasks.length}
        pageSize={pageSize}
        onPageChange={setCurrentPage}
        S={S}
      />
    </Card>

    {/* 删除确认弹窗 */}

      <ConfirmDialog
        open={deleteConfirm.open}
        title="删除子任务"
        message={`确定要删除子任务 "${deleteConfirm.subtask?.id}" (${deleteConfirm.subtask?.name}) 吗？删除后将无法恢复。`}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirm({ open: false, subtask: null })}
        confirmText="删除"
        danger={true}
        S={S}
      />
    </div>
  );
}
