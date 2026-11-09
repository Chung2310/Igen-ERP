export function ErpTableHead({ columns }: { columns: string[] }) {
  return (
    <thead>
      <tr className="border-b border-outline-variant bg-surface-container-low text-xs font-medium text-on-surface-variant">
        {columns.map((column) => (
          <th key={column} scope="col" className="px-4 py-2.5 text-left font-medium text-on-surface-variant">{column}</th>
        ))}
      </tr>
    </thead>
  );
}
