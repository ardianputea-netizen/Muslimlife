import React, { useState } from 'react';
import { Coins, Copy, History, Wallet, PlayCircle, Loader2, ArrowRight } from 'lucide-react';
import { useUser } from '../context/UserContext';
import { DailyCheckIn } from './DailyCheckIn';

export const WalletPage: React.FC = () => {
  const { 
    coinBalance, 
    referralCode, 
    redeemReferral, 
    hasUsedReferral, 
    watchAdReward, 
    withdrawCoins,
    history
  } = useUser();

  const [activeTab, setActiveTab] = useState<'EARN' | 'WITHDRAW'>('EARN');
  const [refInput, setRefInput] = useState('');
  const [isWatchingAd, setIsWatchingAd] = useState(false);
  
  // Withdraw State
  const [bankName, setBankName] = useState('DANA');
  const [accountNumber, setAccountNumber] = useState('');
  const [amount, setAmount] = useState('');

  const handleCopyCode = () => {
    navigator.clipboard.writeText(referralCode);
    alert('Kode Referral disalin!');
  };

  const handleRedeemRef = () => {
    const res = redeemReferral(refInput);
    alert(res.message);
    if (res.success) setRefInput('');
  };

  const handleWatchAd = async () => {
    setIsWatchingAd(true);
    // Simulate Ad Duration (5 seconds)
    setTimeout(async () => {
      const res = await watchAdReward();
      alert(res.message);
      setIsWatchingAd(false);
    }, 5000);
  };

  const handleWithdraw = () => {
    const numAmount = parseInt(amount);
    if (isNaN(numAmount)) {
      alert('Masukkan jumlah yang valid');
      return;
    }
    const info = `${bankName} - ${accountNumber}`;
    const res = withdrawCoins(numAmount, info);
    alert(res.message);
    if (res.success) {
      setAmount('');
      setAccountNumber('');
    }
  };

  return (
    <div className="bg-background min-h-full pb-20">
      {/* Wallet Card */}
      <div className="bg-gradient-to-br from-[#0F9D58] to-[#00695C] p-6 text-white rounded-b-[2rem] shadow-lg mb-4 sticky top-0 z-10">
        <p className="opacity-90 text-sm mb-1">Saldo Koin Saya</p>
        <div className="flex items-center gap-2 mb-4">
          <Coins size={32} className="text-[#F4E7BD]" />
          <h1 className="text-4xl font-bold font-mono">{coinBalance.toLocaleString()}</h1>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setActiveTab('EARN')}
            className={`flex-1 py-2 rounded-xl text-sm font-bold transition-colors ${activeTab === 'EARN' ? 'bg-card text-[#0F9D58]' : 'bg-card/20 text-white'}`}
          >
            Kumpulkan
          </button>
          <button 
            onClick={() => setActiveTab('WITHDRAW')}
            className={`flex-1 py-2 rounded-xl text-sm font-bold transition-colors ${activeTab === 'WITHDRAW' ? 'bg-card text-[#0F9D58]' : 'bg-card/20 text-white'}`}
          >
            Tarik Tunai
          </button>
        </div>
      </div>

      <div className="px-4 space-y-4">
        {activeTab === 'EARN' ? (
          <>
            <DailyCheckIn />

            {/* Ad Section */}
            <div className="bg-card rounded-2xl p-4 shadow-sm border border-border flex items-center justify-between">
              <div>
                <h3 className="font-bold text-foreground flex items-center gap-2">
                  <PlayCircle size={18} className="text-red-500" />
                  Tonton Iklan
                </h3>
                <p className="text-xs text-muted-foreground">Dapatkan +500 koin (Max 1x/12 jam)</p>
              </div>
              <button 
                onClick={handleWatchAd}
                disabled={isWatchingAd}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 disabled:bg-muted disabled:text-muted-foreground"
              >
                {isWatchingAd ? <Loader2 size={16} className="animate-spin" /> : '+500'}
              </button>
            </div>

            {/* Referral Section */}
            <div className="bg-card rounded-2xl p-4 shadow-sm border border-border">
              <h3 className="font-bold text-foreground mb-3">Kode Referral</h3>
              
              <div className="bg-muted p-3 rounded-xl flex justify-between items-center mb-4 border border-dashed border-border">
                <span className="font-mono font-bold text-lg tracking-wider">{referralCode}</span>
                <button onClick={handleCopyCode} className="text-[#0F9D58] flex items-center gap-1 text-sm font-bold">
                  <Copy size={16} /> Salin
                </button>
              </div>

              {!hasUsedReferral ? (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Punya kode teman? Masukkan untuk dapat 500 koin.</p>
                  <div className="flex gap-2">
                    <input 
                      value={refInput}
                      onChange={(e) => setRefInput(e.target.value.toUpperCase())}
                      placeholder="Masukan Kode 6 Digit"
                      maxLength={6}
                      className="flex-1 bg-background border border-border rounded-xl px-3 text-sm outline-none focus:border-[#0F9D58]"
                    />
                    <button 
                      onClick={handleRedeemRef}
                      disabled={!refInput}
                      className="bg-[#0F9D58] text-white px-4 rounded-xl font-bold disabled:bg-muted disabled:text-muted-foreground"
                    >
                      Klaim
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-2 bg-green-50 rounded-xl text-green-700 text-sm font-medium">
                  Anda sudah mengklaim bonus referral âœ…
                </div>
              )}
            </div>
          </>
        ) : (
          /* Withdraw Tab */
          <div className="space-y-4">
            <div className="bg-card rounded-2xl p-5 shadow-sm border border-border">
              <h3 className="font-bold text-foreground mb-4 flex items-center gap-2">
                <Wallet size={20} className="text-[#0F9D58]" />
                Form Penarikan
              </h3>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-muted-foreground mb-1 block">Metode Pencairan</label>
                  <select 
                    value={bankName} 
                    onChange={(e) => setBankName(e.target.value)}
                    className="w-full bg-background border border-border rounded-xl p-3 text-sm outline-none"
                  >
                    <option value="DANA">DANA</option>
                    <option value="OVO">OVO</option>
                    <option value="GOPAY">GoPay</option>
                    <option value="SHOPEEPAY">ShopeePay</option>
                    <option value="BANK_BCA">Bank BCA</option>
                    <option value="BANK_BRI">Bank BRI</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-muted-foreground mb-1 block">Nomor Rekening / E-Wallet</label>
                  <input 
                    type="number"
                    value={accountNumber} 
                    onChange={(e) => setAccountNumber(e.target.value)}
                    placeholder="08xxxxxxxxxx"
                    className="w-full bg-background border border-border rounded-xl p-3 text-sm outline-none focus:border-[#0F9D58]"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-muted-foreground mb-1 block">Jumlah Koin</label>
                  <input 
                    type="number"
                    value={amount} 
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="Minimal 20.000"
                    className="w-full bg-background border border-border rounded-xl p-3 text-sm outline-none focus:border-[#0F9D58]"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1 text-right">1 Koin = Rp 1</p>
                </div>

                <button 
                  onClick={handleWithdraw}
                  className="w-full bg-[#0F9D58] text-white py-3 rounded-xl font-bold mt-2 shadow-lg shadow-green-100 active:scale-95 transition-transform"
                >
                  Ajukan Penarikan
                </button>
              </div>
            </div>

            <div className="bg-card rounded-2xl p-4 shadow-sm border border-border">
              <h3 className="font-bold text-foreground mb-3 flex items-center gap-2">
                <History size={18} />
                Riwayat Transaksi
              </h3>
              <div className="space-y-3">
                {history.length === 0 && <p className="text-center text-muted-foreground text-xs py-4">Belum ada riwayat.</p>}
                {history.map((tx) => (
                  <div key={tx.id} className="flex justify-between items-center border-b border-border/60 last:border-0 pb-2">
                    <div>
                      <p className="font-bold text-xs text-foreground">{tx.description}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(tx.date).toLocaleDateString()} â€¢ {tx.status}
                      </p>
                    </div>
                    <span className={`font-mono font-bold text-sm ${tx.type === 'EARN' ? 'text-green-600' : 'text-red-500'}`}>
                      {tx.type === 'EARN' ? '+' : '-'}{tx.amount}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
