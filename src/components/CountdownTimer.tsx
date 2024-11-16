import React, { useState, useEffect } from 'react';

interface CountdownTimerProps {
  onExpire: () => void;
}

export default function CountdownTimer({ onExpire }: CountdownTimerProps) {
  const calculateTimeLeft = () => {
    const targetDate = new Date('2024-12-01T00:00:00');
    const now = new Date();
    const difference = targetDate.getTime() - now.getTime();

    if (difference <= 0) {
      return { days: 0, hours: 0, minutes: 0, seconds: 0 };
    }

    return {
      days: Math.floor(difference / (1000 * 60 * 60 * 24)),
      hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
      minutes: Math.floor((difference / 1000 / 60) % 60),
      seconds: Math.floor((difference / 1000) % 60)
    };
  };

  const [timeLeft, setTimeLeft] = useState(calculateTimeLeft());

  useEffect(() => {
    const timer = setInterval(() => {
      const newTimeLeft = calculateTimeLeft();
      setTimeLeft(newTimeLeft);

      if (Object.values(newTimeLeft).every(value => value === 0)) {
        clearInterval(timer);
        onExpire();
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [onExpire]);

  if (Object.values(timeLeft).every(value => value === 0)) {
    return null;
  }

  return (
    <div className="flex gap-4 justify-center text-center">
      <div className="bg-purple-600 p-3 rounded-lg text-white min-w-[80px]">
        <div className="text-3xl font-bold">{timeLeft.days}</div>
        <div className="text-sm">Jours</div>
      </div>
      <div className="bg-purple-600 p-3 rounded-lg text-white min-w-[80px]">
        <div className="text-3xl font-bold">{timeLeft.hours}</div>
        <div className="text-sm">Heures</div>
      </div>
      <div className="bg-purple-600 p-3 rounded-lg text-white min-w-[80px]">
        <div className="text-3xl font-bold">{timeLeft.minutes}</div>
        <div className="text-sm">Minutes</div>
      </div>
      <div className="bg-purple-600 p-3 rounded-lg text-white min-w-[80px]">
        <div className="text-3xl font-bold">{timeLeft.seconds}</div>
        <div className="text-sm">Secondes</div>
      </div>
    </div>
  );
}