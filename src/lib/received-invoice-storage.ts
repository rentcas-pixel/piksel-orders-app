import { supabase } from '@/lib/supabase';

export function extractFilesBucketPath(fileUrl: string): string | null {
  try {
    const url = new URL(fileUrl);
    const pathname = decodeURIComponent(url.pathname);

    const markers = [
      '/storage/v1/object/public/files/',
      '/storage/v1/object/sign/files/',
      '/storage/v1/object/authenticated/files/',
      '/storage/v1/object/files/',
    ];

    for (const marker of markers) {
      const index = pathname.indexOf(marker);
      if (index >= 0) {
        const path = pathname.slice(index + marker.length).split('?')[0];
        return path || null;
      }
    }

    const parts = pathname.split('/');
    const bucketIndex = parts.findIndex((part) => part === 'files');
    if (bucketIndex >= 0) {
      const path = parts.slice(bucketIndex + 1).join('/');
      return path || null;
    }
  } catch {
    return null;
  }

  return null;
}

export async function loadReceivedInvoiceFileBytes(fileUrl: string): Promise<ArrayBuffer> {
  const storagePath = extractFilesBucketPath(fileUrl);
  if (storagePath) {
    const { data, error } = await supabase.storage.from('files').download(storagePath);
    if (!error && data) {
      return data.arrayBuffer();
    }

    const signed = await supabase.storage.from('files').createSignedUrl(storagePath, 120);
    if (signed.data?.signedUrl) {
      const signedResponse = await fetch(signed.data.signedUrl);
      if (signedResponse.ok) {
        return signedResponse.arrayBuffer();
      }
    }
  }

  const response = await fetch(fileUrl, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Nepavyko atsisiųsti failo (${response.status}).`);
  }

  return response.arrayBuffer();
}
