import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Plus, Edit, Trash2, Search, X, AlertCircle, Tag, ChevronRight, Loader2 } from 'lucide-react';
import * as api from '../../services/api.js';

/* ============================================================
 * MetricSelector — Tag + search dropdown for editing metric_codes
 * ============================================================ */
function MetricSelector({ value = [], onChange, allMetrics = [] }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    function onClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const filtered = allMetrics.filter(m =>
    !value.includes(m.metric_code) &&
    (m.metric_name.includes(search) || m.metric_code.includes(search))
  );

  function add(code) { onChange([...value, code]); setSearch(''); }
  function remove(code) { onChange(value.filter(c => c !== code)); }

  return (
    <div ref={ref} className="relative">
      <div className="flex flex-wrap gap-1.5 min-h-[36px] p-1.5 border border-gray-300 rounded-xl bg-white cursor-text" onClick={() => setOpen(true)}>
        {value.map(code => {
          const m = allMetrics.find(x => x.metric_code === code);
          return (
            <span key={code} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-[#004EA2] text-xs font-medium rounded-lg border border-blue-100">
              <Tag size={10} />{m ? m.metric_name : code}
              <button onClick={e => { e.stopPropagation(); remove(code); }} className="hover:text-red-500 ml-0.5"><X size={10} /></button>
            </span>
          );
        })}
        {open && (
          <input
            autoFocus value={search} onChange={e => setSearch(e.target.value)}
            className="flex-1 min-w-[100px] text-sm outline-none px-1"
            placeholder="搜索指标..."
          />
        )}
        {!open && value.length === 0 && <span className="text-xs text-gray-400 px-1 py-0.5">点击添加关联指标</span>}
      </div>
      {open && filtered.length > 0 && (
        <div className="absolute z-20 mt-1 w-full max-h-48 overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-lg">
          {filtered.slice(0, 20).map(m => (
            <button
              key={m.metric_code}
              onClick={() => add(m.metric_code)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition-colors flex items-center gap-2"
            >
              <span className="text-gray-400 font-mono text-xs">{m.metric_code}</span>
              <span className="text-gray-700">{m.metric_name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ============================================================
 * RiskSignalsConfigPage
 * ============================================================ */
export default function RiskSignalsConfigPage() {
  const [themes, setThemes] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedTheme, setSelectedTheme] = useState(null);
  const [activeCategory, setActiveCategory] = useState(null);
  const [signals, setSignals] = useState([]);
  const [allMetrics, setAllMetrics] = useState([]);
  const [keyword, setKeyword] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingSignal, setEditingSignal] = useState(null);
  const [form, setForm] = useState({ risk_signal: '', category_id: null, metric_codes: [] });
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

  // count per category for badge
  const countByCategory = useMemo(() => {
    const map = {};
    signals.forEach(s => { map[s.category_id] = (map[s.category_id] || 0) + 1; });
    return map;
  }, [signals]);

  // 1. Load tree + metrics on mount
  useEffect(() => {
    loadTree();
    loadAllMetrics();
  }, []);

  // 2. Load signals whenever category/keyword filter changes
  useEffect(() => { loadSignals(); }, [activeCategory, keyword]);

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

  async function loadAllMetrics() {
    try {
      const data = await api.listRduMetrics({});
      setAllMetrics(data);
    } catch (e) { console.error('Load all metrics error:', e); }
  }

  async function loadSignals() {
    try {
      const data = await api.listRduRisks({
        category_id: activeCategory || undefined,
        keyword: keyword || undefined,
      });
      setSignals(data);
    } catch (e) { console.error('Load signals error:', e); }
  }

  function handleNew() {
    setEditingSignal(null);
    setForm({ risk_signal: '', category_id: activeCategory || (categories[0]?.id), metric_codes: [] });
    setShowForm(true);
  }

  function handleEdit(s) {
    setEditingSignal(s);
    setForm({ risk_signal: s.risk_signal, category_id: s.category_id, metric_codes: s.metric_codes || [] });
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.risk_signal.trim()) { alert('风险信号名称不能为空'); return; }
    try {
      if (editingSignal) {
        await api.updateRduRisk(editingSignal.id, form);
      } else {
        await api.createRduRisk(form);
      }
      setShowForm(false);
      loadSignals();
      loadTree(); // refresh counts
    } catch (e) { alert('保存失败：' + e.message); }
  }

  async function handleDelete(s) {
    try {
      await api.deleteRduRisk(s.id);
      setDeleteConfirm(null);
      loadSignals();
      loadTree(); // refresh counts
    } catch (e) { alert('删除失败：' + e.message); }
  }

  return (
    <>
      <div className="flex-1 overflow-y-auto bg-[#F8F9FA] p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-xl font-bold text-gray-800">风险信号配置</h2>
            <p className="text-sm text-gray-500 mt-1">管理 RDU 风险信号定义及其关联指标</p>
          </div>
          <button onClick={handleNew} className="px-4 py-2 bg-[#004EA2] hover:bg-[#003875] text-white rounded-xl font-bold text-sm shadow-md shadow-[#004EA2]/10 transition-all flex items-center gap-2">
            <Plus size={16} /> 新增风险信号
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
                <span className="text-xs text-gray-400">选择下方一级分类筛选风险信号</span>
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
                  {signals.length}
                </span>
              </button>
              {categories.map(cat => {
                const active = activeCategory === cat.id;
                const cnt = cat.signals_count ?? countByCategory[cat.id] ?? 0;
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
            placeholder="搜索风险信号名称..."
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#004EA2]/20"
          />
        </div>

        {/* Signals Table */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-bold text-gray-500 uppercase w-16">ID</th>
                <th className="px-5 py-3 text-left text-xs font-bold text-gray-500 uppercase">风险信号</th>
                <th className="px-5 py-3 text-left text-xs font-bold text-gray-500 uppercase">关联指标</th>
                <th className="px-5 py-3 text-left text-xs font-bold text-gray-500 uppercase w-40">所属分类</th>
                <th className="px-5 py-3 text-right text-xs font-bold text-gray-500 uppercase w-24">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {signals.map(s => (
                <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3 text-xs text-gray-400 font-mono">{s.id}</td>
                  <td className="px-5 py-3 text-sm text-gray-800">{s.risk_signal}</td>
                  <td className="px-5 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(s.metric_codes || []).map(code => {
                        const m = allMetrics.find(x => x.metric_code === code);
                        return (
                          <span key={code} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-md" title={m?.metric_name || code}>
                            <Tag size={9} />{m?.metric_name || code}
                          </span>
                        );
                      })}
                      {(!s.metric_codes || s.metric_codes.length === 0) && <span className="text-xs text-gray-400">-</span>}
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <span className="inline-flex items-center px-2 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded-lg">
                      {categoryMap[s.category_id] || `ID:${s.category_id}`}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => handleEdit(s)} className="p-1.5 hover:bg-blue-50 rounded-lg text-gray-400 hover:text-[#004EA2]" title="编辑"><Edit size={14} /></button>
                      <button onClick={() => setDeleteConfirm(s)} className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500" title="删除"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {signals.length === 0 && (
                <tr><td colSpan={5} className="px-5 py-12 text-center text-gray-400">
                  {keyword ? '未找到匹配的风险信号' : '当前分类下暂无风险信号数据'}
                </td></tr>
              )}
            </tbody>
          </table>
          <div className="px-5 py-2 border-t border-gray-100 text-xs text-gray-400 text-right">
            共 {signals.length} 条{activeCategory ? ` (${categoryMap[activeCategory] || ''})` : ''}
          </div>
        </div>
      </div>

      {/* Create/Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg ring-1 ring-gray-200">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-800">{editingSignal ? '编辑风险信号' : '新增风险信号'}</h3>
              <button onClick={() => setShowForm(false)} className="p-2 hover:bg-gray-100 rounded-full text-gray-400"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">风险信号名称</label>
                <input type="text" value={form.risk_signal} onChange={e => setForm(p => ({ ...p, risk_signal: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm" placeholder="例如：营业收入大幅下降" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">所属分类</label>
                <select value={form.category_id || ''} onChange={e => setForm(p => ({ ...p, category_id: parseInt(e.target.value) }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm">
                  <option value="" disabled>请选择分类</option>
                  {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">关联指标</label>
                <MetricSelector
                  value={form.metric_codes}
                  onChange={codes => setForm(p => ({ ...p, metric_codes: codes }))}
                  allMetrics={allMetrics}
                />
                <p className="text-xs text-gray-400 mt-1">点击输入框搜索并添加关联的标准指标</p>
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
            <p className="text-sm text-gray-600 mb-6">确定要删除风险信号「{deleteConfirm.risk_signal}」吗？</p>
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
