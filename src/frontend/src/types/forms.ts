export type FormSummary = {
  id: string;
  formNo: string;
  latestUpdater: string;
  updatedAt: string;
};

export type AttachmentStatus = 'persisted' | 'pendingUpload' | 'pendingDelete';

export type AttachmentItem = {
  id?: number;
  tempId?: string;
  attId: string;
  fileName: string;
  size: number;
  contentType: string;
  uploadedAt: string;
  uploader: string;
  status: AttachmentStatus;
};

export type FormRow = {
  id: string;
  attId?: string;
  field1: string;
  field2: string;
  field3: string;
  field4: string;
  field5: string;
  field6: string;
  field7: string;
  field8: string;
  field9: string;
  field10: string;
  attachments: AttachmentItem[];
};

export type FormDetail = FormSummary & {
  rows: FormRow[];
};

export type SaveFormPayload = {
  id: string;
  rows: FormRow[];
  deletedAttachmentIds: number[];
};
