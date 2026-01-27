import React from 'react'

export default function Footer(){
  return (
    <footer className="bg-white border-t mt-10">
      <div className="max-w-6xl mx-auto px-4 py-6 text-sm text-gray-600 flex flex-col sm:flex-row justify-between">
        <div>© {new Date().getFullYear()} myTradeX</div>
        <div>Made for investors — AI Trading Platform Indonesia</div>
      </div>
    </footer>
  )
}
