import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Agentūrų portalas — Piksel',
  description: 'Agentūrų kampanijų peržiūra (prototipas)',
};

export default function AgencyLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
