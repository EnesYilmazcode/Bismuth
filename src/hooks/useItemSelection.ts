import { useSelectedItems } from '@/contexts/SelectedItemsContext';
import { MessageItem } from '../types/misc.ts';
import { useCallback } from 'react';

export function useItemSelection() {
  const { images, setImages, mesh, setMesh } = useSelectedItems();

  const selectItem = useCallback(
    (item: MessageItem, type: 'image' | 'mesh') => {
      if (type === 'image') {
        if (images.some((image) => image.id === item.id)) {
          const newSelectedImages = images.filter(
            (image) => image.id !== item.id,
          );
          setImages(newSelectedImages);
        } else {
          const newSelectedImages = [...images, item];
          setImages(newSelectedImages);
        }
      } else {
        // For meshes, we just toggle the selection
        setMesh(mesh?.id === item.id ? null : item);
      }
    },
    [images, mesh, setImages, setMesh],
  );

  return {
    images,
    mesh,
    selectItem,
    setImages,
    setMesh,
  };
}
