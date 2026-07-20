import { useEffect, useMemo, useState } from 'react';
import { Button, Modal, Spin, message } from 'antd';
import { ArrowLeftOutlined, DatabaseOutlined, SaveOutlined } from '@ant-design/icons';
import {
  clearCurrentForm,
  commitForm,
  createSeedData,
  loadFormDetail,
  loadForms,
} from './store/formSlice';
import { useAppDispatch, useAppSelector } from './store/hooks';
import { useAttachmentFiles } from './store/useAttachmentFiles';
import FormList from './components/FormList';
import FormDetailGrid from './components/FormDetailGrid';
import type { FormSummary } from './types/forms';

function hasUnsavedChanges(current: unknown, original: unknown) {
  return JSON.stringify(current) !== JSON.stringify(original);
}

export default function App() {
  const dispatch = useAppDispatch();
  const { collectFiles, clearFiles } = useAttachmentFiles();
  const { summaries, current, original, loading, saving, error } = useAppSelector((state) => state.forms);
  const [messageApi, contextHolder] = message.useMessage();
  const [modalApi, modalHolder] = Modal.useModal();
  const [selectedFormId, setSelectedFormId] = useState<string>();

  const dirty = useMemo(() => Boolean(current && original && hasUnsavedChanges(current, original)), [current, original]);

  useEffect(() => {
    dispatch(loadForms());
  }, [dispatch]);

  useEffect(() => {
    if (error) messageApi.error(error);
  }, [error, messageApi]);

  const openForm = (summary: FormSummary) => {
    const load = () => {
      setSelectedFormId(summary.id);
      clearFiles();
      dispatch(loadFormDetail(summary.id));
    };

    if (dirty) {
      modalApi.confirm({
        title: '離開目前表單？',
        content: '尚未儲存的欄位與附件異動都會被清除。',
        okText: '確定離開',
        cancelText: '取消',
        onOk: load,
      });
      return;
    }
    load();
  };

  const backToList = () => {
    const leave = () => {
      setSelectedFormId(undefined);
      clearFiles();
      dispatch(clearCurrentForm());
    };

    if (dirty) {
      modalApi.confirm({
        title: '回到表單清單？',
        content: '尚未儲存的暫存資料會被清除。',
        okText: '確定離開',
        cancelText: '取消',
        onOk: leave,
      });
      return;
    }
    leave();
  };

  const saveCurrent = async () => {
    if (!current) return;
    const tempKeys = current.tabs
      .flatMap((tab) => tab.rows)
      .flatMap((row) => row.attachments)
      .filter((attachment) => attachment.status === 'pendingUpload' && attachment.tempId)
      .map((attachment) => attachment.tempId as string);

    try {
      const result = await dispatch(commitForm({ payload: current, files: collectFiles(tempKeys) })).unwrap();
      clearFiles();
      setSelectedFormId(result.id);
      await dispatch(loadForms());
      messageApi.success('表單已儲存');
    } catch (saveError) {
      messageApi.error(saveError instanceof Error ? saveError.message : '儲存失敗');
    }
  };

  const seed = async () => {
    await dispatch(createSeedData());
    messageApi.success('已建立範例資料');
  };

  return (
    <div className="app-shell">
      {contextHolder}
      {modalHolder}
      <aside className="sidebar">
        <div className="brand-mark">FA</div>
        <div>
          <h1>Form Attachment Practice</h1>
          <p>表單附件暫存練習</p>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div>
            <div className="eyeline">{selectedFormId ? '表單明細' : '表單清單'}</div>
            <h2>{current ? current.formNo : '所有表單'}</h2>
          </div>
          <div className="toolbar">
            {current ? (
              <>
                <Button icon={<ArrowLeftOutlined />} onClick={backToList}>
                  返回
                </Button>
                <Button type="primary" icon={<SaveOutlined />} loading={saving} disabled={!dirty} onClick={saveCurrent}>
                  儲存
                </Button>
              </>
            ) : (
              <Button icon={<DatabaseOutlined />} onClick={seed}>
                建立範例資料
              </Button>
            )}
          </div>
        </header>

        <section className="content-zone">
          {loading && !current ? (
            <div className="loading-state">
              <Spin />
            </div>
          ) : current ? (
            <FormDetailGrid />
          ) : (
            <FormList forms={summaries} onOpen={openForm} />
          )}
        </section>
      </main>
    </div>
  );
}
