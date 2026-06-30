'use client';

interface AgencyPhotoPanelProps {
  url: string | null;
}

export function AgencyPhotoPanel({ url }: AgencyPhotoPanelProps) {
  if (!url) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Photo Proof šiai agentūrai dar nesukonfigūruotas.
      </p>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden shadow-sm">
      <iframe
        src={url}
        title="Photo Proof"
        className="w-full border-0 bg-white"
        style={{ minHeight: 'calc(100vh - 12rem)' }}
      />
    </div>
  );
}
