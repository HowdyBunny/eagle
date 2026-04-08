/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { MapPin, RefreshCw, ChevronDown } from 'lucide-react';

export default function App() {
  return (
    <div className="w-[360px] bg-white shadow-2xl rounded-md overflow-hidden font-sans border border-gray-200">
      {/* Header */}
      <div className="flex items-center px-5 py-4 border-b border-eagle-border/60">
        <div className="relative w-8 h-8 mr-3 flex-shrink-0">
          {/* Custom Eagle Hexagon Logo using SVG */}
          <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-sm">
            <defs>
              <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#e8d08d" />
                <stop offset="50%" stopColor="#c5a028" />
                <stop offset="100%" stopColor="#8a6d1c" />
              </linearGradient>
            </defs>
            <polygon points="50,5 95,27.5 95,72.5 50,95 5,72.5 5,27.5" fill="url(#goldGrad)" opacity="0.2" />
            <polygon points="50,10 88,32 88,68 50,90 12,68 12,32" fill="url(#goldGrad)" />
            {/* Abstract Eagle Head Profile */}
            <path d="M 30 45 Q 45 35 65 40 Q 75 45 85 60 Q 70 50 60 55 Q 55 65 45 75 Q 35 60 30 45 Z" fill="#ffffff" />
            <circle cx="55" cy="45" r="3" fill="#745b00" />
            <path d="M 65 40 Q 75 40 85 45 Q 75 48 65 45 Z" fill="#ffffff" />
          </svg>
        </div>
        <h1 className="text-[22px] font-display font-medium text-eagle-primary tracking-tight">
          Eagle Elite <span className="text-[18px] font-sans font-medium ml-1">猎头助手</span>
        </h1>
      </div>

      {/* Main Content */}
      <div className="p-5">
        {/* Candidate Card */}
        <div className="bg-gradient-to-br from-eagle-card-start to-eagle-card-end border border-eagle-border rounded-xl p-5 mb-6 relative overflow-hidden group">
          {/* Subtle hover effect watermark */}
          <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-eagle-gold opacity-0 group-hover:opacity-5 rounded-full blur-2xl transition-opacity duration-500 pointer-events-none"></div>
          
          <h2 className="text-2xl font-display font-bold text-eagle-gold mb-1.5">
            Duran Z.
          </h2>
          <p className="text-[17px] text-eagle-ink mb-4">
            Product director
          </p>
          
          <div className="flex items-center text-eagle-gold/90 mb-3">
            <MapPin className="w-[18px] h-[18px] mr-1.5 fill-eagle-gold/20" strokeWidth={2.5} />
            <span className="text-[15px] font-medium">Hong Kong SAR</span>
          </div>
          
          <a href="#" className="inline-block text-[15px] text-eagle-gold/90 font-medium underline underline-offset-4 decoration-eagle-gold/40 hover:decoration-eagle-gold transition-colors">
            LinkedIn
          </a>
        </div>

        {/* Action Section */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-3">
            <label className="text-[15px] font-bold text-eagle-gold tracking-wide">
              关联项目
            </label>
            <button className="text-eagle-gold/70 hover:text-eagle-gold transition-colors">
              <RefreshCw className="w-4 h-4" strokeWidth={2.5} />
            </button>
          </div>
          
          <div className="relative">
            <select className="w-full appearance-none bg-white border border-eagle-gold/40 rounded-lg py-3.5 px-4 text-[15px] text-eagle-ink font-medium focus:outline-none focus:border-eagle-gold focus:ring-1 focus:ring-eagle-gold transition-shadow cursor-pointer">
              <option>— 不关联项目 —</option>
              <option>Senior Product Manager</option>
              <option>VP of Product</option>
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-eagle-gold">
              <ChevronDown className="w-5 h-5" strokeWidth={2} />
            </div>
          </div>
        </div>

        {/* Primary Action Button */}
        <button className="w-full bg-gradient-to-br from-[#d4b344] to-[#b8921c] hover:from-[#c5a028] hover:to-[#a38014] text-white text-[17px] font-medium py-3.5 rounded-lg shadow-sm transition-all active:scale-[0.98]">
          采集候选人
        </button>
      </div>

      {/* Footer Status */}
      <div className="px-5 py-4 border-t border-eagle-border/40 flex items-center bg-white">
        <div className="w-2.5 h-2.5 rounded-full bg-[#c5a028] mr-2.5"></div>
        <span className="text-[15px] text-eagle-ink font-medium">待采集</span>
      </div>
    </div>
  );
}
