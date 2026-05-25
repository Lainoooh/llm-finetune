import { Button } from "./Button";

export function Pagination({ currentPage, totalPages, pageSize, totalItems, onPageChange, S }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 16,
      fontSize: 13,
      color: S.page.background === "#0a0a0a" ? "#9ca3af" : "#64748b"
    }}>
      <span>
        当前第 {currentPage} 页，每页 {pageSize} 条，共 {totalItems} 条
      </span>
      <div style={{ display: 'flex', gap: 8 }}>
        <Button
          secondary
          disabled={currentPage === 1}
          onClick={() => onPageChange(currentPage - 1)}
          S={S}
        >
          上一页
        </Button>
        <Button
          secondary
          disabled={currentPage === totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          S={S}
        >
          下一页
        </Button>
      </div>
    </div>
  );
}
