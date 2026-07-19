import { AgGridReact } from 'ag-grid-react';
import type { ColDef, ICellRendererParams } from 'ag-grid-community';
import type { FormSummary } from '../types/forms';

type Props = {
  forms: FormSummary[];
  onOpen: (form: FormSummary) => void;
};

export default function FormList({ forms, onOpen }: Props) {
  const columnDefs: ColDef<FormSummary>[] = [
    {
      field: 'formNo',
      headerName: '單號',
      flex: 1,
      minWidth: 180,
      cellRenderer: (params: ICellRendererParams<FormSummary>) => (
        <button className="link-button" onClick={() => params.data && onOpen(params.data)}>
          {params.value}
        </button>
      ),
    },
    { field: 'latestUpdater', headerName: '最新更新者', width: 160 },
    { field: 'updatedAt', headerName: '更新時間', flex: 1, minWidth: 220 },
  ];

  return (
    <div className="table-panel ag-theme-quartz">
      <AgGridReact<FormSummary>
        theme="legacy"
        rowData={forms}
        columnDefs={columnDefs}
        defaultColDef={{ resizable: true, sortable: true, filter: true }}
        domLayout="autoHeight"
      />
    </div>
  );
}
