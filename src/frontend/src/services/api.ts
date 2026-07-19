import type { FormDetail, FormSummary, SaveFormPayload } from '../types/forms';

const jsonHeaders = { 'Content-Type': 'application/json' };

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export async function fetchForms(): Promise<FormSummary[]> {
  return parseResponse<FormSummary[]>(await fetch('/api/forms'));
}

export async function fetchFormDetail(formId: string): Promise<FormDetail> {
  return parseResponse<FormDetail>(await fetch(`/api/forms/${formId}`));
}

export async function saveForm(payload: SaveFormPayload, files: File[]): Promise<FormDetail> {
  const formData = new FormData();
  formData.append('payload', JSON.stringify(payload));
  files.forEach((file) => formData.append('files', file));

  return parseResponse<FormDetail>(
    await fetch(`/api/forms/${payload.id}/save`, {
      method: 'POST',
      body: formData,
    }),
  );
}

export async function seedForms(): Promise<void> {
  const response = await fetch('/api/dev/seed', { method: 'POST', headers: jsonHeaders });
  if (!response.ok) {
    throw new Error(await response.text());
  }
}

export function attachmentDownloadUrl(attachmentId: number): string {
  return `/api/attachments/${attachmentId}/download`;
}
