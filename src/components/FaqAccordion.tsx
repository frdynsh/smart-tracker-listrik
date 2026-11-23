// src/components/FaqAccordion.tsx
"use client";

import { useState } from "react";

interface FaqItem {
  icon: string;
  question: string;
  answer: string;
}

const FAQ_ITEMS: FaqItem[] = [
  {
    icon: "help_outline",
    question:
      "Perangkat elektronik apa saja yang aman dihubungkan ke alat ini?",
    answer:
      "Modul menggunakan sensor PZEM-004T 10A dengan kotak tertutup berisolasi untuk beban rumah tangga ringan hingga batas uji aman ≤ 600 Watt, seperti kipas angin, lampu meja, pengisi daya, atau teko listrik kecil.",
  },
  {
    icon: "electrical_services",
    question: "Apakah perlu mengubah atau membongkar instalasi kabel di rumah?",
    answer:
      "Tidak sama sekali. Alat bekerja sebagai colokan perantara: cukup tancapkan steker modul ke stopkontak dinding yang ada, lalu colokkan perangkat elektronik Anda ke stopkontak keluaran modul.",
  },
  {
    icon: "wifi_off",
    question: "Bagaimana jika koneksi Wi-Fi di rumah tiba-tiba terputus?",
    answer:
      "Data pembacaan tetap tersimpan sementara di memori internal ESP32 (buffer offline) dan otomatis dikirim ulang saat Wi-Fi kembali terhubung. Jika alat tidak mengirim data lebih dari 2 menit, dashboard akan menampilkan penanda Alat Offline.",
  },
  {
    icon: "payments",
    question: "Apakah ada biaya langganan bulanan untuk memakai aplikasi ini?",
    answer:
      "Tidak ada biaya langganan. Seluruh fitur pemantauan real-time, peringatan batas pemakaian, dan simulasi penghematan dapat digunakan gratis bersama modul IoT Anda.",
  },
  {
    icon: "devices",
    question: "Berapa banyak perangkat yang bisa dipantau secara bersamaan?",
    answer:
      "Anda dapat menambahkan beberapa modul Smart Tracker dalam satu akun dashboard sesuai prinsip 1 modul untuk 1 perangkat elektronik.",
  },
];

export default function FaqAccordion() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggleItem = (index: number) => {
    setOpenIndex((prev) => (prev === index ? null : index));
  };

  return (
    <div className="w-full max-w-3xl flex flex-col gap-3.5 sm:gap-4">
      {FAQ_ITEMS.map((item, index) => {
        const isOpen = openIndex === index;

        return (
          <div
            key={item.question}
            className={`bg-surface-container-lowest rounded-2xl border shadow-xs overflow-hidden transition-colors ${
              isOpen ? "border-primary/40" : "border-outline-variant"
            }`}
          >
            <button
              type="button"
              onClick={() => toggleItem(index)}
              aria-expanded={isOpen}
              className="w-full p-5 sm:p-6 flex items-center justify-between gap-3 text-left font-bold text-base sm:text-lg text-on-surface hover:text-primary transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-3 pr-2">
                <span className="w-8 h-8 rounded-lg bg-primary-fixed text-primary flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[20px]">
                    {item.icon}
                  </span>
                </span>
                <span>{item.question}</span>
              </span>
              <span
                className={`material-symbols-outlined text-on-surface-variant transition-transform duration-200 shrink-0 ${
                  isOpen ? "rotate-180 text-primary" : ""
                }`}
              >
                expand_more
              </span>
            </button>

            <div
              className={`grid transition-all duration-200 ease-in-out ${
                isOpen
                  ? "grid-rows-[1fr] opacity-100"
                  : "grid-rows-[0fr] opacity-0"
              }`}
            >
              <div className="overflow-hidden">
                <div className="px-5 sm:px-6 pb-5 sm:pb-6 pt-3 text-xs sm:text-sm text-on-surface-variant leading-relaxed border-t border-outline-variant/60 bg-surface-container-low/60">
                  {item.answer}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
