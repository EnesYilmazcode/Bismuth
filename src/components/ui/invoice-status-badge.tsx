import {
  CheckCircle2,
  AlertCircle,
  Clock,
  XCircle,
  FileX,
  CircleEllipsis,
} from 'lucide-react';

type InvoiceStatus =
  | 'paid'
  | 'draft'
  | 'open'
  | 'uncollectible'
  | 'void'
  | string;

interface InvoiceStatusBadgeProps {
  status: InvoiceStatus;
  className?: string;
}

export function InvoiceStatusBadge({
  status,
  className = '',
}: InvoiceStatusBadgeProps) {
  // Get the appropriate background, text and border color based on status
  const getStatusStyles = (status: InvoiceStatus) => {
    switch (status) {
      case 'paid':
        return 'bg-green-500/10 text-green-500 border border-green-500/20';
      case 'draft':
        return 'bg-blue-500/10 text-blue-500 border border-blue-500/20';
      case 'open':
        return 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20';
      case 'uncollectible':
        return 'bg-red-500/10 text-red-500 border border-red-500/20';
      case 'void':
        return 'bg-gray-500/10 text-gray-500 border border-gray-500/20';
      default:
        return 'bg-purple-500/10 text-purple-500 border border-purple-500/20';
    }
  };

  // Get the appropriate icon for the status
  const StatusIcon = () => {
    switch (status) {
      case 'paid':
        return <CheckCircle2 className="h-3 w-3" />;
      case 'draft':
        return <Clock className="h-3 w-3" />;
      case 'open':
        return <AlertCircle className="h-3 w-3" />;
      case 'uncollectible':
        return <XCircle className="h-3 w-3" />;
      case 'void':
        return <FileX className="h-3 w-3" />;
      default:
        return <CircleEllipsis className="h-3 w-3" />;
    }
  };

  return (
    <span
      className={`inline-flex items-center justify-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${getStatusStyles(status)} ${className}`}
    >
      <StatusIcon />
      <span>{status}</span>
    </span>
  );
}
