export interface ParsedReminderResult {
  success: boolean;
  fireAt: string | null;
  reason?: string;
}

const clampDay = (day: number, month: number, year: number) => {
  const lastDay = new Date(year, month + 1, 0).getDate();
  return Math.min(Math.max(day, 1), lastDay);
};

const parseHourText = (value: string) => {
  const clean = value.toLowerCase().trim();
  const hmMatch = clean.match(/(\d{1,2})[:.](\d{2})/);
  if (hmMatch) {
    return { hour: Number(hmMatch[1]), minute: Number(hmMatch[2]) };
  }

  const hMatch = clean.match(/(\d{1,2})/);
  if (!hMatch) return null;
  let hour = Number(hMatch[1]);
  let minute = 0;
  if (clean.includes('setengah')) {
    minute = 30;
  }

  if (clean.includes('malam') || clean.includes('sore')) {
    if (hour < 12) hour += 12;
  }
  if (clean.includes('pagi') && hour === 12) hour = 0;

  return { hour, minute };
};

export const parseIndonesianReminder = (text: string, nowInput = new Date()): ParsedReminderResult => {
  const raw = text.toLowerCase().trim();
  if (!raw) {
    return { success: false, fireAt: null, reason: 'Teks pengingat kosong.' };
  }

  const now = new Date(nowInput);
  let target = new Date(now);

  if (raw.includes('lusa')) {
    target.setDate(target.getDate() + 2);
  } else if (raw.includes('besok')) {
    target.setDate(target.getDate() + 1);
  }

  const dayMatch = raw.match(/\btgl\s*(\d{1,2})\b/);
  if (dayMatch) {
    const day = Number(dayMatch[1]);
    let month = now.getMonth();
    let year = now.getFullYear();
    if (day < now.getDate() && !raw.includes('bulan depan')) {
      month += 1;
      if (month > 11) {
        month = 0;
        year += 1;
      }
    }

    const safeDay = clampDay(day, month, year);
    target = new Date(year, month, safeDay, 9, 0, 0, 0);
  }

  const hourMatch = raw.match(/\b(jam|pukul)\s*([0-9:. ]+(?:pagi|siang|sore|malam)?)/);
  const parsedHour = hourMatch ? parseHourText(hourMatch[2]) : null;
  if (parsedHour) {
    if (parsedHour.hour < 0 || parsedHour.hour > 23 || parsedHour.minute < 0 || parsedHour.minute > 59) {
      return { success: false, fireAt: null, reason: 'Format jam tidak valid.' };
    }
    target.setHours(parsedHour.hour, parsedHour.minute, 0, 0);
  } else if (!dayMatch && !raw.includes('besok') && !raw.includes('lusa')) {
    return {
      success: false,
      fireAt: null,
      reason: 'Tanggal/jam tidak terbaca. Gunakan contoh: "tgl 17 jam 19:00" atau "besok jam 7 malam".',
    };
  } else {
    target.setHours(9, 0, 0, 0);
  }

  if (target.getTime() <= now.getTime()) {
    return { success: false, fireAt: null, reason: 'Waktu sudah lewat. Pilih waktu setelah sekarang.' };
  }

  return {
    success: true,
    fireAt: target.toISOString(),
  };
};
