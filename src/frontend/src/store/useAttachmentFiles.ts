import { useContext } from 'react';
import { AttachmentFileContext } from './attachmentFileContext';

export function useAttachmentFiles() {
  const value = useContext(AttachmentFileContext);
  if (!value) {
    throw new Error('useAttachmentFiles must be used inside AttachmentFileProvider');
  }
  return value;
}
