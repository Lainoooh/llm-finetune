import { useState, useRef, useEffect } from "react";

export function FilterBar({
  searchValue,
  onSearchChange,
  searchPlaceholder,
  statusFilter,
  onStatusFilterChange,
  statusOptions = [],
  dropdownFilters = [],
  S
}) {
  const [openDropdown, setOpenDropdown] = useState(null);
  const dropdownRefs = useRef({});

  useEffect(() => {
    function handleClickOutside(event) {
      if (openDropdown && dropdownRefs.current[openDropdown] &&
          !dropdownRefs.current[openDropdown].contains(event.target)) {
        setOpenDropdown(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openDropdown]);

  const handleClearSearch = () => {
    onSearchChange({ target: { value: '' } });
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '12px 0',
      borderBottom: `1px solid ${S.page.background === "#0a0a0a" ? "#374151" : "#e2e8f0"}`,
      marginBottom: 16,
    }}>
      {/* 左侧：状态筛选 */}
      {statusOptions.length > 0 && (
        <div style={{ display: 'flex', gap: 6 }}>
          {statusOptions.map(({ key, label, count, color }) => (
            <button
              key={key}
              onClick={() => onStatusFilterChange(key)}
              style={{
                padding: '7px 14px',
                border: statusFilter === key
                  ? `2px solid ${color || '#667eea'}`
                  : `2px solid ${S.page.background === "#0a0a0a" ? "#374151" : "#e2e8f0"}`,
                borderRadius: 8,
                background: statusFilter === key
                  ? (S.page.background === "#0a0a0a" ? `${color || '#667eea'}15` : `${color || '#667eea'}08`)
                  : (S.page.background === "#0a0a0a" ? "#1f2937" : "#ffffff"),
                color: statusFilter === key ? (color || '#667eea') : S.page.color,
                fontSize: 13,
                fontWeight: statusFilter === key ? 600 : 500,
                cursor: 'pointer',
                transition: 'all 0.15s',
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                fontFamily: 'inherit',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={(e) => {
                if (statusFilter !== key) {
                  e.currentTarget.style.borderColor = S.page.background === "#0a0a0a" ? "#4b5563" : "#cbd5e1";
                  e.currentTarget.style.background = S.page.background === "#0a0a0a" ? "#111827" : "#f8fafc";
                }
              }}
              onMouseLeave={(e) => {
                if (statusFilter !== key) {
                  e.currentTarget.style.borderColor = S.page.background === "#0a0a0a" ? "#374151" : "#e2e8f0";
                  e.currentTarget.style.background = S.page.background === "#0a0a0a" ? "#1f2937" : "#ffffff";
                }
              }}
            >
              {label}
              {count !== undefined && (
                <span style={{
                  padding: '2px 7px',
                  borderRadius: 5,
                  background: statusFilter === key
                    ? (color || '#667eea')
                    : (S.page.background === "#0a0a0a" ? "#374151" : "#e5e7eb"),
                  color: statusFilter === key
                    ? '#fff'
                    : (S.page.background === "#0a0a0a" ? "#d1d5db" : "#6b7280"),
                  fontSize: 11,
                  fontWeight: 700,
                  minWidth: 20,
                  textAlign: 'center',
                }}>
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* 右侧：搜索框 */}
      <div style={{ position: 'relative', width: 280, marginLeft: 'auto' }}>
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
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
        </div>

        <input
          type="text"
          value={searchValue}
          onChange={onSearchChange}
          placeholder={searchPlaceholder || "搜索..."}
          style={{
            width: '100%',
            fontSize: 14,
            padding: '12px 44px 12px 44px',
            border: `2px solid ${S.page.background === "#0a0a0a" ? "#374151" : "#e2e8f0"}`,
            borderRadius: 10,
            background: S.page.background === "#0a0a0a" ? "#1f2937" : "#ffffff",
            color: S.page.color,
            outline: 'none',
            transition: 'all 0.2s',
            fontFamily: 'inherit',
          }}
          onFocus={(e) => {
            e.target.style.borderColor = '#667eea';
            e.target.style.background = S.page.background === "#0a0a0a" ? "#111827" : "#f9fafb";
          }}
          onBlur={(e) => {
            e.target.style.borderColor = S.page.background === "#0a0a0a" ? "#374151" : "#e2e8f0";
            e.target.style.background = S.page.background === "#0a0a0a" ? "#1f2937" : "#ffffff";
          }}
        />

        {searchValue && (
          <button
            onClick={handleClearSearch}
            style={{
              position: 'absolute',
              right: 14,
              top: '50%',
              transform: 'translateY(-50%)',
              border: 0,
              background: S.page.background === "#0a0a0a" ? "#374151" : "#e5e7eb",
              cursor: 'pointer',
              padding: 6,
              borderRadius: 6,
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
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* 下拉筛选器 */}
      {dropdownFilters.map((filter) => (
          <div
            key={filter.key}
            style={{ position: 'relative' }}
            ref={el => dropdownRefs.current[filter.key] = el}
          >
            <button
              onClick={() => setOpenDropdown(openDropdown === filter.key ? null : filter.key)}
              style={{
                padding: '7px 12px',
                border: `2px solid ${filter.value ? '#667eea' : (S.page.background === "#0a0a0a" ? "#374151" : "#e2e8f0")}`,
                borderRadius: 8,
                background: filter.value
                  ? (S.page.background === "#0a0a0a" ? "#667eea15" : "#667eea08")
                  : (S.page.background === "#0a0a0a" ? "#1f2937" : "#ffffff"),
                color: filter.value ? '#667eea' : S.page.color,
                fontSize: 13,
                fontWeight: filter.value ? 600 : 500,
                cursor: 'pointer',
                transition: 'all 0.15s',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontFamily: 'inherit',
              }}
              onMouseEnter={(e) => {
                if (!filter.value) {
                  e.currentTarget.style.borderColor = S.page.background === "#0a0a0a" ? "#4b5563" : "#cbd5e1";
                  e.currentTarget.style.background = S.page.background === "#0a0a0a" ? "#111827" : "#f8fafc";
                }
              }}
              onMouseLeave={(e) => {
                if (!filter.value) {
                  e.currentTarget.style.borderColor = S.page.background === "#0a0a0a" ? "#374151" : "#e2e8f0";
                  e.currentTarget.style.background = S.page.background === "#0a0a0a" ? "#1f2937" : "#ffffff";
                }
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
              </svg>
              {filter.label}
              {filter.value && (
                <span style={{
                  padding: '2px 6px',
                  borderRadius: 4,
                  background: '#667eea',
                  color: '#fff',
                  fontSize: 11,
                  fontWeight: 700,
                }}>
                  1
                </span>
              )}
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
                  transform: openDropdown === filter.key ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s',
                }}
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>

            {/* 下拉菜单 */}
            {openDropdown === filter.key && (
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
                {/* 全部选项 */}
                <button
                  onClick={() => {
                    filter.onChange('');
                    setOpenDropdown(null);
                  }}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: 0,
                    background: !filter.value
                      ? (S.page.background === "#0a0a0a" ? "#374151" : "#f1f5f9")
                      : 'transparent',
                    color: S.page.color,
                    fontSize: 13,
                    fontWeight: !filter.value ? 600 : 400,
                    cursor: 'pointer',
                    textAlign: 'left',
                    borderRadius: 6,
                    transition: 'all 0.15s',
                    fontFamily: 'inherit',
                  }}
                  onMouseEnter={(e) => {
                    if (filter.value) {
                      e.currentTarget.style.background = S.page.background === "#0a0a0a" ? "#374151" : "#f1f5f9";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (filter.value) {
                      e.currentTarget.style.background = 'transparent';
                    }
                  }}
                >
                  全部
                </button>

                {/* 选项列表 */}
                {filter.options.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => {
                      filter.onChange(option.value);
                      setOpenDropdown(null);
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: 0,
                      background: filter.value === option.value
                        ? (S.page.background === "#0a0a0a" ? "#374151" : "#f1f5f9")
                        : 'transparent',
                      color: S.page.color,
                      fontSize: 13,
                      fontWeight: filter.value === option.value ? 600 : 400,
                      cursor: 'pointer',
                      textAlign: 'left',
                      borderRadius: 6,
                      transition: 'all 0.15s',
                      fontFamily: 'inherit',
                    }}
                    onMouseEnter={(e) => {
                      if (filter.value !== option.value) {
                        e.currentTarget.style.background = S.page.background === "#0a0a0a" ? "#374151" : "#f1f5f9";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (filter.value !== option.value) {
                        e.currentTarget.style.background = 'transparent';
                      }
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>
      ))}
    </div>
  );
}
