import React, { useState } from 'react';
import { QrReader } from 'react-qr-reader';
import { X, ScanLine } from 'lucide-react';

interface QRScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (data: string) => void;
  title?: string;
}

const QRScanner: React.FC<QRScannerProps> = ({ isOpen, onClose, onScan, title = 'Scan QR Code' }) => {
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleResult = (result: any, error: any) => {
    if (result) {
      onScan(result?.text || result);
    }
    if (error) {
      // Only show errors that aren't just "no QR found yet"
      if (error?.message && !error.message.includes('No QR code found')) {
        setError(error.message);
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
        <div className="flex justify-between items-center p-4 border-b">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <ScanLine size={20} className="text-green-600" />
            {title}
          </h3>
          <button onClick={onClose} className="text-gray-500 hover:text-red-500 transition">
            <X size={24} />
          </button>
        </div>

        <div className="p-4">
          <div className="rounded-lg overflow-hidden bg-black">
            <QrReader
              constraints={{ facingMode: 'environment' }}
              onResult={handleResult}
              className="w-full"
              videoStyle={{ width: '100%', height: 'auto' }}
            />
          </div>

          {error && (
            <div className="mt-3 p-3 bg-red-50 text-red-600 text-sm rounded-lg">
              {error}
            </div>
          )}

          <div className="mt-4 text-center text-sm text-gray-500">
            Point your camera at the customer's QR code to confirm handoff
          </div>

          <div className="mt-4 flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50 transition"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QRScanner;
