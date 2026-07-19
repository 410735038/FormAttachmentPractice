import { useMemo, useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import type { CellValueChangedEvent, ColDef, ICellRendererParams } from 'ag-grid-community';
import { Badge, Button } from 'antd';
import { PaperClipOutlined } from '@ant-design/icons';
import { updateCell } from '../store/formSlice';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import type { FormRow } from '../types/forms';
import AttachmentModal from './AttachmentModal';

const fieldKeys = Array.from({ length: 10 }, (_, index) => `field${index + 1}` as keyof FormRow);

export default function FormDetailGrid() {
  const dispatch = useAppDispatch();
  const rows = useAppSelector((state) => state.forms.current?.rows ?? []);
  const [activeRowId, setActiveRowId] = useState<string>();

  const activeRow = rows.find((row) => row.id === activeRowId);

  const columnDefs = useMemo<ColDef<FormRow>[]>(
    () => [
      ...fieldKeys.map((field, index) => ({
        field,
        headerName: `欄位${index + 1}`,
        editable: true,
        minWidth: 130,
      })),
      {
        field: 'attachments',
        headerName: '附件',
        minWidth: 190,
        pinned: 'right',
        editable: false,
        cellRenderer: (params: ICellRendererParams<FormRow>) => {
          const count =
            params.data?.attachments.filter((attachment) => attachment.status !== 'pendingDelete').length ?? 0;
          return (
            <Button size="small" icon={<PaperClipOutlined />} onClick={() => params.data && setActiveRowId(params.data.id)}>
              {count > 0 ? <Badge count={count} size="small" offset={[8, -2]}>此筆有上傳檔案</Badge> : '附件'}
            </Button>
          );
        },
      },
    ],
    [],
  );

  const onCellValueChanged = (event: CellValueChangedEvent<FormRow>) => {
    if (!event.data || event.colDef.field === 'attachments') return;
    dispatch(
      updateCell({
        rowId: event.data.id,
        field: event.colDef.field as keyof Pick<FormRow, 'field1' | 'field2' | 'field3' | 'field4' | 'field5' | 'field6' | 'field7' | 'field8' | 'field9' | 'field10'>,
        value: String(event.newValue ?? ''),
      }),
    );
  };

  return (
    <>
      <div className="detail-meta">
        <div>第 1-10 欄可直接編輯，附件欄的新增與刪除會暫存到按下儲存為止。</div>
      </div>
      <div className="table-panel detail-grid ag-theme-quartz">
        <AgGridReact<FormRow>
          theme="legacy"
          rowData={rows}
          columnDefs={columnDefs}
          defaultColDef={{ resizable: true, sortable: true, filter: true }}
          onCellValueChanged={onCellValueChanged}
          singleClickEdit
          stopEditingWhenCellsLoseFocus
        />
      </div>
      {activeRow && <AttachmentModal row={activeRow} open={Boolean(activeRow)} onClose={() => setActiveRowId(undefined)} />}
    </>
  );
}
