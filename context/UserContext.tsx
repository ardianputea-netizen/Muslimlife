import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';

// --- Types ---
export interface Transaction {
  id: string;
  type: 'EARN' | 'SPEND' | 'WITHDRAW';
  amount: number;
  description: string;
  date: string;
  status?: 'SUCCESS' | 'PENDING' | 'FAILED';
}

interface UserContextType {
  coinBalance: number;
  checkInStreak: number;
  lastCheckInDate: string | null;
  lastAdWatchTime: string | null;
  referralCode: string;
  hasUsedReferral: boolean;
  history: Transaction[];
  deviceId: string;
  // Actions
  dailyCheckIn: () => { success: boolean; message: string; reward: number };
  watchAdReward: () => Promise<{ success: boolean; message: string }>;
  redeemReferral: (code: string) => { success: boolean; message: string };
  withdrawCoins: (amount: number, bankInfo: string) => { success: boolean; message: string };
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};

// --- Security Helper: Generate/Get Persistent Device ID ---
const getOrCreateDeviceId = () => {
  let id = localStorage.getItem('secure_device_id');
  if (!id) {
    // Generate a random UUID-like string
    id = 'dev_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    localStorage.setItem('secure_device_id', id);
  }
  return id;
};

// --- Security Helper: Bot/Emulator Detection ---
const isBotOrHeadless = () => {
  const userAgent = navigator.userAgent.toLowerCase();
  const isHeadless = navigator.webdriver; // True for Selenium/Puppeteer
  const isBot = /bot|googlebot|crawler|spider|robot|crawling/i.test(userAgent);
  return isHeadless || isBot;
};

// --- Helper: Generate Random Code ---
const generateReferralCode = () => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

