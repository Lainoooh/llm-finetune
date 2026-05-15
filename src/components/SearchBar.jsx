export function SearchBar({ value, onChange, placeholder, S }) {
  return (
    <input
      type="text"
      value={value}
      onChange={onChange}
      placeholder={placeholder || "搜索..."}
      style={{
        ...S.input,
        width: '100%',
        fontSize: 13,
      }}
    />
  );
}
