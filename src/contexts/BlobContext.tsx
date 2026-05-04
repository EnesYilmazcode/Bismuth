import { createContext, useContext } from 'react';

type BlobContextType = {
  blob: Blob | null;
  setBlob: (blob: Blob | null) => void;
};

export const BlobContext = createContext<BlobContextType>({
  blob: null,
  setBlob: () => {},
});

export const useBlob = () => {
  const context = useContext(BlobContext);
  if (!context) {
    throw new Error('useBlob must be used within a BlobProvider');
  }
  return context;
};
