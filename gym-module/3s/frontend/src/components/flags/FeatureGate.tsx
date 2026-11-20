import type { ReactNode } from 'react';
import type { FeatureKey } from '../../types/api';
import { useFeatures } from '../../services/features';

interface FeatureGateProps {
  children: ReactNode;
  feature: FeatureKey;
  fallback?: ReactNode;
}

export default function FeatureGate({ children, feature, fallback = null }: FeatureGateProps) {
  const { isEnabled } = useFeatures();
  return isEnabled(feature) ? children : fallback;
}
