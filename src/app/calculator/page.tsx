'use client';

import { useEffect } from 'react';

/** Skaičiuoklė startuoja iš test orderių. */
export default function CalculatorNewPage() {
  useEffect(() => {
    window.location.replace('/test-orders');
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 text-gray-600">
      Atidaromi test orderiai…
    </div>
  );
}
