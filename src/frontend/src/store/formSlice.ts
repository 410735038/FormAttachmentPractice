import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import dayjs from 'dayjs';
import {
  fetchAttachmentGroupFiles,
  fetchFormDetail,
  fetchForms,
  saveForm,
  seedForms,
} from '../services/api';
import type { AttachmentItem, FormDetail, FormRow, FormSummary } from '../types/forms';

const CURRENT_USER = 'test-user';
const MAX_FILE_SIZE = 10 * 1024 * 1024;

type EditableField = keyof Pick<
  FormRow,
  'field1' | 'field2' | 'field3' | 'field4' | 'field5' | 'field6' | 'field7' | 'field8' | 'field9' | 'field10'
>;

type PendingFileInput = {
  tempKey: string;
  fileName: string;
  size: number;
  contentType: string;
};

type FormState = {
  summaries: FormSummary[];
  current?: FormDetail;
  original?: FormDetail;
  attachmentsByGroupKey: Record<string, AttachmentItem[]>;
  loading: boolean;
  saving: boolean;
  error?: string;
};

const initialState: FormState = {
  summaries: [],
  attachmentsByGroupKey: {},
  loading: false,
  saving: false,
};

export const draftGroupKey = (tabId: string, rowId: string) => `draft:${tabId}:${rowId}`;

export const attachmentGroupKeyForRow = (row: Pick<FormRow, 'tabId' | 'id' | 'attachmentId'>) =>
  row.attachmentId || draftGroupKey(row.tabId, row.id);

function makePendingAttachment(file: PendingFileInput, attachmentId: string): AttachmentItem {
  return {
    tempId: file.tempKey,
    attachmentId,
    fileName: file.fileName,
    size: file.size,
    contentType: file.contentType || 'application/octet-stream',
    uploadedAt: dayjs().toISOString(),
    uploader: CURRENT_USER,
    status: 'pendingUpload',
  };
}

function findRow(current: FormDetail | undefined, tabId: string, rowId: string) {
  return current?.tabs.find((tab) => tab.id === tabId)?.rows.find((row) => row.id === rowId);
}

function makeEmptyRow(tabId: string): FormRow {
  return {
    id: `tmp-row-${crypto.randomUUID()}`,
    tabId,
    status: 'pendingCreate',
    field1: '',
    field2: '',
    field3: '',
    field4: '',
    field5: '',
    field6: '',
    field7: '',
    field8: '',
    field9: '',
    field10: '',
  };
}

export const loadForms = createAsyncThunk('forms/loadForms', fetchForms);
export const loadFormDetail = createAsyncThunk('forms/loadFormDetail', fetchFormDetail);
export const createSeedData = createAsyncThunk('forms/createSeedData', async () => {
  await seedForms();
  return fetchForms();
});

export const loadAttachmentGroup = createAsyncThunk(
  'forms/loadAttachmentGroup',
  async (attachmentId: string) => ({
    attachmentId,
    attachments: await fetchAttachmentGroupFiles(attachmentId),
  }),
);

export const commitForm = createAsyncThunk(
  'forms/commitForm',
  async ({
    payload,
    files,
    pendingUploads,
    deletedAttachmentIds,
  }: {
    payload: FormDetail;
    files: File[];
    pendingUploads: AttachmentItem[];
    deletedAttachmentIds: number[];
  }) =>
    saveForm(
      {
        id: payload.id,
        tabs: payload.tabs,
        pendingUploads,
        deletedAttachmentIds,
      },
      files,
    ),
);

