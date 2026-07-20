import { createAsyncThunk, createSlice, nanoid, type PayloadAction } from '@reduxjs/toolkit';
import dayjs from 'dayjs';
import { fetchFormDetail, fetchForms, saveForm, seedForms } from '../services/api';
import type { AttachmentItem, FormDetail, FormRow, FormSummary } from '../types/forms';

const CURRENT_USER = 'test-user';
const MAX_FILE_SIZE = 10 * 1024 * 1024;

type FormState = {
  summaries: FormSummary[];
  current?: FormDetail;
  original?: FormDetail;
  deletedAttachmentIds: number[];
  loading: boolean;
  saving: boolean;
  error?: string;
};

const initialState: FormState = {
  summaries: [],
  deletedAttachmentIds: [],
  loading: false,
  saving: false,
};

export const loadForms = createAsyncThunk('forms/loadForms', fetchForms);
export const loadFormDetail = createAsyncThunk('forms/loadFormDetail', fetchFormDetail);
export const createSeedData = createAsyncThunk('forms/createSeedData', async () => {
  await seedForms();
  return fetchForms();
});

export const commitForm = createAsyncThunk(
  'forms/commitForm',
  async ({ payload, files }: { payload: FormDetail; files: File[] }) =>
    saveForm(
      {
        id: payload.id,
        tabs: payload.tabs,
        deletedAttachmentIds: payload.tabs
          .flatMap((tab) => tab.rows)
          .flatMap((row) => row.attachments)
          .filter((attachment) => attachment.status === 'pendingDelete' && attachment.id)
          .map((attachment) => attachment.id as number),
      },
      files,
    ),
);

function ensureAttId(row: FormRow): string {
  return row.attId || `att-${crypto.randomUUID()}`;
}

type PendingFileInput = {
  tempKey: string;
  fileName: string;
  size: number;
  contentType: string;
};

function makePendingAttachment(file: PendingFileInput, attId: string): AttachmentItem {
  return {
    tempId: nanoid(),
    attId,
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

const formSlice = createSlice({
  name: 'forms',
  initialState,
  reducers: {
    clearCurrentForm(state) {
      state.current = undefined;
      state.original = undefined;
      state.deletedAttachmentIds = [];
    },
    updateCell(
      state,
      action: PayloadAction<{ tabId: string; rowId: string; field: keyof Pick<FormRow, 'field1' | 'field2' | 'field3' | 'field4' | 'field5' | 'field6' | 'field7' | 'field8' | 'field9' | 'field10'>; value: string }>,
    ) {
      const row = findRow(state.current, action.payload.tabId, action.payload.rowId);
      if (row) {
        row[action.payload.field] = action.payload.value;
      }
    },
    addPendingAttachments(
      state,
      action: PayloadAction<{ tabId: string; rowId: string; files: PendingFileInput[] }>,
    ) {
      const row = findRow(state.current, action.payload.tabId, action.payload.rowId);
      if (!row) return;

      const validFiles = action.payload.files
        .filter((file) => file.size <= MAX_FILE_SIZE)
        .map((file) => ({
          tempKey: file.tempKey,
          attachment: makePendingAttachment(file, ensureAttId(row)),
        }));

      if (validFiles.length === 0) return;

      row.attId = validFiles[0].attachment.attId;
      row.attachments.push(
        ...validFiles.map(({ tempKey, attachment }) => ({
          ...attachment,
          tempId: tempKey,
        })),
      );
    },
    markAttachmentDelete(state, action: PayloadAction<{ tabId: string; rowId: string; attachmentKey: string }>) {
      const row = findRow(state.current, action.payload.tabId, action.payload.rowId);
      const attachment = row?.attachments.find(
        (item) => String(item.id ?? item.tempId) === action.payload.attachmentKey,
      );
      if (!attachment) return;

      if (attachment.status === 'pendingUpload') {
        row!.attachments = row!.attachments.filter(
          (item) => String(item.id ?? item.tempId) !== action.payload.attachmentKey,
        );
        return;
      }
      attachment.status = 'pendingDelete';
    },
    undoAttachmentDelete(state, action: PayloadAction<{ tabId: string; rowId: string; attachmentKey: string }>) {
      const row = findRow(state.current, action.payload.tabId, action.payload.rowId);
      const attachment = row?.attachments.find(
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
        state.deletedAttachmentIds = [];
      })
      .addCase(loadFormDetail.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      })
      .addCase(commitForm.pending, (state) => {
        state.saving = true;
        state.error = undefined;
      })
      .addCase(commitForm.fulfilled, (state, action) => {
        state.saving = false;
        state.current = action.payload;
        state.original = structuredClone(action.payload);
        state.deletedAttachmentIds = [];
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
  addPendingAttachments,
  clearCurrentForm,
  markAttachmentDelete,
  undoAttachmentDelete,
  updateCell,
} = formSlice.actions;

export default formSlice.reducer;
