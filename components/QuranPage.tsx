import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Share2, BookOpen, Bookmark, ChevronRight, Play, Pause, Loader } from 'lucide-react';
import { Surah, SurahDetail, LastRead } from '../types';
import { useAudioPlayer } from '../context/AudioPlayerContext';

interface QuranPageProps {
  onBack: () => void;
}

export const QuranPage: React.FC<QuranPageProps> = ({ onBack }) => {
  const [surahs, setSurahs] = useState<Surah[]>([]);
  const [selectedSurah, setSelectedSurah] = useState<SurahDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'ALL' | 'JUZ_AMMA'>('ALL');
  const [lastRead, setLastRead] = useState<LastRead | null>(null);
  
  const [audioLoading, setAudioLoading] = useState(false);
  const { playing, currentSurahId, playSurahAudio, pause, stop } = useAudioPlayer();

  useEffect(() => {
    fetchSurahs();
    loadLastRead();
  }, []);

  const loadLastRead = () => {
    const saved = localStorage.getItem('lastRead');
    if (saved) {
      setLastRead(JSON.parse(saved));
    }
  };

  const stopAudio = useCallback(() => {
    stop();
    setAudioLoading(false);
  }, [stop]);

  useEffect(() => {
    return () => stopAudio();
  }, [stopAudio]);

  const handleBackToList = () => {
    stopAudio();
    setSelectedSurah(null);
  };

  const fetchSurahs = async () => {
    try {
      const response = await fetch('https://equran.id/api/v2/surat');
      const data = await response.json();
      if (data.code === 200) {
        setSurahs(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch surahs', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSurahDetail = async (nomor: number) => {
    setIsLoading(true);
    stopAudio();
    try {
      const response = await fetch(`https://equran.id/api/v2/surat/${nomor}`);
      const data = await response.json();
      if (data.code === 200) {
        setSelectedSurah(data.data);
        saveLastRead(data.data.namaLatin, nomor, 1);
      }
    } catch (error) {
      console.error('Failed to fetch detail', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveLastRead = (surahName: string, surahNumber: number, ayatNumber: number) => {
    const newLastRead = { surahName, surahNumber, ayatNumber };
    setLastRead(newLastRead);
    localStorage.setItem('lastRead', JSON.stringify(newLastRead));
  };

  const handleShare = async (ayatText: string, translation: string, surah: string, ayatNum: number) => {
    const text = `QS. ${surah}: ${ayatNum}\n\n${ayatText}\n\n"${translation}"\n\nSent from MuslimLife App`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: `QS. ${surah}: ${ayatNum}`,
          text: text,
        });
      } catch (err) {
        console.log('Share canceled');
      }
    } else {
      navigator.clipboard.writeText(text);
      alert('Teks ayat berhasil disalin!');
    }
  };

  const toggleAudio = async () => {
    if (!selectedSurah) return;
    const isCurrentSurahPlaying = currentSurahId === selectedSurah.nomor && playing;

    if (isCurrentSurahPlaying) {
      pause();
      return;
    }

    setAudioLoading(true);
    try {
      const audioUrl = selectedSurah.audioFull['05'] || Object.values(selectedSurah.audioFull)[0];
      await playSurahAudio(selectedSurah.nomor, audioUrl);
    } catch (error) {
      console.error('Audio playback error', error);
      alert('Gagal memuat audio murottal. Periksa koneksi internet.');
      stopAudio();
    } finally {
      setAudioLoading(false);
    }
  };

  const filteredSurahs = activeTab === 'JUZ_AMMA' 
    ? surahs.filter(s => s.nomor >= 78) 
    : surahs;

  const isCurrentSurahPlaying = Boolean(selectedSurah && currentSurahId === selectedSurah.nomor && playing);

  if (selectedSurah) {
    return (
      <div className="min-h-screen bg-white flex flex-col pt-safe pb-safe z-50 fixed inset-0">
        {/* Detail Header */}
        <div className="bg-[#0F9D58] text-white px-4 py-4 flex items-center justify-between shadow-md">
          <div className="flex items-center gap-2">
            <button onClick={handleBackToList} className="p-1 hover:bg-white/10 rounded-full">
                <ArrowLeft size={24} />
            </button>
            <div className="text-left">
                <h2 className="font-bold text-lg leading-tight">{selectedSurah.namaLatin}</h2>
                <p className="text-xs opacity-90">{selectedSurah.arti} • {selectedSurah.jumlahAyat} Ayat</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Audio Player Control */}
            <button 
                onClick={toggleAudio}
                className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white/30 transition-colors"
                disabled={audioLoading}
            >
                {audioLoading ? (
                    <Loader size={20} className="animate-spin" />
                ) : isCurrentSurahPlaying ? (
                    <Pause size={20} fill="white" />
                ) : (
                    <Play size={20} fill="white" className="ml-1" />
                )}
            </button>
          </div>
        </div>

        {/* Ayat List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-24">
            {/* Basmalah */}
            {selectedSurah.nomor !== 1 && selectedSurah.nomor !== 9 && (
                <div className="text-center font-serif text-2xl py-4 text-[#333333]">
                    بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيم
                </div>
            )}

            {selectedSurah.ayat.map((ayat) => (
            <div key={ayat.nomorAyat} className="border-b border-gray-100 pb-4 last:border-0">
              <div className="flex justify-between items-start bg-[#F4E7BD]/20 rounded-lg p-2 mb-3">
                <div className="bg-[#0F9D58] text-white w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shadow-sm">
                  {ayat.nomorAyat}
                </div>
                <div className="flex gap-3">
                  <button 
                    onClick={() => handleShare(ayat.teksArab, ayat.teksIndonesia, selectedSurah.namaLatin, ayat.nomorAyat)}
                    className="text-gray-400 hover:text-[#0F9D58] p-1 rounded-full active:bg-gray-100"
                    title="Bagikan Ayat"
                  >
                    <Share2 size={18} />
                  </button>
                  <button 
                    onClick={() => saveLastRead(selectedSurah.namaLatin, selectedSurah.nomor, ayat.nomorAyat)}
                    className={`p-1 rounded-full active:bg-gray-100 hover:text-[#0F9D58] ${lastRead?.surahNumber === selectedSurah.nomor && lastRead.ayatNumber === ayat.nomorAyat ? 'text-[#0F9D58]' : 'text-gray-400'}`}
                    title="Tandai Terakhir Baca"
                  >
                    <Bookmark size={18} fill={lastRead?.surahNumber === selectedSurah.nomor && lastRead.ayatNumber === ayat.nomorAyat ? '#0F9D58' : 'none'} />
                  </button>
                </div>
              </div>
              
              <div className="text-right mb-4">
                <p className="font-serif text-3xl leading-[2.2] text-[#333333]">{ayat.teksArab}</p>
              </div>
              
              <div className="space-y-1">
                <p className="text-[#0F9D58] text-xs font-semibold">{ayat.teksLatin}</p>
                <p className="text-[#333333] text-sm leading-relaxed">{ayat.teksIndonesia}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col pt-safe pb-safe fixed inset-0 z-50">
      {/* Main Header */}
      <div className="bg-[#0F9D58] px-4 py-6 rounded-b-[2rem] shadow-lg sticky top-0 z-10">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => { stopAudio(); onBack(); }} className="text-white">
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-white text-2xl font-bold">Al-Quran</h1>
        </div>

        {/* Last Read Card */}
        {lastRead && (
          <div 
            onClick={() => fetchSurahDetail(lastRead.surahNumber)}
            className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-4 flex justify-between items-center text-white cursor-pointer hover:bg-white/20 transition-colors"
          >
            <div className="flex items-center gap-3">
              <BookOpen size={20} className="text-[#F4E7BD]" />
              <div>
                <p className="text-xs opacity-90">Terakhir Dibaca</p>
                <p className="font-bold text-lg">{lastRead.surahName}</p>
                <p className="text-xs opacity-80">Ayat {lastRead.ayatNumber}</p>
              </div>
            </div>
            <ChevronRight />
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex px-4 mt-6 gap-4">
        <button 
          onClick={() => setActiveTab('ALL')}
          className={`pb-2 text-sm font-semibold flex-1 ${activeTab === 'ALL' ? 'text-[#0F9D58] border-b-2 border-[#0F9D58]' : 'text-gray-400'}`}
        >
          Semua Surah
        </button>
        <button 
          onClick={() => setActiveTab('JUZ_AMMA')}
          className={`pb-2 text-sm font-semibold flex-1 ${activeTab === 'JUZ_AMMA' ? 'text-[#0F9D58] border-b-2 border-[#0F9D58]' : 'text-gray-400'}`}
        >
          Juz Amma
        </button>
      </div>

      {/* Surah List */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 pb-24">
        {isLoading ? (
          <div className="flex justify-center py-10">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0F9D58]"></div>
          </div>
        ) : (
          filteredSurahs.map((surah) => (
            <div 
              key={surah.nomor}
              onClick={() => fetchSurahDetail(surah.nomor)}
              className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between active:scale-[0.98] transition-transform cursor-pointer group"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center text-[#0F9D58] font-bold text-sm relative">
                  <span className="z-10">{surah.nomor}</span>
                  <div className="absolute inset-0 border-2 border-[#0F9D58]/20 rounded-full"></div>
                </div>
                <div>
                  <h3 className="font-bold text-[#333333] group-hover:text-[#0F9D58] transition-colors">{surah.namaLatin}</h3>
                  <p className="text-xs text-gray-400 uppercase">{surah.tempatTurun} • {surah.jumlahAyat} Ayat</p>
                </div>
              </div>
              <p className="font-serif text-[#0F9D58] text-xl">{surah.nama}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
