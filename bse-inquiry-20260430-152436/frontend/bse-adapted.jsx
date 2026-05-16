import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  MessageSquare, Plus, Check, X, ChevronDown, Trash2, Settings, LogOut
} from 'lucide-react';
import * as api from './services/api.js';
import ChatPage from './src/pages/ChatPage.jsx';
import SystemConfigPage from './src/pages/SystemConfigPage.jsx';

export default function BSEAuditAgent() {
  // --- Auth & Init ---
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('auth_token'));
  const [isInitLoading, setIsInitLoading] = useState(false);
  const [initError, setInitError] = useState(null);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });

  // --- Core State ---
  const [messages, setMessages] = useState([
    { id: 'm0', role: 'assistant', content: '您好，我是北交所年报智能审查大模型。请上传需要审查的年度报告或输入相关指令（例如："审查海希通讯2024年报"）。' }
  ]);
  const [input, setInput] = useState('');
  const [tasks, setTasks] = useState({});
  const [activeTaskId, setActiveTaskId] = useState(null);
  const [conversationId, setConversationId] = useState(null);
  const [conversations, setConversations] = useState([]);

  // Models
  const [models, setModels] = useState([]);
  const [selectedModelId, setSelectedModelId] = useState(null);
  const [parentModels, setParentModels] = useState([]);

  // User info
  const [currentUser, setCurrentUser] = useState(null);
  const [showUserMenu, setShowUserMenu] = useState(false);

  // 路由：使用 hash 实现页面独立 URL，刷新后保持
  const getPageFromHash = () => {
    const hash = window.location.hash.replace('#', '');
    return ['chat', 'config'].includes(hash) ? hash : 'chat';
  };
  const [currentView, setCurrentView] = useState(getPageFromHash);
  const currentViewRef = useRef(getPageFromHash());

  // Sync currentView to ref for real-time access in timers
  useEffect(() => {
    currentViewRef.current = currentView;
  }, [currentView]);

  // Sync hash with currentView
  useEffect(() => {
    const handleHashChange = () => {
      const page = getPageFromHash();
      setCurrentView(page);
      currentViewRef.current = page;
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Helper to navigate pages - clears polling when leaving chat
  function switchView(view) {
    if (view !== 'chat') {
      Object.keys(pollTimers.current).forEach(taskId => {
        clearTimeout(pollTimers.current[taskId]);
        delete pollTimers.current[taskId];
      });
    }
    window.location.hash = view;
  }

  // Polling timer refs
  const pollTimers = useRef({});
  // Generation counter: incremented on conversation switch to invalidate in-flight polls
  const pollGeneration = useRef(0);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      Object.values(pollTimers.current).forEach(t => clearTimeout(t));
    };
  }, []);

  // --- Init: load models, conversations ---
  useEffect(() => {
    if (!isAuthenticated) return;
    const init = async () => {
      setIsInitLoading(true);
      setInitError(null);
      try {
        const userInfo = await api.getMe();
        setCurrentUser(userInfo);

        const parentModelList = await api.listParentModels();
        setParentModels(parentModelList);
        if (parentModelList.length > 0) {
          const def = parentModelList.find(m => m.is_default) || parentModelList[0];
          setSelectedModelId(def.id);
        }

        const modelList = await api.listActiveModels();
        setModels(modelList);

        let convs = await api.listConversations();
        setConversations(convs || []);
        if (convs && convs.length > 0) {
          const conv = convs[0];
          setConversationId(conv.id);
          const taskList = await api.listTasks(conv.id);
          const taskMap = {};
          for (const t of taskList) {
            taskMap[t.id] = { ...t, riskSignals: [], step: t.current_step || 0 };
          }
          setTasks(taskMap);
          try {
            const msgs = await api.listMessages(conv.id);
            if (msgs && msgs.length > 0) {
              const formatted = msgs.map(m => ({
                id: m.id, role: m.role, content: m.content,
                type: m.message_type, taskId: m.task_id,
                metadata: m.metadata,
              }));
              setMessages(formatted);
            }
          } catch (e) { /* no messages */ }
          for (const t of taskList) {
            if (t.status === 'running' || t.status === 'paused') {
              startPolling(t.id);
            }
          }
        }
      } catch (e) {
        console.error('Init error:', e);
        setInitError(e.message);
      } finally {
        setIsInitLoading(false);
      }
    };
    init();
  }, [isAuthenticated]);

  // Delete conversation handler
  async function handleDeleteConversation(convId, e) {
    e.stopPropagation();
    if (!confirm('确定删除该会话？关联的所有审查任务和数据将一并删除，此操作不可撤销。')) return;
    try {
      // Stop any polling for tasks in this conversation
      Object.keys(tasks).forEach(taskId => {
        const t = tasks[taskId];
        if (t && t.conversation_id === convId) {
          clearTimeout(pollTimers.current[taskId]);
          delete pollTimers.current[taskId];
        }
      });
      await api.deleteConversation(convId);
      setConversations(prev => prev.filter(c => c.id !== convId));
      if (conversationId === convId) {
        setConversationId(null);
        setTasks({});
        setActiveTaskId(null);
        setMessages([{ id: 'm0', role: 'assistant', content: '您好，我是北交所年报智能审查大模型。请在下方输入框输入类似"审查海希通讯2024年报"的指令来开始审查。' }]);
      }
    } catch (err) {
      alert('删除失败：' + err.message);
    }
  }

  // Switch conversation handler
  async function handleSwitchConversation(convId) {
    if (convId === conversationId) return;
    // Stop all existing polling and invalidate in-flight poll callbacks
    Object.keys(pollTimers.current).forEach(tid => {
      clearTimeout(pollTimers.current[tid]);
      delete pollTimers.current[tid];
    });
    pollGeneration.current += 1;
    setConversationId(convId);
    setActiveTaskId(null);
    setTasks({});
    setMessages([{ id: 'm0', role: 'assistant', content: '您好，我是北交所年报智能审查大模型。请在下方输入框输入类似"审查海希通讯2024年报"的指令来开始审查。' }]);
    try {
      const taskList = await api.listTasks(convId);
      const taskMap = {};
      for (const t of taskList) {
        taskMap[t.id] = { ...t, riskSignals: [], step: t.current_step || 0 };
      }
      setTasks(taskMap);
      const msgs = await api.listMessages(convId);
      if (msgs && msgs.length > 0) {
        setMessages(msgs.map(m => ({
          id: m.id, role: m.role, content: m.content,
          type: m.message_type, taskId: m.task_id,
          metadata: m.metadata,
        })));
      }
      for (const t of taskList) {
        if (t.status === 'running' || t.status === 'paused') {
          startPolling(t.id);
        }
      }
    } catch (e) {
      console.error('Switch conversation error:', e);
    }
  }

  // Poll workflow status from backend
  const startPolling = useCallback((taskId) => {
    const poll = async () => {
      if (currentViewRef.current !== 'chat') return;
      const gen = pollGeneration.current;
      try {
        const task = await api.getTask(taskId);
        const workflow = await api.getWorkflowStatus(taskId);

        // Conversation switched while we were awaiting — discard stale result
        if (currentViewRef.current !== 'chat' || pollGeneration.current !== gen) return;

        setTasks(prev => ({
          ...prev,
          [taskId]: { ...prev[taskId], ...task, step: task.current_step, workflowSteps: workflow.steps }
        }));

        if (task.status === 'completed') {
          setTasks(prev => ({ ...prev, [taskId]: { ...prev[taskId], status: 'completed' } }));
          // Fetch latest messages to show inquiry letter result in chat
          try {
            const convId = task.conversation_id;
            if (convId && pollGeneration.current === gen) {
              const msgs = await api.listMessages(convId);
              if (msgs && msgs.length > 0 && pollGeneration.current === gen) {
                const formatted = msgs.map(m => ({
                  id: m.id, role: m.role, content: m.content,
                  type: m.message_type, taskId: m.task_id,
                  metadata: m.metadata,
                }));
                setMessages(formatted);
              }
            }
          } catch (e) {
            console.error('Failed to fetch completion messages:', e);
          }
          return;
        } else if (task.status === 'failed') {
          // Find the failed step and inject error message into chat
          const failedStep = workflow.steps?.find(s => s.status === 'failed');
          const stepName = failedStep?.step_name || `Step ${failedStep?.step_index ?? '?'}`;
          const errDetail = failedStep?.error_message || '未知错误';
          setMessages(prev => [...prev, {
            id: `msg-fail-${taskId}-${Date.now()}`,
            role: 'assistant',
            content: `**任务执行失败** - 在「${stepName}」阶段出错：\n${errDetail}`,
          }]);
          return;
        } else if (task.status === 'interrupted') {
          // Zombie task recovered on server restart
          const intStep = workflow.steps?.find(s => s.status === 'interrupted');
          const stepName = intStep?.step_name || `Step ${intStep?.step_index ?? '?'}`;
          setMessages(prev => [...prev, {
            id: `msg-int-${taskId}-${Date.now()}`,
            role: 'assistant',
            content: `**任务被中断** - 服务重启导致「${stepName}」阶段中断，请重新发起任务。`,
          }]);
          return;
        }

        if (pollGeneration.current === gen) {
          pollTimers.current[taskId] = setTimeout(poll, 2000);
        }
      } catch (e) {
        console.error('Poll error:', e);
        if (currentViewRef.current === 'chat' && pollGeneration.current === gen) {
          pollTimers.current[taskId] = setTimeout(poll, 3000);
        }
      }
    };
    pollTimers.current[taskId] = setTimeout(poll, 1500);
  }, []);

  // --- Login Handler ---
  async function doHandleLogin() {
    try {
      const data = await api.login(loginForm.username, loginForm.password);
      if (data && data.token) {
        setIsAuthenticated(true);
      }
    } catch (e) {
      alert('登录失败：' + e.message);
    }
  }

  // --- Login Screen ---
  if (!isAuthenticated) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#F8F9FA]">
        <div className="bg-white rounded-2xl shadow-lg p-8 w-96">
          <div className="flex items-center gap-2.5 mb-6 justify-center">
            <img src="/pic/icon_logo.png" alt="logo" className="w-10 h-10 shrink-0 object-contain" />
            <div className="flex flex-col min-w-0" style={{ gap: '3px' }}>
              <img src="/pic/icon_name.png" alt="北京证券交易所" className="h-[22px] object-contain object-left" />
              <div className="w-full h-px bg-gray-200"></div>
              <span className="text-[11px] text-gray-500 font-bold tracking-wide leading-tight whitespace-nowrap">上市公司年报智能审查平台</span>
            </div>
          </div>
          <input type="text" placeholder="用户名" value={loginForm.username}
            onChange={e => setLoginForm({ ...loginForm, username: e.target.value })}
            className="w-full mb-3 px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#004EA2]/20" />
          <input type="password" placeholder="密码" value={loginForm.password}
            onChange={e => setLoginForm({ ...loginForm, password: e.target.value })}
            onKeyDown={e => { if (e.key === 'Enter') doHandleLogin(); }}
            className="w-full mb-4 px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#004EA2]/20" />
          <button onClick={doHandleLogin}
            className="w-full bg-[#004EA2] hover:bg-[#003875] text-white py-3 rounded-xl font-bold text-sm">
            登录
          </button>
        </div>
      </div>
    );
  }

  // --- Loading Screen ---
  if (isAuthenticated && isInitLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#F8F9FA]">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-[#004EA2] border-t-transparent mb-4"></div>
          <p className="text-gray-600">正在初始化...</p>
        </div>
      </div>
    );
  }

  // --- Error Screen ---
  if (isAuthenticated && initError) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#F8F9FA]">
        <div className="bg-white rounded-2xl shadow-lg p-8 w-96 text-center">
          <div className="text-red-500 text-4xl mb-4">⚠</div>
          <h2 className="font-bold text-lg text-gray-800 mb-2">初始化失败</h2>
          <p className="text-sm text-gray-600 mb-4">{initError}</p>
          <button onClick={() => { setInitError(null); setIsAuthenticated(false); localStorage.removeItem('auth_token'); }}
            className="bg-[#004EA2] text-white px-6 py-2 rounded-xl text-sm font-bold">
            重新登录
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#F8F9FA] text-gray-800 font-sans antialiased">
      {/* Left Sidebar */}
      <div className="w-[260px] bg-white flex flex-col hidden md:flex z-10 border-r border-gray-200 shadow-sm">
        <div className="h-[72px] flex items-center gap-2.5 border-b border-gray-100 px-4 bg-white">
          <img src="/pic/icon_logo.png" alt="logo" className="w-10 h-10 shrink-0 object-contain" />
          <div className="flex flex-col min-w-0" style={{ gap: '3px' }}>
            <img src="/pic/icon_name.png" alt="北京证券交易所" className="h-[22px] object-contain object-left" />
            <div className="w-full h-px bg-gray-200"></div>
            <span className="text-[11px] text-gray-500 font-bold tracking-wide leading-tight whitespace-nowrap">上市公司年报智能审查平台</span>
          </div>
        </div>
        <div className="p-3 border-b border-gray-100">
          <button
            onClick={() => {
              // 停止所有轮询，避免旧会话数据写入新会话
              Object.keys(pollTimers.current).forEach(tid => {
                clearTimeout(pollTimers.current[tid]);
                delete pollTimers.current[tid];
              });
              pollGeneration.current += 1;
              setConversationId(null);
              setActiveTaskId(null);
              setTasks({});
              setMessages([{ id: 'm0', role: 'assistant', content: '您好，我是北交所年报智能审查大模型。请在下方输入框输入类似"审查海希通讯2024年报"的指令来开始审查。' }]);
            }}
            className="w-full py-2.5 px-4 rounded-xl flex items-center gap-2.5 text-[13px] font-medium transition-all border border-transparent text-gray-700 hover:bg-gray-50 hover:text-gray-900">
            <Plus size={16} className="shrink-0" /> 新建审查会话
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-1 bg-white">
          <div className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3 mt-2 px-3">审查会话</div>
          {conversations.map(conv => (
            <div key={conv.id}
              onClick={() => {
                handleSwitchConversation(conv.id);
                if (currentView !== 'chat') window.location.hash = 'chat';
              }}
              className={`group w-full text-left px-4 py-2.5 text-[13px] rounded-xl transition-all flex items-center gap-2 cursor-pointer relative ${
                conversationId === conv.id
                  ? 'bg-[#F0F7FF] text-[#004EA2] font-semibold border border-[#CCE4FF] shadow-sm'
                  : 'text-gray-600 hover:bg-gray-50 border border-transparent hover:text-gray-900'
              }`}>
              <MessageSquare size={14} className="shrink-0 opacity-60" />
              <span className="truncate flex-1">{conv.title || '新审查会话'}</span>
              <button
                onClick={(e) => handleDeleteConversation(conv.id, e)}
                className="opacity-0 group-hover:opacity-100 p-1 rounded-md hover:bg-red-50 hover:text-red-500 text-gray-400 transition-all shrink-0"
                title="删除会话"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
          {conversations.length === 0 && (
            <div className="text-[12px] text-gray-400 px-3 py-4 text-center mt-4">暂无会话</div>
          )}
        </div>

        {/* User Panel */}
        {currentUser && (
          <div className="border-t border-gray-200 bg-white relative">
            <div
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-[#004EA2] text-white flex items-center justify-center text-sm font-bold shrink-0">
                {(currentUser.display_name || currentUser.username || '?')[0].toUpperCase()}
              </div>
              <span className="text-[13px] font-semibold text-gray-800 truncate flex-1">{currentUser.display_name || currentUser.username}</span>
            </div>
            {showUserMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)}></div>
                <div className="absolute bottom-full left-3 right-3 mb-1 bg-white border border-gray-200 rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] py-1.5 z-50 overflow-hidden">
                  {currentUser.role === 'admin' && (
                    <button
                      onClick={() => { setShowUserMenu(false); switchView('config'); }}
                      className="w-full text-left px-4 py-2.5 hover:bg-gray-50 flex items-center gap-2.5 transition-colors text-gray-700 hover:text-[#004EA2]"
                    >
                      <Settings size={15} />
                      <span className="text-[13px] font-medium">系统配置</span>
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      localStorage.removeItem('auth_token');
                      setIsAuthenticated(false);
                      setCurrentUser(null);
                    }}
                    className="w-full text-left px-4 py-2.5 hover:bg-gray-50 flex items-center gap-2.5 transition-colors text-gray-700 hover:text-red-500"
                  >
                    <LogOut size={15} />
                    <span className="text-[13px] font-medium">退出登录</span>
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Main Content Area - routed by hash */}
      {currentView === 'chat' && (
        <ChatPage
          messages={messages} setMessages={setMessages}
          input={input} setInput={setInput}
          tasks={tasks} setTasks={setTasks}
          activeTaskId={activeTaskId} setActiveTaskId={setActiveTaskId}
          conversationId={conversationId} setConversationId={setConversationId}
          conversations={conversations} setConversations={setConversations}
          parentModels={parentModels} selectedModelId={selectedModelId} setSelectedModelId={setSelectedModelId}
          startPolling={startPolling} pollTimers={pollTimers}
          currentUser={currentUser}
        />
      )}

      {currentView === 'config' && (
        <SystemConfigPage onBack={() => switchView('chat')} />
      )}
    </div>
  );
}
