import { useState, useEffect } from 'react';

export const useCountdown = (initialDays: number, initialHours: number, initialMinutes: number, status: string) => {
  const [totalSeconds, setTotalSeconds] = useState(
    (initialDays * 86400) + (initialHours * 3600) + (initialMinutes * 60)
  );

  useEffect(() => {
    if (status !== 'not_started' || totalSeconds <= 0) return;

    const interval = setInterval(() => {
      setTotalSeconds(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [status]);

  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return { days, hours, minutes, seconds, totalSeconds };
};