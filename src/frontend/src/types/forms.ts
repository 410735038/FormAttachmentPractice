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
  attachmentId: string;
  fileName: string;
  size: number;
  contentType: string;
  uploadedAt: string;
  uploader: string;
  status: AttachmentStatus;
};

export type FormRow = {
  id: string;
  tabId: string;
  status?: 'persisted' | 'pendingCreate';
  attachmentId?: string;
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
};

export type FormTab = {
  id: string;
  name: string;
  rows: FormRow[];
};

export type FormDetail = FormSummary & {
  tabs: FormTab[];
};

export type SaveFormPayload = {
  id: string;
  tabs: FormTab[];
  pendingUploads: AttachmentItem[];
  deletedAttachmentIds: number[];
};

export type AttachmentGroupResponse = {
  attachmentId: string;
};
