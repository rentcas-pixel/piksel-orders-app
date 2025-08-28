'use client';

import { useState } from 'react';
import { config } from '@/config';

export default function TestPocketBase() {
  const [status, setStatus] = useState<string>('Testing...');
  const [data, setData] = useState<{ items?: unknown[]; totalItems?: number; totalPages?: number } | null>(null);

  const testPocketBase = async () => {
    try {
      setStatus('Testing PocketBase connection...');
      
      const url = `${config.pocketbase.url}/api/collections/${config.pocketbase.collection}/records?perPage=1`;
      console.log('Testing URL:', url);
      
      const response = await fetch(url);
      console.log('Response status:', response.status);
      console.log('Response headers:', response.headers);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log('Response data:', result);
      
      setData(result);
      setStatus('✅ PocketBase connection successful!');
    } catch (error) {
      console.error('PocketBase test failed:', error);
      setStatus(`❌ PocketBase test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">PocketBase API Test</h1>
      
      <div className="mb-4">
        <p><strong>PocketBase URL:</strong> {config.pocketbase.url}</p>
        <p><strong>Collection:</strong> {config.pocketbase.collection}</p>
      </div>
      
      <button 
        onClick={testPocketBase}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        Test PocketBase Connection
      </button>
      
      <div className="mt-4">
        <p><strong>Status:</strong> {status}</p>
      </div>
      
      {data && (
        <div className="mt-4">
          <h2 className="text-xl font-semibold mb-2">Response Data:</h2>
          <pre className="bg-gray-100 p-4 rounded overflow-auto">
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
