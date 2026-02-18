import React from 'react';
import { Check, Gift } from 'lucide-react';
import { useUser } from '../context/UserContext';

export const DailyCheckIn: React.FC = () => {
  const { checkInStreak, dailyCheckIn, lastCheckInDate } = useUser();

  const isTodayChecked = () => {
    if (!lastCheckInDate) return false;
    const today = new Date().toISOString().split('T')[0];
    const last = lastCheckInDate.split('T')[0];
    return today === last;
  };

  const handleClaim = () => {
    const result = dailyCheckIn();
    if (result.success) {
      alert(result.message);
    } else {
      alert(result.message);
    }
  };

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-4">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h3 className="font-bold text-gray-800">Absen Harian</h3>
          <p className="text-xs text-gray-500">Kumpulkan streak untuk Jackpot!</p>
        </div>
        <div className="bg-orange-100 text-orange-600 px-3 py-1 rounded-full text-xs font-bold">
          Hari ke-{checkInStreak}
        </div>
      </div>

      <div className="grid grid-cols-5 gap-2 mb-4">
        {Array.from({ length: 10 }).map((_, idx) => {
          const day = idx + 1;
          const isCompleted = day <= checkInStreak;
          const isJackpot = day === 10;
          
          return (
            <div 
              key={day}
              className={`
                relative aspect-square rounded-xl flex flex-col items-center justify-center border-2
                ${isCompleted ? 'bg-green-50 border-[#0F9D58] text-[#0F9D58]' : 'bg-gray-50 border-gray-100 text-gray-400'}
                ${isJackpot && !isCompleted ? 'border-yellow-400 bg-yellow-50' : ''}
              `}
            >
              <span className="text-[10px] font-bold mb-1">Hari {day}</span>
              {isCompleted ? (
                <Check size={16} strokeWidth={4} />
              ) : isJackpot ? (
                <Gift size={16} className="text-yellow-500" />
              ) : (
                <span className="text-xs font-bold">100</span>
              )}
              
              {isJackpot && (
                <div className="absolute -top-2 -right-2 bg-yellow-400 text-white text-[8px] px-1.5 py-0.5 rounded-full font-bold shadow-sm">
                  1K
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button
        onClick={handleClaim}
        disabled={isTodayChecked()}
        className={`
          w-full py-3 rounded-xl font-bold transition-all shadow-sm
          ${isTodayChecked() 
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
            : 'bg-[#0F9D58] text-white active:scale-95 shadow-green-200'}
        `}
      >
        {isTodayChecked() ? 'Sudah Absen Hari Ini' : 'Klaim Koin Sekarang'}
      </button>
    </div>
  );
};