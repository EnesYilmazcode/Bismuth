import { useProfile, useAvatarUrl } from '@/services/profileService';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getInitials } from '@/lib/utils';

export function UserAvatar({ className }: { className?: string }) {
  const { data: profile } = useProfile();
  const { data: avatarUrl } = useAvatarUrl(profile?.avatar_path);

  return (
    <Avatar className={className}>
      <AvatarImage src={avatarUrl || undefined} />
      <AvatarFallback>{getInitials(profile?.full_name || null)}</AvatarFallback>
    </Avatar>
  );
}
