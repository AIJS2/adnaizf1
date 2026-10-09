import { API_URL } from '../config';

export const fetchDashboardData = async (year) => {
  const response = await fetch(`${API_URL}/api/dashboard/${year}`);
  if (!response.ok) throw new Error('Failed to fetch dashboard data');
  const data = await response.json();
  if (data.error) throw new Error(data.error);
  return data;
};

export const fetchAllRaces = async (year) => {
  const response = await fetch(`${API_URL}/api/races/${year}`);
  if (!response.ok) throw new Error('Failed to fetch races');
  const data = await response.json();
  if (data.error) throw new Error(data.error);
  return data;
};

export const fetchRaceDetails = async (year, round) => {
  const response = await fetch(`${API_URL}/api/race/${year}/${round}`);
  if (!response.ok) throw new Error('Failed to fetch race details');
  const data = await response.json();
  if (data.error) throw new Error(data.error);
  return data;
};

export const fetchChampionship = async (year) => {
  const response = await fetch(`${API_URL}/api/championship/${year}`);
  if (!response.ok) throw new Error('Failed to fetch championship standings');
  const data = await response.json();
  if (data.error) throw new Error(data.error);
  return data;
};

export const fetchDriverProfile = async (year, id) => {
  const response = await fetch(`${API_URL}/api/driver/${year}/${id}`);
  if (!response.ok) throw new Error('Failed to fetch driver profile');
  const data = await response.json();
  if (data.error) throw new Error(data.error);
  return data;
};

export const fetchTeamProfile = async (year, id) => {
  const response = await fetch(`${API_URL}/api/team/${year}/${id}`);
  if (!response.ok) throw new Error('Failed to fetch team profile');
  const data = await response.json();
  if (data.error) throw new Error(data.error);
  return data;
};

export const fetchTelemetryCompare = async (year, round, drivers) => {
  const response = await fetch(`${API_URL}/api/telemetry/${year}/${round}?drivers=${drivers}`);
  if (!response.ok) throw new Error('Failed to fetch telemetry');
  const data = await response.json();
  if (data.error) throw new Error(data.error);
  return data;
};
