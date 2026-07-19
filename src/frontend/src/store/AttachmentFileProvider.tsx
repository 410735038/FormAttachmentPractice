import { useCallback, useMemo, useRef, type ReactNode } from 'react';
import { AttachmentFileContext } from './attachmentFileContext';

export function AttachmentFileProvider({ children }: { children: ReactNode }) {
  const fileMapRef = useRef(new Map<string, File>());

  const putFiles = useCallback((files: File[]) => {
    return files.map((file) => {
      const tempKey = `tmp-${crypto.randomUUID()}`;
      fileMapRef.current.set(tempKey, file);
      return { tempKey, file };
    });
  }, []);

  const getFile = useCallback((tempKey: string) => fileMapRef.current.get(tempKey), []);
  const removeFile = useCallback((tempKey: string) => fileMapRef.current.delete(tempKey), []);
  const collectFiles = useCallback(
    (tempKeys: string[]) =>
      tempKeys
        .map((tempKey) => fileMapRef.current.get(tempKey))
        .filter((file): file is File => Boolean(file)),
    [],
  );
  const clearFiles = useCallback(() => fileMapRef.current.clear(), []);

  const value = useMemo(
    () => ({ putFiles, getFile, removeFile, collectFiles, clearFiles }),
    [clearFiles, collectFiles, getFile, putFiles, removeFile],
  );

  return <AttachmentFileContext.Provider value={value}>{children}</AttachmentFileContext.Provider>;
}
