import { useMemo, useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import type { CellValueChangedEvent, ColDef, ICellRendererParams } from 'ag-grid-community';
import { Badge, Button, Tabs } from 'antd';
import { PaperClipOutlined } from '@ant-design/icons';
import { updateCell } from '../store/formSlice';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import type { FormRow, FormTab } from '../types/forms';
import AttachmentModal from './AttachmentModal';

const fieldKeys = Array.from({ length: 10 }, (_, index) => `field${index + 1}` as keyof FormRow);

export default function FormDetailGrid() {
  const dispatch = useAppDispatch();
  const tabs = useAppSelector((state) => state.forms.current?.tabs ?? []);
  const [activeTabId, setActiveTabId] = useState<string>();
  const [activeAttachment, setActiveAttachment] = useState<{ tabId: string; rowId: string }>();

  const selectedTabId = activeTabId || tabs[0]?.id;
  const activeRow = tabs
    .find((tab) => tab.id === activeAttachment?.tabId)
    ?.rows.find((row) => row.id === activeAttachment?.rowId);

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
            <Button
              size="small"
              icon={<PaperClipOutlined />}
              onClick={() => params.data && setActiveAttachment({ tabId: params.data.tabId, rowId: params.data.id })}
            >
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
        tabId: event.data.tabId,
        rowId: event.data.id,
        field: event.colDef.field as keyof Pick<FormRow, 'field1' | 'field2' | 'field3' | 'field4' | 'field5' | 'field6' | 'field7' | 'field8' | 'field9' | 'field10'>,
        value: String(event.newValue ?? ''),
      }),
    );
  };

  return (
    <>
      <div className="detail-meta">
        <div>每個分頁都有獨立表格，第 1-10 欄可直接編輯，附件新增與刪除會暫存到按下儲存為止。</div>
      </div>
      <Tabs
        activeKey={selectedTabId}
        onChange={(key) => {
          setActiveTabId(key);
          setActiveAttachment(undefined);
        }}
        items={tabs.map((tab: FormTab) => ({
          key: tab.id,
          label: tab.name,
          children: (
            <div className="table-panel detail-grid ag-theme-quartz">
              <AgGridReact<FormRow>
                theme="legacy"
                rowData={tab.rows}
                columnDefs={columnDefs}
                defaultColDef={{ resizable: true, sortable: true, filter: true }}
                onCellValueChanged={onCellValueChanged}
                singleClickEdit
                stopEditingWhenCellsLoseFocus
              />
            </div>
          ),
        }))}
      />
      {activeRow && (
        <AttachmentModal
          tabId={activeRow.tabId}
          row={activeRow}
          open={Boolean(activeRow)}
          onClose={() => setActiveAttachment(undefined)}
        />
      )}
    </>
  );
}
