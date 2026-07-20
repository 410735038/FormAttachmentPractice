import { useCallback, useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import type { ColDef, ICellRendererParams } from 'ag-grid-community';
import { Button, Modal, Space, Tag, Upload, message } from 'antd';
import { DeleteOutlined, DownloadOutlined, InboxOutlined, RollbackOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { attachmentDownloadUrl } from '../services/api';
import { addPendingAttachments, markAttachmentDelete, undoAttachmentDelete } from '../store/formSlice';
import { useAttachmentFiles } from '../store/useAttachmentFiles';
import { useAppDispatch } from '../store/hooks';
import type { AttachmentItem, FormRow } from '../types/forms';

const MAX_FILE_SIZE = 10 * 1024 * 1024;

type Props = {
  tabId: string;
  row: FormRow;
  open: boolean;
  onClose: () => void;
};

export default function AttachmentModal({ tabId, row, open, onClose }: Props) {
  const dispatch = useAppDispatch();
  const { putFiles, getFile, removeFile } = useAttachmentFiles();
  const [messageApi, contextHolder] = message.useMessage();

  const downloadAttachment = useCallback((attachment: AttachmentItem) => {
    if (attachment.status === 'pendingUpload' && attachment.tempId) {
      const file = getFile(attachment.tempId);
      if (!file) {
        messageApi.error('暫存檔案不存在');
        return;
      }
      const url = URL.createObjectURL(file);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = attachment.fileName;
      anchor.click();
      URL.revokeObjectURL(url);
      return;
    }

    if (attachment.id) {
      window.open(attachmentDownloadUrl(attachment.id), '_blank', 'noopener,noreferrer');
    }
  }, [getFile, messageApi]);

  const columnDefs = useMemo<ColDef<AttachmentItem>[]>(
    () => [
      { field: 'fileName', headerName: '檔名', flex: 1, minWidth: 210 },
      {
        field: 'uploadedAt',
        headerName: '時間',
        minWidth: 180,
        valueFormatter: ({ value }) => dayjs(value).format('YYYY-MM-DD HH:mm:ss'),
      },
      { field: 'uploader', headerName: '上傳者', width: 130 },
      {
        field: 'status',
        headerName: '狀態',
        width: 130,
        cellRenderer: (params: ICellRendererParams<AttachmentItem>) => {
          if (params.value === 'pendingUpload') return <Tag color="green">待上傳</Tag>;
          if (params.value === 'pendingDelete') return <Tag color="orange">待刪除</Tag>;
          return <Tag>已儲存</Tag>;
        },
      },
      {
        headerName: 'Action',
        width: 190,
        cellRenderer: (params: ICellRendererParams<AttachmentItem>) => {
          const attachment = params.data;
          if (!attachment) return null;
          const key = String(attachment.id ?? attachment.tempId);
          return (
            <Space size={6}>
              <Button size="small" icon={<DownloadOutlined />} onClick={() => downloadAttachment(attachment)} />
              {attachment.status === 'pendingDelete' ? (
                <Button
                  size="small"
                  icon={<RollbackOutlined />}
                  onClick={() => dispatch(undoAttachmentDelete({ tabId, rowId: row.id, attachmentKey: key }))}
                >
                  取消刪除
                </Button>
              ) : (
                <Button
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => {
                    if (attachment.status === 'pendingUpload' && attachment.tempId) {
                      removeFile(attachment.tempId);
                    }
                    dispatch(markAttachmentDelete({ tabId, rowId: row.id, attachmentKey: key }));
                  }}
                />
              )}
            </Space>
          );
        },
      },
    ],
    [dispatch, downloadAttachment, removeFile, row.id, tabId],
  );

  return (
    <Modal title={`附件 - ${row.id}`} open={open} onCancel={onClose} footer={null} width={880} destroyOnClose>
      {contextHolder}
      <Upload.Dragger
        multiple
        showUploadList={false}
        beforeUpload={(file) => {
          if (file.size > MAX_FILE_SIZE) {
            messageApi.warning('單檔最大 10MB，超過的檔案已略過。');
            return Upload.LIST_IGNORE;
          }
          const stored = putFiles([file]);
          dispatch(
            addPendingAttachments({
              tabId,
              rowId: row.id,
              files: stored.map(({ tempKey, file }) => ({
                tempKey,
                fileName: file.name,
                size: file.size,
                contentType: file.type || 'application/octet-stream',
              })),
            }),
          );
          return false;
        }}
      >
        <p className="ant-upload-drag-icon">
          <InboxOutlined />
        </p>
        <p className="ant-upload-text">點選或拖曳檔案到這裡</p>
      </Upload.Dragger>
      <div className="attachment-grid ag-theme-quartz">
        <AgGridReact<AttachmentItem>
          theme="legacy"
          rowData={row.attachments}
          columnDefs={columnDefs}
          defaultColDef={{ resizable: true, sortable: true }}
          domLayout="autoHeight"
        />
      </div>
    </Modal>
  );
}
