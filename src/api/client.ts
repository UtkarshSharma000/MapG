
import axios from 'axios';
import { LambertRequest, LambertResponse, PropagationRequest, PropagationResponse } from '../types/orbit';

const apiClient = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const api = {
  solveLambert: async (data: LambertRequest): Promise<LambertResponse> => {
    const response = await apiClient.post<LambertResponse>('/lambert', data);
    return response.data;
  },
  propagate: async (data: PropagationRequest): Promise<PropagationResponse> => {
    const response = await apiClient.post<PropagationResponse>('/propagate', data);
    return response.data;
  }
};
