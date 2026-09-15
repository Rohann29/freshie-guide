"use client";

import { useState, useEffect, useMemo, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import collegeDictionary from './colleges.json';
import branchDictionary from './branches.json';

// Database Connection
const supabaseUrl = "https://miqyijdbfwsdxwpdizcc.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pcXlpamRiZndzZHh3cGRpemNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMzMzcyNzgsImV4cCI6MjA5ODkxMzI3OH0.n2uExa8DtZbBthwxd8cDtlLIEZISWetYlnqhZ71uOTE";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface CutoffData {
  id?: number;
  college_code: string;
  branch_code: string;
  seat_type: string;
  closing_percentile: number;
  year: number;
  cap_round: number;
}

type SortOption = 'percentile-desc' | 'percentile-asc' | 'branch-asc';

const POPULAR_COLLEGES = [
  { code: "01101", name: "Shri Sant Gajanan Maharaj, Shegaon" },
  { code: "01105", name: "Prof. Ram Meghe, Amravati" },
  { code: "03012", name: "VJTI, Mumbai" },
  { code: "06006", name: "COEP Tech, Pune" },
  { code: "06007", name: "Walchand College of Engineering, Sangli" },
  { code: "06271", name: "PICT, Pune" },
  { code: "06276", name: "Cummins College of Engineering for Women, Pune" },
];

export default function Home() {
  const [searchInput, setSearchInput] = useState('');
  const [suggestions, setSuggestions] = useState<{ code: string; name: string }[]>([]);
  const [activeCollegeCode, setActiveCollegeCode] = useState('');
  const [activeCollegeName, setActiveCollegeName] = useState('');
  
  const [selectedRound, setSelectedRound] = useState<number>(1);
  const [selectedQuota, setSelectedQuota] = useState<'MH' | 'AI'>('MH');
  
  const [results, setResults] = useState<CutoffData[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  
  // Filters & Sorting within results
  const [branchFilter, setBranchFilter] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [sortBy, setSortBy] = useState<SortOption>('percentile-desc');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Dynamic Category Extraction from current results
  const availableCategories = useMemo(() => {
    const categories = Array.from(new Set(results.map((r) => r.seat_type))).filter(Boolean);
    return categories.sort();
  }, [results]);

  // Handle outside click to close suggestions
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setSuggestions([]);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleType = (text: string) => {
    setSearchInput(text);
    if (text.trim().length > 1) {
      const q = text.toLowerCase().trim();
      const matches = Object.entries(collegeDictionary)
        .filter(([code, name]) => 
          name.toLowerCase().includes(q) || code.toLowerCase().includes(q)
        )
        .map(([code, name]) => ({ code, name }));
      setSuggestions(matches.slice(0, 8));
    } else {
      setSuggestions([]);
    }
  };

  const fetchCutoffs = async (collegeCode: string, round: number, quota: 'MH' | 'AI') => {
    if (!collegeCode) return;
    
    setLoading(true);
    setHasSearched(true);
    setSelectedCategory('All');
    
    try {
      let query = supabase
        .from('raw_cutoffs')
        .select('*')
        .eq('college_code', collegeCode)
        .eq('cap_round', round)
        .order('closing_percentile', { ascending: false });

      if (quota === 'AI') {
        query = query.eq('seat_type', 'AI');
      } else {
        query = query.neq('seat_type', 'AI');
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching cutoffs:", error);
        setResults([]);
      } else {
        setResults((data as CutoffData[]) || []);
      }
    } catch (err) {
      console.error("Fetch exception:", err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectCollege = (code: string, name: string) => {
    setSearchInput(name);
    setActiveCollegeCode(code);
    setActiveCollegeName(name);
    setSuggestions([]);
    fetchCutoffs(code, selectedRound, selectedQuota);
  };

  const handleQuotaChange = (newQuota: 'MH' | 'AI') => {
    setSelectedQuota(newQuota);
    if (activeCollegeCode) {
      fetchCutoffs(activeCollegeCode, selectedRound, newQuota);
    }
  };

  const handleRoundChange = (newRound: number) => {
    setSelectedRound(newRound);
    if (activeCollegeCode) {
      fetchCutoffs(activeCollegeCode, newRound, selectedQuota);
    }
  };

  const handleSearchClick = () => {
    if (activeCollegeCode) {
      fetchCutoffs(activeCollegeCode, selectedRound, selectedQuota);
    } else if (searchInput.trim().length > 0) {
      // Find best match if exact code not selected yet
      const firstMatch = Object.entries(collegeDictionary).find(([code, name]) =>
        name.toLowerCase().includes(searchInput.toLowerCase()) || code === searchInput.trim()
      );
      if (firstMatch) {
        handleSelectCollege(firstMatch[0], firstMatch[1]);
      }
    }
  };

  // Filtered and sorted results (Client-side instant filtering)
  const processedResults = useMemo(() => {
    let list = [...results];

    // Filter by branch search text
    if (branchFilter.trim()) {
      const q = branchFilter.toLowerCase().trim();
      list = list.filter((row) => {
        const branchName = ((branchDictionary as Record<string, string>)[row.branch_code] || row.branch_code).toLowerCase();
        const code = row.branch_code.toLowerCase();
        const seat = row.seat_type.toLowerCase();
        return branchName.includes(q) || code.includes(q) || seat.includes(q);
      });
    }

    // Filter by selected reservation category
    if (selectedCategory !== 'All') {
      list = list.filter((row) => row.seat_type === selectedCategory);
    }

    // Sort results
    list.sort((a, b) => {
      if (sortBy === 'percentile-desc') {
        return b.closing_percentile - a.closing_percentile;
      }
      if (sortBy === 'percentile-asc') {
        return a.closing_percentile - b.closing_percentile;
      }
      if (sortBy === 'branch-asc') {
        const nameA = (branchDictionary as Record<string, string>)[a.branch_code] || a.branch_code;
        const nameB = (branchDictionary as Record<string, string>)[b.branch_code] || b.branch_code;
        return nameA.localeCompare(nameB);
      }
      return 0;
    });

    return list;
  }, [results, branchFilter, selectedCategory, sortBy]);

  // Copy code helper
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(text);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  return (
    <div className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f] flex flex-col font-sans selection:bg-[#0071e3]/20 selection:text-[#0071e3]">
      {/* Top Navbar - Apple Style Translucent */}
      <header className="sticky top-0 z-40 bg-white/70 backdrop-blur-xl border-b border-gray-200/50 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-[#1d1d1f]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                <path d="M6 12v5c3 3 9 3 12 0v-5" />
              </svg>
              <span className="font-semibold text-[15px] tracking-tight text-[#1d1d1f]">
                FreshieGuide
              </span>
              <span className="text-[10px] font-medium uppercase tracking-widest px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full ml-1">
                25-26
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100/80 rounded-full text-gray-500 text-[11px] font-medium">
              <span className="w-2 h-2 bg-green-500 rounded-full" />
              <span>System Online</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-10 z-10 flex flex-col gap-10">
        
        {/* Header Text */}
        <div className="text-center max-w-2xl mx-auto mt-4">
          <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight text-[#1d1d1f] mb-4">
            Find your institute.
          </h1>
          <p className="text-[#86868b] text-lg sm:text-xl font-medium tracking-tight">
            Search closing percentiles across all Maharashtra Engineering Colleges.
          </p>
        </div>

        {/* Search & Filter Control Hub */}
        <div className="bg-white rounded-[32px] p-6 sm:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
          <div className="flex flex-col gap-6">
            
            {/* Main Search Input */}
            <div className="relative" ref={searchContainerRef}>
              <div className="relative flex items-center">
                <svg className="absolute left-4 w-5 h-5 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => handleType(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      if (suggestions.length > 0) {
                        handleSelectCollege(suggestions[0].code, suggestions[0].name);
                      } else {
                        handleSearchClick();
                      }
                    }
                  }}
                  placeholder="Search by institute name or DTE code..."
                  className="w-full bg-[#f5f5f7] text-[#1d1d1f] placeholder-gray-500 text-[17px] pl-12 pr-12 py-4 rounded-2xl outline-none focus:ring-4 focus:ring-[#0071e3]/20 transition-all border-none"
                />
                {searchInput && (
                  <button
                    onClick={() => {
                      setSearchInput('');
                      setActiveCollegeCode('');
                      setActiveCollegeName('');
                      setSuggestions([]);
                    }}
                    className="absolute right-4 text-gray-400 hover:text-gray-600 bg-gray-200/50 hover:bg-gray-200 rounded-full p-1 transition-colors cursor-pointer"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Auto-suggest Dropdown */}
              {suggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-2 bg-white/80 backdrop-blur-2xl rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-gray-100 z-50 overflow-hidden max-h-72 overflow-y-auto">
                  {suggestions.map((s) => (
                    <button
                      key={s.code}
                      onClick={() => handleSelectCollege(s.code, s.name)}
                      className="w-full text-left px-5 py-3.5 hover:bg-black/5 flex items-center gap-4 transition-colors border-b border-gray-100/50 last:border-0 cursor-pointer"
                    >
                      <span className="font-semibold text-[13px] text-gray-500 shrink-0 bg-gray-100 px-2 py-1 rounded-md">
                        {s.code}
                      </span>
                      <span className="text-[15px] text-[#1d1d1f] font-medium truncate">
                        {s.name}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-end">
              {/* Quota Selector (Segmented Control) */}
              <div className="md:col-span-5">
                <label className="block text-[12px] font-medium text-gray-500 mb-2 pl-1">
                  Examination Quota
                </label>
                <div className="flex bg-[#f5f5f7] p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => handleQuotaChange('MH')}
                    className={`flex-1 py-2 px-3 text-[14px] font-medium rounded-lg transition-all cursor-pointer ${
                      selectedQuota === 'MH'
                        ? 'bg-white text-[#1d1d1f] shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    MHT-CET
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuotaChange('AI')}
                    className={`flex-1 py-2 px-3 text-[14px] font-medium rounded-lg transition-all cursor-pointer ${
                      selectedQuota === 'AI'
                        ? 'bg-white text-[#1d1d1f] shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    JEE Main
                  </button>
                </div>
              </div>

              {/* CAP Round Selector */}
              <div className="md:col-span-4">
                <label className="block text-[12px] font-medium text-gray-500 mb-2 pl-1">
                  CAP Round
                </label>
                <div className="relative">
                  <select
                    value={selectedRound}
                    onChange={(e) => handleRoundChange(Number(e.target.value))}
                    className="w-full appearance-none bg-[#f5f5f7] text-[#1d1d1f] text-[15px] font-medium px-4 py-2.5 rounded-xl outline-none focus:ring-4 focus:ring-[#0071e3]/20 cursor-pointer pr-10"
                  >
                    <option value={1}>Round 1</option>
                    <option value={2}>Round 2</option>
                    <option value={3}>Round 3</option>
                    <option value={4}>Round 4 (Spot)</option>
                  </select>
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Search Button */}
              <div className="md:col-span-3">
                <button
                  onClick={handleSearchClick}
                  disabled={loading || (!activeCollegeCode && !searchInput.trim())}
                  className="w-full bg-[#0071e3] text-white disabled:bg-[#0071e3]/50 font-medium text-[15px] py-2.5 px-4 rounded-xl hover:bg-[#0077ED] transition-colors shadow-sm disabled:shadow-none cursor-pointer"
                >
                  {loading ? 'Searching...' : 'Show Cutoffs'}
                </button>
              </div>
            </div>
            
            {/* Quick Picks */}
            <div className="flex items-center gap-2 flex-wrap pt-2">
              <span className="text-[12px] font-medium text-gray-400 mr-2">Suggested:</span>
              {POPULAR_COLLEGES.map((col) => (
                <button
                  key={col.code}
                  onClick={() => handleSelectCollege(col.code, col.name)}
                  className={`text-[12px] px-3 py-1.5 rounded-full font-medium transition-colors cursor-pointer ${
                    activeCollegeCode === col.code
                      ? "bg-[#0071e3] text-white"
                      : "bg-[#f5f5f7] text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {col.name.split(',')[0]}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Results Area */}
        {hasSearched && (
          <div className="flex flex-col gap-6">
            {/* Active College Banner & Stats */}
            {activeCollegeCode && (
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 px-2">
                <div className="flex flex-col gap-1">
                  <h2 className="text-2xl sm:text-3xl font-semibold text-[#1d1d1f] tracking-tight">
                    {activeCollegeName || (collegeDictionary as Record<string, string>)[activeCollegeCode] || `Institute ${activeCollegeCode}`}
                  </h2>
                  <div className="flex items-center gap-2 text-[13px] font-medium text-gray-500">
                    <span>Code: {activeCollegeCode}</span>
                    <span>•</span>
                    <span>{selectedQuota === 'AI' ? 'All India (JEE)' : 'Maharashtra State (CET)'}</span>
                    <span>•</span>
                    <span>Round {selectedRound}</span>
                  </div>
                </div>

                {/* Filters */}
                {results.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <input
                      type="text"
                      value={branchFilter}
                      onChange={(e) => setBranchFilter(e.target.value)}
                      placeholder="Filter branch..."
                      className="bg-white text-[13px] text-[#1d1d1f] px-3 py-2 rounded-lg outline-none focus:ring-2 focus:ring-[#0071e3]/20 shadow-sm border border-gray-100 w-32 transition-all"
                    />
                    <select
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      className="bg-white text-[13px] text-[#1d1d1f] px-3 py-2 rounded-lg outline-none cursor-pointer shadow-sm border border-gray-100 transition-all"
                    >
                      <option value="All">All Categories</option>
                      {availableCategories.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as SortOption)}
                      className="bg-white text-[13px] text-[#1d1d1f] px-3 py-2 rounded-lg outline-none cursor-pointer shadow-sm border border-gray-100 transition-all"
                    >
                      <option value="percentile-desc">Highest Cutoff</option>
                      <option value="percentile-asc">Lowest Cutoff</option>
                      <option value="branch-asc">Branch A-Z</option>
                    </select>
                  </div>
                )}
              </div>
            )}

            {/* Results Cards Grid (Apple Style Cards) */}
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {[1, 2, 3, 4].map((idx) => (
                  <div key={idx} className="bg-white rounded-[24px] p-6 shadow-sm border border-gray-100/50 animate-pulse h-40" />
                ))}
              </div>
            ) : processedResults.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {processedResults.map((row, index) => {
                  const branchName = (branchDictionary as Record<string, string>)[row.branch_code] || row.branch_code;
                  const isAI = row.seat_type === 'AI';

                  return (
                    <div
                      key={row.id || index}
                      className="bg-white rounded-[24px] p-6 shadow-[0_2px_12px_rgb(0,0,0,0.03)] border border-gray-100 hover:shadow-[0_8px_24px_rgb(0,0,0,0.06)] transition-all flex flex-col justify-between gap-6 group"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-3 mb-1">
                          <h3 className="font-semibold text-[17px] text-[#1d1d1f] leading-tight group-hover:text-[#0071e3] transition-colors">
                            {branchName}
                          </h3>
                          <span className="shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-[#f5f5f7] text-gray-500 uppercase tracking-wider">
                            {isAI ? 'JEE' : row.seat_type}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-2 mt-2">
                          <button
                            onClick={() => copyToClipboard(row.branch_code)}
                            className="inline-flex items-center gap-1 text-[13px] font-medium text-gray-500 hover:text-[#0071e3] transition-colors bg-gray-50 hover:bg-[#0071e3]/10 px-2 py-1 rounded-md cursor-pointer"
                            title="Copy Choice Code"
                          >
                            <span>Code {row.branch_code}</span>
                            {copiedCode === row.branch_code ? (
                              <svg className="w-3.5 h-3.5 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            ) : (
                              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                              </svg>
                            )}
                          </button>
                        </div>
                      </div>

                      <div className="pt-4 border-t border-gray-100 flex items-end justify-between">
                        <div className="text-[13px] font-medium text-gray-500">
                          {isAI ? 'JEE Percentile' : 'CET Percentile'}
                        </div>
                        <div className="text-3xl font-semibold tracking-tight text-[#1d1d1f]">
                          {row.closing_percentile.toFixed(4)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-white rounded-[32px] p-12 text-center shadow-[0_2px_12px_rgb(0,0,0,0.03)] border border-gray-100 flex flex-col items-center justify-center min-h-[300px]">
                <div className="w-16 h-16 bg-[#f5f5f7] rounded-full flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                </div>
                <h3 className="text-[20px] font-semibold text-[#1d1d1f] mb-2">No Cutoffs Found</h3>
                <p className="text-[15px] text-gray-500 max-w-sm mb-6">
                  We couldn't find any results matching your current filters. Try adjusting your search criteria.
                </p>
                <div className="flex gap-3">
                  {(selectedCategory !== 'All' || branchFilter) && (
                    <button
                      onClick={() => { setSelectedCategory('All'); setBranchFilter(''); }}
                      className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-[#1d1d1f] text-[14px] font-medium rounded-full transition-colors cursor-pointer"
                    >
                      Clear Filters
                    </button>
                  )}
                </div>
              </div>
            )}
            
            {processedResults.length > 0 && (
              <div className="text-center mt-4">
                <span className="text-[13px] font-medium text-gray-400">
                  Showing {processedResults.length} {processedResults.length === 1 ? 'result' : 'results'}
                </span>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}