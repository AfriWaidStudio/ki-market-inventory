import { SVGProps } from "react";

export function IllustrationScanner({ ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 400 300" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <rect width="400" height="300" fill="url(#gradient)" />
      <circle cx="200" cy="150" r="80" fill="white" fillOpacity="0.1" />
      <path d="M200 70 L250 150 L200 230 L150 150 Z" fill="white" fillOpacity="0.2" />
      <circle cx="200" cy="150" r="30" fill="white" />
      <text x="200" y="155" fontSize="14" fontWeight="bold" fill="#ffffff" textAnchor="middle">SCAN</text>
      <rect x="100" y="100" width="200" height="80" rx="8" fill="#3B82F6" fillOpacity="0.3" />
      <text x="200" y="145" fontSize="12" fill="#ffffff" textAnchor="middle">Binance → Bybit</text>
      <text x="200" y="170" fontSize="11" fill="#ffffff" textAnchor="middle">+12.5% ROI</text>
    </svg>
  );
}

export function IllustrationPaperTrading({ ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 400 300" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <rect width="400" height="300" fill="url(#gradient)" />
      <rect x="50" y="100" width="100" height="80" rx="8" fill="#8B5CF6" fillOpacity="0.3" />
      <rect x="250" y="100" width="100" height="80" rx="8" fill="#8B5CF6" fillOpacity="0.3" />
      <text x="100" y="150" fontSize="12" fill="#ffffff" textAnchor="middle">Paper Buy</text>
      <text x="300" y="150" fontSize="12" fill="#ffffff" textAnchor="middle">Paper Close</text>
      <line x1="50" y1="140" x2="350" y2="140" stroke="#ffffff" strokeOpacity="0.3" strokeDasharray="4 4" />
      <text x="200" y="175" fontSize="14" fill="#ffffff" textAnchor="middle" fontWeight="bold">SIMULATED</text>
      <text x="200" y="195" fontSize="11" fill="#ffffff" textAnchor="middle">No real transaction</text>
      <circle cx="100" cy="80" r="20" fill="#F59E0B" />
      <text x="100" y="85" fontSize="10" fill="#ffffff" textAnchor="middle">$0</text>
      <circle cx="300" cy="80" r="20" fill="#10B981" />
      <text x="300" y="85" fontSize="10" fill="#ffffff" textAnchor="middle">+12.5%</text>
    </svg>
  );
}

export function IllustrationAnalytics({ ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 400 300" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <rect width="400" height="300" fill="url(#gradient)" />
      <rect x="50" y="150" width="300" height="10" fill="#333333" fillOpacity="0.3" />
      <path d="M100 200 L150 120 L200 180 L250 100 L300 140 L350 80" fill="none" stroke="#3B82F6" strokeWidth="3" />
      <circle cx="150" cy="120" r="6" fill="#3B82F6" />
      <circle cx="250" cy="100" r="6" fill="#3B82F6" />
      <text x="200" y="240" fontSize="12" fill="#ffffff" textAnchor="middle">Today</text>
      <text x="200" y="270" fontSize="11" fill="#ffffff" textAnchor="middle">+₦12,500</text>
      <rect x="120" y="50" width="160" height="60" rx="6" fill="#1F2937" />
      <text x="200" y="75" fontSize="12" fill="#ffffff" textAnchor="middle" fontWeight="bold">Profit Analytics</text>
      <text x="200" y="95" fontSize="10" fill="#9CA3AF" textAnchor="middle">Paper: ₦0 | Manual: ₦12,500</text>
    </svg>
  );
}

export function IllustrationKI({ ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 400 300" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <rect width="400" height="300" fill="url(#gradient)" />
      <rect x="100" y="100" width="200" height="100" rx="12" fill="#1E40AF" fillOpacity="0.3" />
      <text x="200" y="135" fontSize="14" fill="#ffffff" textAnchor="middle" fontWeight="bold">KI Intelligence</text>
      <text x="200" y="160" fontSize="11" fill="#ffffff" textAnchor="middle">Ask about your trades</text>
      <path d="M200 180 Q220 200 240 180" fill="none" stroke="#60A5FA" strokeWidth="2" />
      <circle cx="200" cy="120" r="30" fill="#60A5FA" />
      <text x="200" y="125" fontSize="16" fontWeight="bold" fill="#1F2937">KI</text>
      <rect x="80" y="220" width="240" height="60" rx="8" fill="#1F2937" />
      <text x="200" y="245" fontSize="10" fill="#9CA3AF" textAnchor="middle">"Should I close this trade?"</text>
      <text x="200" y="265" fontSize="10" fill="#9CA3AF" textAnchor="middle">"Which route works best?"</text>
    </svg>
  );
}

export function IllustrationRiskManagement({ ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 400 300" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <rect width="400" height="300" fill="url(#gradient)" />
      <rect x="50" y="120" width="100" height="60" rx="8" fill="#EF4444" fillOpacity="0.3" />
      <rect x="250" y="120" width="100" height="60" rx="8" fill="#22C55E" fillOpacity="0.3" />
      <text x="100" y="160" fontSize="10" fill="#ffffff" textAnchor="middle">Loss</text>
      <text x="300" y="160" fontSize="10" fill="#ffffff" textAnchor="middle">Profit</text>
      <rect x="150" y="80" width="100" height="40" rx="6" fill="#3B82F6" />
      <text x="200" y="105" fontSize="10" fill="#ffffff" textAnchor="middle">Total: ₦50,000</text>
      <text x="200" y="200" fontSize="14" fill="#ffffff" textAnchor="middle" fontWeight="bold">Risk Dashboard</text>
      <text x="200" y="225" fontSize="11" fill="#9CA3AF" textAnchor="middle">Capital: ₦150,000 | Fees: ₦2,500</text>
    </svg>
  );
}

export function IllustrationJournal({ ...props}: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 400 300" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <rect width="400" height="300" fill="url(#gradient)" />
      <rect x="50" y="50" width="300" height="200" rx="8" fill="#1F2937" />
      <text x="200" y="80" fontSize="14" fontWeight="bold" fill="#ffffff" textAnchor="middle">Trade Journal</text>
      <rect x="60" y="100" width="280" height="40" rx="4" fill="#374151" />
      <text x="200" y="125" fontSize="11" fill="#9CA3AF" textAnchor="middle">What went well: Fast execution</text>
      <rect x="60" y="160" width="280" height="40" rx="4" fill="#374151" />
      <text x="200" y="185" fontSize="11" fill="#9CA3AF" textAnchor="middle">Lesson: Check fees before entering</text>
      <rect x="200" y="230" width="80" height="30" rx="4" fill="#22C55E" />
      <text x="240" y="250" fontSize="10" fill="#ffffff" textAnchor="middle">✓ Repeat</text>
    </svg>
  );
}