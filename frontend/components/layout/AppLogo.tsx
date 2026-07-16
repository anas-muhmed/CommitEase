import Link from 'next/link';
import Image from 'next/image';

export default function AppLogo() {
  return (
    <Link
      href="/dashboard"
      className="flex items-center gap-3 hover:opacity-90 active:opacity-75 transition-opacity select-none"
      aria-label="CommitEase home"
    >
      <Image
        src="/branding/commitease-icon.png"
        alt="CommitEase"
        width={44}
        height={44}
        className="rounded-xl shrink-0"
      />
      <div>
        <div className="flex items-baseline leading-none">
          <span className="text-[21px] font-extrabold text-[#065F46] tracking-[-0.04em]">Commit</span>
          <span className="text-[21px] font-extrabold text-[#C49A0B] tracking-[-0.04em]">Ease</span>
        </div>
        <p className="text-[8px] font-semibold text-[#9CA3AF] tracking-[0.14em] uppercase mt-[2px]">
          Simplify · Manage · Serve
        </p>
      </div>
    </Link>
  );
}
