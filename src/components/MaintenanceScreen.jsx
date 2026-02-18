import React from 'react';
import maintenanceBg from '../assets/maintenance-bg.jpg';

export default function MaintenanceScreen() {
  return (
    <div
      className="h-screen w-screen bg-cover bg-center"
      style={{ backgroundImage: `url(${maintenanceBg})` }}
    >
      <div className="h-full w-full bg-black/60 flex items-center justify-center px-6">
        <p className="text-white text-2xl md:text-3xl font-bold text-center animate-pulse leading-relaxed">
          SABAR CUI LAGI MAINTANCE YA MAKLUM MODAL AI TAPI GUA BUAT SEBAGUS MUNGKIN, DAN AMBIL
          DARI SUMBER TERPERCAYA
        </p>
      </div>
    </div>
  );
}
