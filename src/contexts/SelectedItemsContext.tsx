import { MessageItem } from '../types/misc.ts';
import { createContext, Dispatch, SetStateAction, useContext } from 'react';

type SelectedItemsContextType = {
  images: MessageItem[];
  mesh: MessageItem | null;
  setImages: Dispatch<SetStateAction<MessageItem[]>>;
  setMesh: Dispatch<SetStateAction<MessageItem | null>>;
};

export const SelectedItemsContext = createContext<SelectedItemsContextType>({
  images: [],
  mesh: null,
  setImages: () => {},
  setMesh: () => {},
});

export const useSelectedItems = () => {
  const context = useContext(SelectedItemsContext);
  if (!context) {
    throw new Error(
      'useSelectedItems must be used within a SelectedItemsProvider',
    );
  }
  return context;
};