export const UserProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // --- State ---
  const [coinBalance, setCoinBalance] = useState(0);
  const [checkInStreak, setCheckInStreak] = useState(0);
  const [lastCheckInDate, setLastCheckInDate] = useState<string | null>(null);
  const [lastAdWatchTime, setLastAdWatchTime] = useState<string | null>(null);
  const [referralCode, setReferralCode] = useState('');
  const [hasUsedReferral, setHasUsedReferral] = useState(false);
  const [history, setHistory] = useState<Transaction[]>([]);
  const [deviceId, setDeviceId] = useState('');

  // --- Load Data on Mount ---
  useEffect(() => {
    // 1. Setup Security ID
    const dId = getOrCreateDeviceId();
    setDeviceId(dId);

    // 2. Load User Data
    const loadData = () => {
      const storedBalance = localStorage.getItem('coinBalance');
      const storedStreak = localStorage.getItem('checkInStreak');
      const storedLastCheckIn = localStorage.getItem('lastCheckInDate');
      const storedAdTime = localStorage.getItem('lastAdWatchTime');
      const storedReferral = localStorage.getItem('referralCode');
      const storedHasUsedRef = localStorage.getItem('hasUsedReferral');
      const storedHistory = localStorage.getItem('coinHistory');

      if (storedBalance) setCoinBalance(Number(storedBalance));
      if (storedStreak) setCheckInStreak(Number(storedStreak));
      if (storedLastCheckIn) setLastCheckInDate(storedLastCheckIn);
      if (storedAdTime) setLastAdWatchTime(storedAdTime);
      
      if (storedReferral) {
        setReferralCode(storedReferral);
      } else {
        const newCode = generateReferralCode();
        setReferralCode(newCode);
        localStorage.setItem('referralCode', newCode);
      }

      if (storedHasUsedRef) setHasUsedReferral(JSON.parse(storedHasUsedRef));
      if (storedHistory) setHistory(JSON.parse(storedHistory));
    };

    loadData();
  }, []);

  // --- Helpers: functional setState agar tidak trigger re-render berlebihan ---
  const addCoins = useCallback((amount: number, description: string) => {
    setCoinBalance((prev) => {
      const newBalance = prev + amount;
      localStorage.setItem('coinBalance', String(newBalance));
      return newBalance;
    });
    setHistory((prev) => {
      const newTx: Transaction = {
        id: Date.now().toString(),
        type: 'EARN',
        amount,
        description,
        date: new Date().toISOString(),
        status: 'SUCCESS'
      };
      const newHistory = [newTx, ...prev];
      localStorage.setItem('coinHistory', JSON.stringify(newHistory));
      return newHistory;
    });
  }, []);

  const deductCoins = useCallback((amount: number, description: string, isWithdraw = false) => {
    setCoinBalance((prev) => {
      const newBalance = prev - amount;
      localStorage.setItem('coinBalance', String(newBalance));
      return newBalance;
    });
    setHistory((prev) => {
      const newTx: Transaction = {
        id: Date.now().toString(),
        type: isWithdraw ? 'WITHDRAW' : 'SPEND',
        amount,
        description,
        date: new Date().toISOString(),
        status: isWithdraw ? 'PENDING' : 'SUCCESS'
      };
      const newHistory = [newTx, ...prev];
      localStorage.setItem('coinHistory', JSON.stringify(newHistory));
      return newHistory;
    });
  }, []);

  // --- Features (useCallback untuk stabil referensi) ---
  const dailyCheckIn = useCallback(() => {
    // SECURITY 1: Bot Check
    if (isBotOrHeadless()) {
      return { success: false, message: 'Keamanan: Aktivitas mencurigakan terdeteksi.', reward: 0 };
    }

    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const lastCheck = lastCheckInDate ? lastCheckInDate.split('T')[0] : null;

    if (lastCheck === today) {
      return { success: false, message: 'Anda sudah absen hari ini!', reward: 0 };
    }

    // SECURITY 2: Device Check for Check-in (Prevent multiple accounts on same device same day)
    const claimedDevicesKey = `checkin_claimed_${today}`;
    const claimedDevices = JSON.parse(localStorage.getItem(claimedDevicesKey) || '[]');
    if (claimedDevices.includes(deviceId)) {
        return { success: false, message: 'Perangkat ini sudah melakukan absen hari ini di akun lain.', reward: 0 };
    }

    // Check consistency (consecutive days)
    let newStreak = 1;
    if (lastCheck) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      
      if (lastCheck === yesterdayStr) {
        newStreak = checkInStreak + 1;
      }
    }
    
    // Reset streak if cycle > 10
    if (newStreak > 10) newStreak = 1;

    let reward = 100;
    if (newStreak === 10) reward = 1000; // Jackpot

    setCheckInStreak(newStreak);
    setLastCheckInDate(new Date().toISOString());
    localStorage.setItem('checkInStreak', String(newStreak));
    localStorage.setItem('lastCheckInDate', new Date().toISOString());

    // Save device as claimed for today
    claimedDevices.push(deviceId);
    localStorage.setItem(claimedDevicesKey, JSON.stringify(claimedDevices));

    addCoins(reward, `Daily Check-in Hari ke-${newStreak}`);
    return { success: true, message: `Absen berhasil! +${reward} Koin`, reward };
  }, [lastCheckInDate, checkInStreak, deviceId, addCoins]);

  const watchAdReward = useCallback(async (): Promise<{ success: boolean; message: string }> => {
    // SECURITY: Bot Check
    if (isBotOrHeadless()) {
        return { success: false, message: 'Error: Browser tidak didukung untuk Iklan.' };
    }

    const now = new Date();
    
    if (lastAdWatchTime) {
      const lastTime = new Date(lastAdWatchTime);
      const diffMs = now.getTime() - lastTime.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);

      if (diffHours < 12) {
        const remainingHours = Math.ceil(12 - diffHours);
        return { success: false, message: `Iklan belum tersedia. Tunggu ${remainingHours} jam lagi.` };
      }
    }

    const reward = 500;
    addCoins(reward, 'Nonton Iklan Reward');
    
    setLastAdWatchTime(now.toISOString());
    localStorage.setItem('lastAdWatchTime', now.toISOString());

    return { success: true, message: `Terima kasih! +${reward} Koin ditambahkan.` };
  }, [lastAdWatchTime, addCoins]);

  const redeemReferral = useCallback((code: string) => {
    // SECURITY 1: Bot Check
    if (isBotOrHeadless()) {
        return { success: false, message: 'Keamanan: Tidak dapat memproses permintaan.' };
    }

    // SECURITY 2: Check if this DEVICE has ever redeemed a referral
    // Using a separate global key 'global_device_referral_history' to simulate a server check
    const usedDevices = JSON.parse(localStorage.getItem('global_device_referral_history') || '[]');
    if (usedDevices.includes(deviceId)) {
        return { success: false, message: 'Perangkat ini sudah pernah digunakan untuk klaim referral (Maks 1x per HP).' };
    }

    if (hasUsedReferral) {
      return { success: false, message: 'Akun ini sudah pernah memasukkan kode referral.' };
    }
    if (code === referralCode) {
      return { success: false, message: 'Tidak bisa memasukkan kode sendiri.' };
    }
    if (code.length !== 6) {
      return { success: false, message: 'Kode tidak valid.' };
    }

    // Simulate success
    addCoins(500, `Referral Bonus: ${code}`);
    setHasUsedReferral(true);
    localStorage.setItem('hasUsedReferral', 'true');
    
    // Lock Device
    usedDevices.push(deviceId);
    localStorage.setItem('global_device_referral_history', JSON.stringify(usedDevices));

    return { success: true, message: 'Kode berhasil! +500 Koin.' };
  }, [deviceId, hasUsedReferral, referralCode, addCoins]);

  const withdrawCoins = useCallback((amount: number, bankInfo: string) => {
    if (amount <= 0) return { success: false, message: 'Jumlah tidak valid.' };
    if (amount > coinBalance) return { success: false, message: 'Saldo tidak mencukupi.' };
    if (amount < 20000) return { success: false, message: 'Minimal penarikan 20.000 koin.' }; // Changed to 20k

    deductCoins(amount, `Withdraw ke ${bankInfo}`, true);
    return { success: true, message: 'Permintaan penarikan berhasil dikirim (Pending).' };
  }, [coinBalance, deductCoins]);

  const contextValue = useMemo(() => ({
      coinBalance,
      checkInStreak,
      lastCheckInDate,
      lastAdWatchTime,
      referralCode,
      hasUsedReferral,
      history,
      deviceId,
      dailyCheckIn,
      watchAdReward,
      redeemReferral,
      withdrawCoins
  }), [coinBalance, checkInStreak, lastCheckInDate, lastAdWatchTime, referralCode, hasUsedReferral, history, deviceId, dailyCheckIn, watchAdReward, redeemReferral, withdrawCoins]);

  return (
    <UserContext.Provider value={contextValue}>
      {children}
    </UserContext.Provider>
  );
};