'use client';

import { useEffect, useState } from 'react';
import StellarFiatModal from '@/components/StellarFiatModal';
import { useStellarWallet } from '@/contexts/StellarWalletContext';

const MOCK_ADDRESS =
  'GD5DJQD7KGYRY4TSK4K2V5J2D2J2XQK2T2D2J2XQK2T2D2J2XQK2T2D2J2XQK2T2D2J2XQK2';

export default function TestStellarFiatModalPage() {
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [isOpen, setIsOpen] = useState(true);
  const { mockConnect } = useStellarWallet();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setIsAdminMode(params.get('mode') === 'withdraw');
    if (params.get('connected') !== 'false') {
      mockConnect(MOCK_ADDRESS);
    }
  }, [mockConnect]);

  return (
    <StellarFiatModal
      isOpen={isOpen}
      onClose={() => setIsOpen(false)}
      isAdminMode={isAdminMode}
      defaultAmount=""
    />
  );
}
