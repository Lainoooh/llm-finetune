import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Edit, Trash2, Search, X, AlertCircle, ChevronRight, Loader2 } from 'lucide-react';
import * as api from '../../services/api.js';

export default function MetricsConfigPage() {
  const [themes, setThemes] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedTheme, setSelectedTheme] = useState(null);
  const [activeCategory, setActiveCategory] = useState(null);
  const [metrics, setMetrics] = useState([]);
  const [keyword, setKeyword] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingMetric, setEditingMetric] = useState(null);
  const [form, setForm] = useState({ metric_name: '', metric_code: '', category_id: null });
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [treeError, setTreeError] = useState(null);

  // category id → name lookup
  const categoryMap = useMemo(() => {
    const map = {};
    categories.forEach(c => { map[c.id] = c.name; });
    themes.forEach(t => { map[t.id] = t.name; });
    return map;
  }, [categories, themes]);

  // count per category for badge (from loaded metrics when viewing "全部")
  const countByCategory = useMemo(() => {
    const map = {};
    metrics.forEach(m => { map[m.category_id] = (map[m.category_id] || 0) + 1; });
    return map;
  }, [metrics]);

  // 1. Load tree on mount
  useEffect(() => { loadTree(); }, []);

  // 2. Load metrics whenever category filter changes
  useEffect(() => { loadMetrics(); }, [activeCategory, keyword]);

  async function loadTree() {
    setLoading(true);
    setTreeError(null);
    try {
      const tree = await api.listCategories({ tree: true });
      setThemes(tree);
      if (tree.length > 0) {
        const theme = tree[0];
        setSelectedTheme(theme);
        setCategories(theme.children || []);
        setActiveCategory(null);
      }
    } catch (e) {
      console.error('Load tree error:', e);
      setTreeError('分类数据加载失败：' + e.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadMetrics() {
    try {
      const data = await api.listRduMetrics({
        category_id: activeCategory || undefined,
        keyword: keyword || undefined,
      });
      setMetrics(data);
    } catch (e) { console.error('Load metrics error:', e); }
  }

  function handleNew() {
    setEditingMetric(null);
    setForm({ metric_name: '', metric_code: '', category_id: activeCategory || (categories[0]?.id) });
    setShowForm(true);
  }

  function handleEdit(m) {
    setEditingMetric(m);
    setForm({ metric_name: m.metric_name, metric_code: m.metric_code, category_id: m.category_id });
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.metric_name.trim() || !form.metric_code.trim()) {
      alert('指标名称和编码不能为空');
      return;
    }
    try {
      if (editingMetric) {
        await api.updateRduMetric(editingMetric.id, form);
      } else {
        await api.createRduMetric(form);
      }
      setShowForm(false);
      loadMetrics();
      loadTree(); // refresh counts
    } catch (e) { alert('保存失败：' + e.message); }
  }

  async function handleDelete(m) {
    try {
      await api.deleteRduMetric(m.id);
      setDeleteConfirm(null);
      loadMetrics();
      loadTree(); // refresh counts
    } catch (e) { alert('删除失败：' + e.message); }
  }

  return (
    <>
      <div className="flex-1 overflow-y-auto bg-[#F8F9FA] p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-xl font-bold text-gray-800">指标集配置</h2>
            <p className="text-sm text-gray-500 mt-1">管理 RDU 标准指标定义，按主题和分类筛选查看</p>
          </div>
          <button onClick={handleNew} className="px-4 py-2 bg-[#004EA2] hover:bg-[#003875] text-white rounded-xl font-bold text-sm shadow-md shadow-[#004EA2]/10 transition-all flex items-center gap-2">
            <Plus size={16} /> 新增指标
          </button>
        </div>

        {/* Loading / Error state */}
        {loading && (
          <div className="flex items-center justify-center py-12 text-gray-400">
            <Loader2 size={20} className="animate-spin mr-2" />
            <span className="text-sm">加载分类数据...</span>
          </div>
        )}

        {treeError && (
          <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-sm text-red-600">
            <AlertCircle size={16} />
            <span>{treeError}</span>
            <button onClick={loadTree} className="ml-auto text-xs font-semibold text-red-700 underline">重试</button>
          </div>
        )}

        {/* Theme Banner + Category Tabs */}
        {!loading && !treeError && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-4 overflow-hidden">
            {/* Theme row */}
            {selectedTheme && (
              <div className="px-5 py-3 bg-gradient-to-r from-[#004EA2]/5 to-transparent border-b border-gray-100 flex items-center gap-2">
                <span className="inline-flex items-center px-2.5 py-1 bg-[#004EA2]/10 text-[#004EA2] text-xs font-bold rounded-lg">主题</span>
                <span className="text-sm font-semibold text-gray-800">{selectedTheme.name}</span>
                <ChevronRight size={14} className="text-gray-400" />
                <span className="text-xs text-gray-400">选择下方一级分类筛选指标</span>
              </div>
            )}
            {/* Category tabs row */}
            <div className="px-5 py-3 flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setActiveCategory(null)}
                className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  !activeCategory
                    ? 'bg-[#004EA2] text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-800'
                }`}
              >
                全部
                <span className={`ml-1.5 text-xs ${!activeCategory ? 'text-white/70' : 'text-gray-400'}`}>
                  {metrics.length}
                </span>
              </button>
              {categories.map(cat => {
                const active = activeCategory === cat.id;
                const cnt = cat.metrics_count ?? countByCategory[cat.id] ?? 0;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      active
                        ? 'bg-[#004EA2] text-white shadow-sm'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-800'
                    }`}
                  >
                    {cat.name}
                    <span className={`ml-1.5 text-xs ${active ? 'text-white/70' : 'text-gray-400'}`}>{cnt}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Search */}
        <div className="relative mb-4 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text" value={keyword} onChange={e => setKeyword(e.target.value)}
            placeholder="搜索指标名称或编码..."
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#004EA2]/20"
          />
        </div>

        {/* Metrics Table */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-bold text-gray-500 uppercase w-16">ID</th>
                <th className="px-5 py-3 text-left text-xs font-bold text-gray-500 uppercase">指标编码</th>
                <th className="px-5 py-3 text-left text-xs font-bold text-gray-500 uppercase">指标名称</th>
                <th className="px-5 py-3 text-left text-xs font-bold text-gray-500 uppercase w-40">所属分类</th>
                <th className="px-5 py-3 text-right text-xs font-bold text-gray-500 uppercase w-24">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {metrics.map(m => (
                <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3 text-xs text-gray-400 font-mono">{m.id}</td>
                  <td className="px-5 py-3 text-sm font-mono text-gray-700">{m.metric_code}</td>
                  <td className="px-5 py-3 text-sm text-gray-800">{m.metric_name}</td>
                  <td className="px-5 py-3">
                    <span className="inline-flex items-center px-2 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded-lg">
                      {categoryMap[m.category_id] || `ID:${m.category_id}`}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => handleEdit(m)} className="p-1.5 hover:bg-blue-50 rounded-lg text-gray-400 hover:text-[#004EA2]" title="编辑"><Edit size={14} /></button>
                      <button onClick={() => setDeleteConfirm(m)} className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500" title="删除"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {metrics.length === 0 && (
                <tr><td colSpan={5} className="px-5 py-12 text-center text-gray-400">
                  {keyword ? '未找到匹配的指标' : '当前分类下暂无指标数据'}
                </td></tr>
              )}
            </tbody>
          </table>
          <div className="px-5 py-2 border-t border-gray-100 text-xs text-gray-400 text-right">
            共 {metrics.length} 条{activeCategory ? ` (${categoryMap[activeCategory] || ''})` : ''}
          </div>
        </div>
      </div>

      {/* Create/Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md ring-1 ring-gray-200">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-800">{editingMetric ? '编辑指标' : '新增指标'}</h3>
              <button onClick={() => setShowForm(false)} className="p-2 hover:bg-gray-100 rounded-full text-gray-400"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">指标编码</label>
                <input type="text" value={form.metric_code} onChange={e => setForm(p => ({ ...p, metric_code: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm font-mono" placeholder="例如：RDU_PERF_TOTAL_REV_T" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">指标名称</label>
                <input type="text" value={form.metric_name} onChange={e => setForm(p => ({ ...p, metric_name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm" placeholder="例如：T期营业收入" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">所属分类</label>
                <select value={form.category_id || ''} onChange={e => setForm(p => ({ ...p, category_id: parseInt(e.target.value) }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm">
                  <option value="" disabled>请选择分类</option>
                  {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                </select>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 border border-gray-300 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50">取消</button>
              <button onClick={handleSave} className="px-6 py-2 bg-[#004EA2] hover:bg-[#003875] text-white rounded-xl text-sm font-bold">保存</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md ring-1 ring-gray-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-red-500"><AlertCircle size={20} /></div>
              <h3 className="text-lg font-bold text-gray-800">确认删除</h3>
            </div>
            <p className="text-sm text-gray-600 mb-6">确定要删除指标「{deleteConfirm.metric_name}」({deleteConfirm.metric_code}) 吗？如果该指标被风险信号引用将无法删除。</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 border border-gray-300 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50">取消</button>
              <button onClick={() => handleDelete(deleteConfirm)} className="px-6 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-bold">删除</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
