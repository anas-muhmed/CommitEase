'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { ChevronLeft, Loader2, CheckCircle2, Building2, User, Phone, MapPin, Hash } from 'lucide-react';
import { useSettings, useUpdateSettings } from '@/lib/hooks/useSettings';
import { useAuthStore, hasMinRole } from '@/lib/store/auth.store';

const ROLE_LABEL: Record<string, string> = {
  VIEWER: 'Viewer',
  PAYMENT_OPERATOR: 'Payment Operator',
  TREASURER: 'Treasurer',
  ADMIN: 'Admin',
};

function apiMsg(e: unknown) {
  return (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Update failed.';
}

/* ── Field ───────────────────────────────────────────────────────────────── */
function Field({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#7A9185' }}>
        {icon}
        {label}
      </label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', height: 46, borderRadius: 12,
  border: '1.5px solid #E2E8E3', background: '#F9FAFB',
  padding: '0 14px', fontSize: 14, fontWeight: 500,
  color: '#0A1C12', outline: 'none', fontFamily: 'inherit',
  boxSizing: 'border-box',
};
const readonlyStyle: React.CSSProperties = {
  ...inputStyle, background: '#F4F5F1', color: '#7A9185', cursor: 'not-allowed',
};

/* ── Page ────────────────────────────────────────────────────────────────── */
export default function SettingsPage() {
  const { data, isLoading }  = useSettings();
  const updateMutation       = useUpdateSettings();
  const committeeRole        = useAuthStore((s) => s.user?.committeeRole);
  const canEdit              = hasMinRole(committeeRole, 'ADMIN');

  const [name,         setName]         = useState('');
  const [address,      setAddress]      = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [saved,        setSaved]        = useState(false);
  const [err,          setErr]          = useState('');

  useEffect(() => {
    if (data?.masjid) {
      setName(data.masjid.name);
      setAddress(data.masjid.address ?? '');
      setContactPhone(data.masjid.contactPhone ?? '');
    }
  }, [data]);

  async function handleSave() {
    setErr('');
    setSaved(false);
    try {
      await updateMutation.mutateAsync({
        name:         name.trim() || undefined,
        address:      address.trim() || null,
        contactPhone: contactPhone.trim() || null,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setErr(apiMsg(e));
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F4F5F1' }}>
      {/* Header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 40,
        background: '#fff', borderBottom: '1px solid #E2E8E3',
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '0 20px', height: 60,
      }}>
        <Link href="/dashboard" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 36, height: 36, borderRadius: 10,
          background: '#F4F5F1', color: '#374151',
        }}>
          <ChevronLeft size={18} strokeWidth={2.2} />
        </Link>
        <div>
          <h1 style={{ fontSize: 17, fontWeight: 800, color: '#0A1C12', letterSpacing: '-0.02em', lineHeight: 1 }}>Settings</h1>
          <p style={{ fontSize: 11, color: '#7A9185', marginTop: 2 }}>Mosque configuration</p>
        </div>
      </div>

      <div style={{ padding: '20px 20px 80px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 60 }}>
            <Loader2 size={24} color="#0C6640" style={{ animation: 'spin 1s linear infinite' }} />
          </div>
        ) : (
          <>
            {/* Mosque Card */}
            <div style={{ background: '#fff', borderRadius: 20, padding: '20px 20px 24px', boxShadow: '0 1px 6px rgb(10 28 18 / 0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: '#E8F5EF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Building2 size={16} color="#0E7A52" />
                </div>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: '#0A1C12' }}>Mosque</p>
                  <p style={{ fontSize: 11, color: '#7A9185' }}>Public details</p>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <Field label="Mosque Code" icon={<Hash size={11} />}>
                  <input value={data?.masjid.code ?? ''} readOnly style={readonlyStyle} />
                </Field>

                <Field label="Mosque Name" icon={<Building2 size={11} />}>
                  <input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    readOnly={!canEdit}
                    style={canEdit ? inputStyle : readonlyStyle}
                    placeholder="e.g. Masjid Al-Noor"
                  />
                </Field>

                <Field label="Address" icon={<MapPin size={11} />}>
                  <input
                    value={address}
                    onChange={e => setAddress(e.target.value)}
                    readOnly={!canEdit}
                    style={canEdit ? inputStyle : readonlyStyle}
                    placeholder="Street, City, State"
                  />
                </Field>

                <Field label="Contact Phone" icon={<Phone size={11} />}>
                  <input
                    value={contactPhone}
                    onChange={e => setContactPhone(e.target.value)}
                    readOnly={!canEdit}
                    style={canEdit ? inputStyle : readonlyStyle}
                    placeholder="+91 98765 43210"
                  />
                </Field>
              </div>

              {canEdit && (
                <div style={{ marginTop: 20 }}>
                  {err && (
                    <p style={{ fontSize: 12, color: '#DC2626', marginBottom: 10 }}>{err}</p>
                  )}
                  {saved && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                      <CheckCircle2 size={14} color="#15803D" />
                      <p style={{ fontSize: 12, color: '#15803D', fontWeight: 600 }}>Saved successfully</p>
                    </div>
                  )}
                  <button
                    onClick={handleSave}
                    disabled={updateMutation.isPending}
                    style={{
                      width: '100%', height: 46, borderRadius: 14, border: 'none',
                      background: updateMutation.isPending ? '#7fbfa0' : '#0C6640',
                      color: '#fff', cursor: updateMutation.isPending ? 'default' : 'pointer',
                      fontFamily: 'inherit', fontSize: 14, fontWeight: 700,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    }}
                  >
                    {updateMutation.isPending && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
                    Save Changes
                  </button>
                </div>
              )}

              {!canEdit && (
                <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 16, textAlign: 'center' }}>
                  Only admins can edit mosque details.
                </p>
              )}
            </div>

            {/* My Account Card */}
            <div style={{ background: '#fff', borderRadius: 20, padding: '20px 20px 24px', boxShadow: '0 1px 6px rgb(10 28 18 / 0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <User size={16} color="#2563EB" />
                </div>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: '#0A1C12' }}>My Account</p>
                  <p style={{ fontSize: 11, color: '#7A9185' }}>Read-only</p>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <Field label="Name" icon={<User size={11} />}>
                  <input value={data?.me.name ?? ''} readOnly style={readonlyStyle} />
                </Field>
                <Field label="Username" icon={<Hash size={11} />}>
                  <input value={data?.me.username ?? ''} readOnly style={readonlyStyle} />
                </Field>
                <Field label="Role" icon={<User size={11} />}>
                  <input
                    value={data?.me.committeeRole ? (ROLE_LABEL[data.me.committeeRole] ?? data.me.committeeRole) : ''}
                    readOnly
                    style={readonlyStyle}
                  />
                </Field>
              </div>
            </div>
          </>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  );
}
