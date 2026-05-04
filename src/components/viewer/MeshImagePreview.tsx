import { useQuery } from '@tanstack/react-query';
import { Box, Frown, HeartCrack, Loader2 } from 'lucide-react';

import { generatePreview } from '@/utils/meshUtils';
import { useMeshData } from '@/hooks/useMeshData';
import { useIsMobile } from '@/hooks/useIsMobile';
import { CreativeLoadingBar } from './CreativeLoadingBar';
import { CreativeModel } from '@shared/types';

export function MeshImagePreview({ meshId }: { meshId: string }) {
  const isMobile = useIsMobile();

  const {
    data: { data: meshData, isLoading: isMeshDataLoading },
    blob: { data: meshBlob, isLoading: isMeshLoading },
  } = useMeshData({
    id: meshId,
  });

  const { data: meshPreview, isLoading: isMeshPreviewLoading } = useQuery({
    queryKey: ['meshPreview', meshId],
    enabled: !!meshBlob,
    queryFn: async () => {
      if (!meshBlob) {
        return null;
      }

      return generatePreview(meshBlob, meshData?.file_type || 'glb');
    },
    staleTime: Infinity,
  });

  if (meshData && meshData.status === 'pending' && isMobile) {
    return (
      <CreativeLoadingBar
        modelType="mesh"
        modelName={
          (meshData?.prompt.model ?? undefined) as CreativeModel | undefined
        }
        startTime={new Date(meshData.created_at).getTime()}
        meshId={meshId}
      />
    );
  }

  if (
    isMeshDataLoading ||
    isMeshLoading ||
    isMeshPreviewLoading ||
    (meshData && meshData.status === 'pending' && !isMobile)
  ) {
    return (
      <div className="flex h-10 w-full items-center justify-between bg-adam-neutral-950 px-3 hover:bg-adam-neutral-900">
        <div className="flex h-full items-center justify-center gap-2">
          <Box className="h-4 w-4 text-white" />
          <span className="font-base text-sm text-white">3D Object</span>
        </div>
        <Loader2 className="h-4 w-4 animate-spin text-white" />
      </div>
    );
  }

  if (!meshData) {
    return (
      <div className="flex h-10 w-full items-center justify-between bg-adam-neutral-950 px-3 hover:bg-adam-neutral-900">
        <div className="flex h-full items-center justify-center gap-2">
          <Box className="h-4 w-4 text-white" />
          <span className="font-base text-sm text-white">
            3D Object Data not found
          </span>
        </div>
        <Frown className="h-4 w-4 text-white" />
      </div>
    );
  }

  if (meshData.status === 'failure') {
    return (
      <div className="flex h-10 w-full items-center justify-between bg-adam-neutral-950 px-3 hover:bg-adam-neutral-900">
        <div className="flex h-full items-center justify-center gap-2">
          <Box className="h-4 w-4 text-white" />
          <span className="font-base text-sm text-white">
            3D Object failed to generate
          </span>
        </div>
        <HeartCrack className="h-4 w-4 text-white" />
      </div>
    );
  }

  {
    /* TODO: Add a message to the user that the 3D object is not found that is better than the current message */
  }
  if (!meshBlob) {
    return (
      <div className="flex h-10 w-full items-center justify-between bg-adam-neutral-950 px-3 hover:bg-adam-neutral-900">
        <div className="flex h-full items-center justify-center gap-2">
          <Box className="h-4 w-4 text-white" />
          <span className="font-base text-sm text-white">
            3D Object not found
          </span>
        </div>
        <Frown className="h-4 w-4 text-white" />
      </div>
    );
  }

  return (
    <div>
      {meshPreview && (
        <div className="group relative aspect-square h-full w-full">
          <div className="group relative flex max-h-full w-full cursor-pointer items-center justify-center overflow-hidden rounded-t-lg">
            <img
              src={meshPreview}
              className="h-full w-full cursor-pointer object-cover"
            />
          </div>
        </div>
      )}
      <div className="flex h-10 w-full items-center gap-2 rounded-b-lg bg-black/80 px-3 hover:bg-black/60">
        <Box className="h-4 w-4 text-white" />
        <span className="font-base text-sm text-white">3D Object</span>
      </div>
    </div>
  );
}
