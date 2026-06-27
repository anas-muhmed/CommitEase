import { redirect } from 'next/navigation';

export default async function RecordPaymentRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/payments?member=${id}`);
}