const formSlice = createSlice({
  name: 'forms',
  initialState,
  reducers: {
    clearCurrentForm(state) {
      state.current = undefined;
      state.original = undefined;
      state.attachmentsByGroupKey = {};
    },
    updateCell(
      state,
      action: PayloadAction<{ tabId: string; rowId: string; field: EditableField; value: string }>,
    ) {
      const row = findRow(state.current, action.payload.tabId, action.payload.rowId);
      if (row) {
        row[action.payload.field] = action.payload.value;
      }
    },
    addDraftRow(state, action: PayloadAction<{ tabId: string }>) {
      const tab = state.current?.tabs.find((item) => item.id === action.payload.tabId);
      if (tab) {
        tab.rows.push(makeEmptyRow(action.payload.tabId));
      }
    },
    setRowAttachmentId(state, action: PayloadAction<{ tabId: string; rowId: string; attachmentId: string }>) {
      const row = findRow(state.current, action.payload.tabId, action.payload.rowId);
      if (row) {
        row.attachmentId = action.payload.attachmentId;
      }
    },
    addPendingAttachments(
      state,
      action: PayloadAction<{ groupKey: string; files: PendingFileInput[] }>,
    ) {
      const validAttachments = action.payload.files
        .filter((file) => file.size <= MAX_FILE_SIZE)
        .map((file) => makePendingAttachment(file, action.payload.groupKey));

      if (validAttachments.length === 0) return;

      state.attachmentsByGroupKey[action.payload.groupKey] = [
        ...(state.attachmentsByGroupKey[action.payload.groupKey] ?? []),
        ...validAttachments,
      ];
    },
    replaceAttachmentGroupKey(
      state,
      action: PayloadAction<{ oldGroupKey: string; newAttachmentId: string }>,
    ) {
      const existing = state.attachmentsByGroupKey[action.payload.oldGroupKey] ?? [];
      state.attachmentsByGroupKey[action.payload.newAttachmentId] = existing.map((attachment) => ({
        ...attachment,
        attachmentId: action.payload.newAttachmentId,
      }));
      delete state.attachmentsByGroupKey[action.payload.oldGroupKey];
    },
    markAttachmentDelete(state, action: PayloadAction<{ groupKey: string; attachmentKey: string }>) {
      const attachments = state.attachmentsByGroupKey[action.payload.groupKey] ?? [];
      const attachment = attachments.find(
        (item) => String(item.id ?? item.tempId) === action.payload.attachmentKey,
      );
      if (!attachment) return;

      if (attachment.status === 'pendingUpload') {
        state.attachmentsByGroupKey[action.payload.groupKey] = attachments.filter(
          (item) => String(item.id ?? item.tempId) !== action.payload.attachmentKey,
        );
        return;
      }
      attachment.status = 'pendingDelete';
    },
    undoAttachmentDelete(state, action: PayloadAction<{ groupKey: string; attachmentKey: string }>) {
      const attachment = state.attachmentsByGroupKey[action.payload.groupKey]?.find(
        (item) => String(item.id ?? item.tempId) === action.payload.attachmentKey,
      );
      if (attachment?.status === 'pendingDelete') {
        attachment.status = 'persisted';
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadForms.pending, (state) => {
        state.loading = true;
        state.error = undefined;
      })
      .addCase(loadForms.fulfilled, (state, action) => {
        state.loading = false;
        state.summaries = action.payload;
      })
      .addCase(loadForms.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      })
      .addCase(loadFormDetail.pending, (state) => {
        state.loading = true;
        state.error = undefined;
      })
      .addCase(loadFormDetail.fulfilled, (state, action) => {
        state.loading = false;
        state.current = action.payload;
        state.original = structuredClone(action.payload);
        state.attachmentsByGroupKey = {};
      })
      .addCase(loadFormDetail.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      })
      .addCase(loadAttachmentGroup.fulfilled, (state, action) => {
        const pending = (state.attachmentsByGroupKey[action.payload.attachmentId] ?? []).filter(
          (attachment) => attachment.status === 'pendingUpload',
        );
        state.attachmentsByGroupKey[action.payload.attachmentId] = [...action.payload.attachments, ...pending];
      })
      .addCase(commitForm.pending, (state) => {
        state.saving = true;
        state.error = undefined;
      })
      .addCase(commitForm.fulfilled, (state, action) => {
        state.saving = false;
        state.current = action.payload;
        state.original = structuredClone(action.payload);
        state.attachmentsByGroupKey = {};
      })
      .addCase(commitForm.rejected, (state, action) => {
        state.saving = false;
        state.error = action.error.message;
      })
      .addCase(createSeedData.fulfilled, (state, action) => {
        state.summaries = action.payload;
      });
  },
});

export const {
  addDraftRow,
  addPendingAttachments,
  clearCurrentForm,
  markAttachmentDelete,
  replaceAttachmentGroupKey,
  setRowAttachmentId,
  undoAttachmentDelete,
  updateCell,
} = formSlice.actions;

export default formSlice.reducer;
