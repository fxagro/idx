import React from "react";
import Header from "../components/Header";
import Footer from "../components/Footer";

export default function MainLayout({ children }) {
  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-slate-900 text-gray-900 dark:text-slate-100 transition-colors duration-300">
      {/* Header selalu tampil */}
      <Header />

      {/* Konten halaman */}
      <main className="flex-1">{children}</main>

      {/* Footer selalu tampil */}
      <Footer />
    </div>
  );
}
