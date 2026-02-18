import React from 'react';
import maintenanceBg from '../assets/maintenance-bg.jpg';

export default function MaintenanceScreen() {
  return (
    <div
      className="fixed inset-0 h-screen w-screen bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: `url(${maintenanceBg})` }}
    >
      <div className="absolute inset-0 bg-black/60 flex items-center justify-center px-6">
        <p className="max-w-5xl text-white text-2xl md:text-3xl font-bold text-center animate-pulse leading-relaxed">
          SABAR CUI LAGI MAINTANCE YA MAKLUM MODAL AI TAPI GUA BUAT SEBAGUS MUNGKIN, DAN AMBIL
          DARI SUMBER TERPERCAYA
        </p>
      </div>
    </div>
  );
}
