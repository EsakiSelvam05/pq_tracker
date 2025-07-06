export const formatDate = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

export const isDelayed = (createdAt: number, status: string): boolean => {
  if (status !== 'Pending') return false;
  const now = Date.now();
  const hoursElapsed = (now - createdAt) / (1000 * 60 * 60);
  return hoursElapsed > 48;
};

export const getHoursElapsed = (createdAt: number): number => {
  const now = Date.now();
  return Math.floor((now - createdAt) / (1000 * 60 * 60));
};