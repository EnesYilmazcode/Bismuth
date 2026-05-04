import { Button } from '@/components/ui/button';
import { ClipboardCheck, CopyIcon, Loader2 } from 'lucide-react';
import { useConversation } from '@/contexts/ConversationContext';
import { useRef, useState } from 'react';
import {
  FacebookIcon,
  TwitterIcon,
  WhatsAppIcon,
} from '@/components/icons/CompanyIcons';
import {
  handleFacebookShare,
  handleTwitterShare,
  handleWhatsAppShare,
} from '@/utils/shareUtils';
import { MeshGifPreview } from '../viewer/MeshGifPreview';
import { cn } from '@/lib/utils';
import { useCurrentMessage } from '@/contexts/CurrentMessageContext';

export function ShareContent() {
  const { currentMessage } = useCurrentMessage();
  const { conversation, updateConversation } = useConversation();
  const [justCopied, setJustCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [readyToDownload, setReadyToDownload] = useState(false);

  const downloadGifRef = useRef<{ downloadGIF: () => Promise<void> } | null>(
    null,
  );

  const downloadGIF = () => {
    downloadGifRef.current?.downloadGIF();
  };

  function handleChangePrivacy(privacy: 'public' | 'private') {
    updateConversation?.({
      ...conversation,
      privacy,
    });
  }

  const handlePublicClick = () => {
    handleChangePrivacy('public');
    copyToClipboard();
  };

  const shareLink = `${window.location.origin}${import.meta.env.BASE_URL}/share/${conversation.id}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(shareLink);
    setJustCopied(true);
    setTimeout(() => {
      setJustCopied(false);
    }, 2000);
  };

  const isPublic = conversation.privacy === 'public';

  if (!updateConversation) return null;

  return (
    <div className="flex w-full flex-col">
      <div className="flex flex-col gap-6">
        <div className="h-5 font-medium text-adam-neutral-100">
          Share public link to chat
        </div>
        <div className="flex items-center gap-3 text-xs text-adam-text-secondary">
          {conversation.privacy === 'public' && (
            <div className="ml-1 h-1 w-1 rounded-full bg-[#64D557] outline outline-4 outline-[#79FF6B]/30" />
          )}
          {conversation.privacy !== 'public' && (
            <div className="h-3 w-3 rounded-full bg-[#FF392F] outline outline-2 outline-[#FF0000]/30" />
          )}
          {conversation.privacy === 'public'
            ? 'Anyone with the link can view'
            : 'Only you can view'}
        </div>
        {currentMessage?.content?.mesh && (
          <MeshGifPreview
            ref={downloadGifRef}
            meshId={currentMessage.content.mesh.id}
            setIsGenerating={setIsGenerating}
            setProgress={setProgress}
            setReadyToDownload={setReadyToDownload}
          />
        )}
        <div
          className={cn(
            'flex w-full flex-col gap-6 overflow-hidden transition-all duration-300 ease-in-out',
            isPublic && 'h-44 opacity-100',
            !isPublic && 'h-0 opacity-0',
          )}
        >
          <div className="flex w-full items-center justify-between gap-4 rounded-full bg-adam-neutral-950 py-2 pl-6 pr-3">
            <span className="line-clamp-1 text-sm text-adam-neutral-100">
              {shareLink}
            </span>
            <button
              onClick={copyToClipboard}
              className="flex items-center gap-2 rounded-full border-2 border-black bg-white px-4 py-2 text-sm font-medium text-black focus:outline-none"
            >
              {justCopied ? (
                <ClipboardCheck className="h-4 w-4" />
              ) : (
                <CopyIcon className="h-4 w-4" />
              )}
              {justCopied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <div className="grid w-full grid-cols-3 justify-between text-adam-neutral-300">
            <div className="flex flex-col items-center gap-2">
              <button
                onClick={() => handleWhatsAppShare(conversation.id)}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-adam-neutral-950 text-adam-neutral-100"
              >
                <WhatsAppIcon className="h-5 w-5" />
              </button>
              <span className="text-xs">WhatsApp</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <button
                onClick={() => handleTwitterShare(conversation.id)}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-adam-neutral-950 text-adam-neutral-100"
              >
                <TwitterIcon className="h-5 w-5" />
              </button>
              <span className="text-xs">X</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <button
                onClick={() => handleFacebookShare(conversation.id)}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-adam-neutral-950 text-adam-neutral-100"
              >
                <FacebookIcon className="h-5 w-5" />
              </button>
              <span className="text-xs">Facebook</span>
            </div>
          </div>
        </div>
      </div>
      <div className="flex w-full flex-col gap-2">
        {readyToDownload && (
          <Button
            onClick={downloadGIF}
            disabled={isGenerating}
            className="relative overflow-hidden disabled:opacity-100"
            variant="light"
            style={
              isGenerating
                ? {
                    background: `linear-gradient(90deg, #CCCCCC ${progress * 100}%, #FFFFFF ${progress * 100}%)`,
                  }
                : undefined
            }
          >
            {isGenerating ? (
              <div className="flex items-center gap-2">
                Generating...
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            ) : (
              'Download GIF'
            )}
          </Button>
        )}
        {conversation.privacy === 'public' ? (
          <Button
            variant="destructive"
            onClick={() => handleChangePrivacy('private')}
          >
            Make Private
          </Button>
        ) : (
          <Button variant="light" onClick={handlePublicClick}>
            Share
          </Button>
        )}
      </div>
    </div>
  );
}
