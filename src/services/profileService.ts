import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Profile } from '@shared/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export function useProfile() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user?.id || '')
        .single();

      if (error) throw error;

      if (!data) {
        throw new Error('Profile not found');
      }

      return data;
    },
    enabled: !!user?.id,
  });
}

export function useAvatarUrl(avatarPath: string | null | undefined) {
  return useQuery({
    queryKey: ['avatar-url', avatarPath],
    queryFn: async () => {
      if (!avatarPath) return null;

      // Download the file to get a blob URL that's cached by React Query
      const { data, error } = await supabase.storage
        .from('images')
        .download(avatarPath);

      if (error) throw error;
      if (!data) return null;

      // Create a blob URL from the downloaded data
      return URL.createObjectURL(data);
    },
    enabled: !!avatarPath,
    staleTime: 1000 * 60 * 60 * 24, // Cache for 24 hours
    gcTime: 1000 * 60 * 60 * 24 * 7, // Keep in cache for 7 days
  });
}

export function useUpdateProfile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (profile: Partial<Profile>) => {
      const { data, error } = await supabase
        .from('profiles')
        .update({
          ...(profile.full_name && { full_name: profile.full_name }),
          ...(profile.avatar_path && { avatar_path: profile.avatar_path }),
          ...(profile.notifications_enabled !== undefined && {
            notifications_enabled: profile.notifications_enabled,
          }),
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user?.id || '')
        .select()
        .single();

      if (error) throw error;

      return data;
    },
    onSuccess: (data) => {
      if (data) {
        queryClient.setQueryData(['profile', user?.id], data);
      }
    },
  });
}

export function useUploadAvatar() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (file: File) => {
      if (!user) throw new Error('User not authenticated');

      // Validate file type
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (!validTypes.includes(file.type)) {
        throw new Error(
          'Invalid file type. Please upload a JPEG, PNG, or WebP image.',
        );
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        throw new Error(
          'File too large. Please upload an image smaller than 5MB.',
        );
      }

      // Upload image with upsert to automatically replace existing
      const filePath = `${user.id}/profile`;

      const { error: uploadError } = await supabase.storage
        .from('images')
        .upload(filePath, file, {
          upsert: true,
          contentType: file.type,
        });

      if (uploadError) throw uploadError;

      // Update profile with avatar path
      const { data, error: updateError } = await supabase
        .from('profiles')
        .update({
          avatar_path: filePath,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id)
        .select()
        .single();

      if (updateError) throw updateError;

      return data;
    },
    onSuccess: (data) => {
      if (data) {
        // Update profile cache
        queryClient.setQueryData(['profile', user?.id], data);
        // Invalidate avatar URL cache to fetch new image
        queryClient.invalidateQueries({
          queryKey: ['avatar-url', data.avatar_path],
        });
      }
    },
  });
}
