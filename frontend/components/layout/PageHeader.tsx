import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  backHref?: string;
  action?: React.ReactNode;
  className?: string;
}

export default function PageHeader({ title, backHref, action, className }: PageHeaderProps) {
  return (
    <header
      className={cn(
        'sticky top-0 z-40 flex h-14 items-center gap-2 bg-background/95 backdrop-blur border-b border-border px-4',
        className,
      )}
    >
      {backHref && (
        <Link
          href={backHref}
          className="flex items-center justify-center size-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors -ml-1"
          aria-label="Go back"
        >
          <ChevronLeft className="size-5" />
        </Link>
      )}
      <h1 className="flex-1 text-base font-semibold truncate">{title}</h1>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}
