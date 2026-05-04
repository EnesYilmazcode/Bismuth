import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Camera, Loader2 } from 'lucide-react';
import { useRef, useState } from 'react';
import Cropper from 'react-easy-crop';
import { useUploadAvatar } from '@/services/profileService';
import { useToast } from '@/hooks/use-toast';
import { UserAvatar } from '@/components/chat/UserAvatar';

export const AvatarUpdateDialog = () => {
  const { mutate: uploadAvatar, isPending: isUploadingAvatar } =
    useUploadAvatar();
  const { toast } = useToast();
  // Avatar crop state
  const [isCropOpen, setIsCropOpen] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);
  const [crop, setCrop] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<{
    width: number;
    height: number;
    x: number;
    y: number;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const objectUrl = URL.createObjectURL(file);
    setSelectedImageUrl(objectUrl);
    setIsCropOpen(true);
  };

  const onCropComplete = (
    _croppedArea: { width: number; height: number; x: number; y: number },
    croppedPixels: { width: number; height: number; x: number; y: number },
  ) => {
    setCroppedAreaPixels(croppedPixels);
  };

  async function getCroppedBlob(
    imageSrc: string,
    cropPixels: { x: number; y: number; width: number; height: number },
    outputSize = 512,
  ): Promise<Blob> {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = imageSrc;
    });

    const canvas = document.createElement('canvas');
    canvas.width = outputSize;
    canvas.height = outputSize;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas not supported');

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    ctx.drawImage(
      image,
      cropPixels.x,
      cropPixels.y,
      cropPixels.width,
      cropPixels.height,
      0,
      0,
      outputSize,
      outputSize,
    );

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Failed to create blob'));
        },
        'image/jpeg',
        0.92,
      );
    });
  }

  const handleCropCancel = () => {
    if (selectedImageUrl) URL.revokeObjectURL(selectedImageUrl);
    setSelectedImageUrl(null);
    setIsCropOpen(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCropSave = async () => {
    try {
      if (!selectedImageUrl || !croppedAreaPixels) return;
      const blob = await getCroppedBlob(
        selectedImageUrl,
        croppedAreaPixels,
        512,
      );
      const file = new File([blob], 'avatar.jpg', { type: 'image/jpeg' });

      uploadAvatar(file, {
        onSuccess: () => {
          toast({
            title: 'Profile picture updated',
            description: 'Your profile picture has been successfully updated.',
          });
        },
        onError: (error) => {
          console.error('Error uploading avatar:', error);
          toast({
            title: 'Upload failed',
            description:
              error instanceof Error
                ? error.message
                : 'Failed to upload profile picture. Please try again.',
            variant: 'destructive',
          });
        },
        onSettled: () => {
          if (selectedImageUrl) URL.revokeObjectURL(selectedImageUrl);
          setSelectedImageUrl(null);
          setIsCropOpen(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
        },
      });
    } catch (e) {
      console.error(e);
      toast({
        title: 'Crop failed',
        description: 'Unable to crop image. Please try another image.',
        variant: 'destructive',
      });
    }
  };

  return (
    <>
      <div className="relative" onClick={(e) => e.stopPropagation()}>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp"
          onChange={handleAvatarUpload}
          className="hidden"
        />
        <div
          onClick={() => fileInputRef.current?.click()}
          className="group relative cursor-pointer"
        >
          <UserAvatar className="h-9 w-9 border border-adam-neutral-700 bg-adam-neutral-950 p-0" />
          <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/60 opacity-0 transition-opacity group-hover:opacity-100">
            {isUploadingAvatar ? (
              <Loader2 className="h-4 w-4 animate-spin text-white" />
            ) : (
              <Camera className="h-4 w-4 text-white" />
            )}
          </div>
        </div>
      </div>
      <Dialog
        open={isCropOpen}
        onOpenChange={(open) =>
          open ? setIsCropOpen(true) : handleCropCancel()
        }
      >
        <DialogContent className="border-adam-neutral-800 sm:max-w-[480px] sm:rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-adam-neutral-50">
              Crop profile picture
            </DialogTitle>
          </DialogHeader>
          <div className="relative h-72 w-full overflow-hidden rounded-md bg-black/20">
            {selectedImageUrl && (
              <Cropper
                image={selectedImageUrl}
                crop={crop}
                zoom={zoom}
                aspect={1}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
                cropShape="round"
                showGrid={false}
              />
            )}
          </div>
          <div className="mt-4">
            <div className="mb-2 text-xs text-adam-neutral-200">Zoom</div>
            <Slider
              value={[zoom]}
              min={1}
              max={3}
              step={0.1}
              onValueChange={(v) => setZoom(v[0] ?? 1)}
            />
          </div>
          <DialogFooter className="grid w-full grid-cols-2 gap-5 sm:space-x-0">
            <Button
              variant="dark"
              onClick={handleCropCancel}
              className="w-full rounded-full font-light"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCropSave}
              disabled={isUploadingAvatar}
              variant="light"
              className="w-full rounded-full font-light"
            >
              {isUploadingAvatar ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </div>
              ) : (
                'Save'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
