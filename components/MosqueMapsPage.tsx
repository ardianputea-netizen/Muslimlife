import React, { useState, useRef, useCallback } from 'react';
import { MapPin, Navigation, List } from 'lucide-react';
import { DUMMY_MOSQUES } from '../constants';
import { Mosque } from '../types';

export const MosqueMapsPage: React.FC = () => {
  const [selectedMosque, setSelectedMosque] = useState<Mosque | null>(null);
  
  // Logic to make the mock map draggable/pannable
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const startPos = useRef({ x: 0, y: 0 });
  const mapRef = useRef<HTMLDivElement>(null);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    setIsDragging(true);
    startPos.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
    if (mapRef.current) mapRef.current.style.cursor = 'grabbing';
  }, [offset.x, offset.y]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging) return;
    const newX = e.clientX - startPos.current.x;
    const newY = e.clientY - startPos.current.y;
    setOffset({ x: newX, y: newY });
  }, [isDragging]);

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
    if (mapRef.current) mapRef.current.style.cursor = 'grab';
  }, []);

  return (
    <div className="h-full w-full flex flex-col relative bg-gray-100 overflow-hidden">
      
      {/* Search Bar Overlay */}
      <div className="absolute top-4 left-4 right-4 z-20">
        <div className="bg-white rounded-xl shadow-lg p-3 flex items-center gap-3">
          <MapPin className="text-[#0F9D58]" />
          <input 
            type="text" 
            placeholder="Cari masjid sekitar..." 
            className="flex-1 outline-none text-gray-700"
          />
        </div>
      </div>

      {/* Map Container (Mock with Pan Support) */}
      <div 
        ref={mapRef}
        className="absolute inset-0 w-full h-full bg-[#E5E7EB] cursor-grab touch-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        {/* Placeholder Map Background - Moves based on offset */}
        <div 
            className="absolute -inset-[1000px] opacity-40"
            style={{
                backgroundImage: 'radial-gradient(#CBD5E1 1px, transparent 1px)',
                backgroundSize: '20px 20px',
                backgroundColor: '#F1F5F9',
                transform: `translate(${offset.x}px, ${offset.y}px)`,
                transition: isDragging ? 'none' : 'transform 0.1s ease-out'
            }}
        ></div>
        
        {/* Simulated Map Content Text */}
        <div 
            className="absolute inset-0 flex items-center justify-center pointer-events-none select-none"
            style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}
        >
            <span className="text-gray-400 text-sm font-semibold bg-white/50 px-2 py-1 rounded">
                Geser Peta untuk Menjelajah
            </span>
        </div>

        {/* User Location Marker - Moves with map */}
        <div 
            className="absolute top-1/2 left-1/2 z-10 pointer-events-none"
            style={{ transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))` }}
        >
            <div className="w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-lg animate-pulse"></div>
            <div className="w-12 h-12 bg-blue-500/20 rounded-full absolute -top-4 -left-4 animate-ping"></div>
        </div>

        {/* Mosque Markers (Move with map) */}
        {DUMMY_MOSQUES.map((mosque, idx) => {
            // Fixed relative positions based on index to simulate geography
            const relX = (idx % 2 === 0 ? 80 : -80) * (idx + 1);
            const relY = (idx % 2 !== 0 ? 60 : -60) * (idx + 1);
            
            return (
                <button
                    key={mosque.id}
                    onClick={() => setSelectedMosque(mosque)}
                    className="absolute top-1/2 left-1/2 z-10 transform -translate-x-1/2 -translate-y-1/2 transition-transform hover:scale-110 active:scale-95"
                    style={{ 
                        transform: `translate(calc(-50% + ${offset.x + relX}px), calc(-50% + ${offset.y + relY}px))` 
                    }}
                >
                    <div className={`p-2 rounded-full shadow-lg ${selectedMosque?.id === mosque.id ? 'bg-[#0F9D58] scale-125' : 'bg-white'}`}>
                        <img src="https://cdn-icons-png.flaticon.com/512/3758/3758159.png" alt="mosque" className="w-6 h-6" />
                    </div>
                </button>
            );
        })}
      </div>

      {/* Bottom List View - Absolute positioned to stay at bottom */}
      <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-[0_-5px_20px_-5px_rgba(0,0,0,0.1)] z-30 pb-20">
        <div className="flex justify-center pt-3 pb-1">
            <div className="w-12 h-1.5 bg-gray-200 rounded-full"></div>
        </div>
        
        <div className="px-4 mb-2 flex justify-between items-center">
            <h3 className="font-bold text-gray-800">Masjid Terdekat</h3>
            <button className="text-xs text-[#0F9D58] font-semibold flex items-center gap-1 active:opacity-70">
                <List size={14} /> Lihat Semua
            </button>
        </div>

        <div className="flex overflow-x-auto gap-4 px-4 pb-4 no-scrollbar">
            {DUMMY_MOSQUES.map((mosque) => (
                <div 
                    key={mosque.id}
                    onClick={() => setSelectedMosque(mosque)}
                    className={`min-w-[240px] p-3 rounded-2xl border transition-all cursor-pointer ${selectedMosque?.id === mosque.id ? 'border-[#0F9D58] bg-green-50' : 'border-gray-100 bg-white shadow-sm'}`}
                >
                    <div className="flex gap-3">
                        <img src={mosque.image} className="w-16 h-16 rounded-xl object-cover bg-gray-200" alt={mosque.name} />
                        <div className="flex-1">
                            <h4 className="font-bold text-gray-800 text-sm line-clamp-1">{mosque.name}</h4>
                            <p className="text-xs text-gray-500 line-clamp-1 mt-1">{mosque.address}</p>
                            <div className="flex items-center gap-1 mt-2 text-[#0F9D58]">
                                <Navigation size={12} fill="currentColor" />
                                <span className="text-xs font-bold">{mosque.distance} km</span>
                            </div>
                        </div>
                    </div>
                </div>
            ))}
        </div>
      </div>
    </div>
  );
};