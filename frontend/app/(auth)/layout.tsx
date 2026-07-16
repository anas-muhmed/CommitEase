export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ background: '#F4F5F1' }}
    >
      {children}
    </div>
  );
}
