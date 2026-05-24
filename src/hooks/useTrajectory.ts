
import { useState, useCallback } from 'react';
import { api } from '../api/client';
import { LambertRequest, LambertResponse } from '../types/orbit';

export const useTrajectory = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const calculateLambert = useCallback(async (data: LambertRequest): Promise<LambertResponse | null> => {
    setLoading(true);
    setError(null);
    try {
      return await api.solveLambert(data);
    } catch (err: any) {
      setError(err.message || 'Failed to calculate trajectory');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { calculateLambert, loading, error };
};
