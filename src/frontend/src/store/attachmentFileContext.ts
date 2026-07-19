import { createContext } from 'react';

export type AttachmentFileStore = {
  putFiles: (files: File[]) => { tempKey: string; file: File }[];
  getFile: (tempKey: string) => File | undefined;
  removeFile: (tempKey: string) => void;
  collectFiles: (tempKeys: string[]) => File[];
  clearFiles: () => void;
};

export const AttachmentFileContext = createContext<AttachmentFileStore | null>(null);
