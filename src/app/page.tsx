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
    <div className="min-h-screen bg-[#0B0F19] text-slate-100 flex flex-col relative selection:bg-blue-600/30 selection:text-blue-200">
      {/* Background Ambient Glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[450px] bg-gradient-to-tr from-blue-600/15 via-indigo-600/15 to-violet-600/10 rounded-full blur-3xl" />
        <div className="absolute top-1/3 -left-48 w-96 h-96 bg-cyan-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-10 -right-48 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl" />
      </div>

      {/* Top Navbar */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-[#0B0F19]/80 border-b border-slate-800/80 px-4 sm:px-8 py-3.5">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 via-indigo-600 to-violet-600 p-[1px] shadow-lg shadow-blue-500/20">
              <div className="w-full h-full bg-slate-950 rounded-[11px] flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                  <path d="M6 12v5c3 3 9 3 12 0v-5" />
                </svg>
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent">
                  Freshie Guide
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  AY 2025-26
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Maharashtra Engineering Cutoff Engine (MHT-CET & JEE Main)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/80 border border-slate-800 text-slate-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Database Connected</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-8 py-8 z-10">
        {/* Hero Section */}
        <div className="text-center max-w-2xl mx-auto mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r from-blue-500/10 to-indigo-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium mb-4">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polygon points="12 8 8 12 12 16 12 8" />
            </svg>
            Official CAP Rounds 1, 2, 3 & 4 Cutoff Data
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white mb-4">
            Find Your Dream College <br className="hidden sm:inline" />
            <span className="bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-400 bg-clip-text text-transparent">
              Cutoffs in Seconds
            </span>
          </h1>
          <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
            Search closing percentiles across all Maharashtra Engineering Institutes for both State (MHT-CET) and All India (JEE Main) quotas.
          </p>
        </div>

        {/* Search & Filter Control Hub */}
        <div className="bg-slate-900/70 border border-slate-800/80 backdrop-blur-xl rounded-3xl p-5 sm:p-7 shadow-2xl shadow-black/40 mb-8 transition-all">
          {/* Main Search Input */}
          <div className="relative mb-5" ref={searchContainerRef}>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Search College by Name or DTE Code
            </label>
            <div className="relative flex items-center">
              <div className="absolute left-4 pointer-events-none text-slate-400">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </div>

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
                placeholder="Type college name (e.g. VJTI, COEP, Walchand, Prof. Ram Meghe, Cummins)..."
                className="w-full bg-slate-950/80 border border-slate-700/80 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 text-white placeholder-slate-500 text-sm sm:text-base rounded-2xl pl-12 pr-10 py-3.5 outline-none transition-all"
              />

              {searchInput && (
                <button
                  onClick={() => {
                    setSearchInput('');
                    setActiveCollegeCode('');
                    setActiveCollegeName('');
                    setSuggestions([]);
                  }}
                  className="absolute right-4 text-slate-400 hover:text-white p-1 rounded-full hover:bg-slate-800 transition-colors"
                  title="Clear search"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
            </div>

            {/* Auto-suggest Dropdown */}
            {suggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-2 bg-slate-900/95 border border-slate-700/90 rounded-2xl shadow-2xl backdrop-blur-2xl z-50 overflow-hidden divide-y divide-slate-800/60 max-h-80 overflow-y-auto">
                <div className="px-4 py-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider bg-slate-950/60 flex items-center justify-between">
                  <span>Matching Colleges ({suggestions.length})</span>
                  <span>Click to select</span>
                </div>
                {suggestions.map((s) => (
                  <button
                    key={s.code}
                    onClick={() => handleSelectCollege(s.code, s.name)}
                    className="w-full text-left px-4 py-3 hover:bg-blue-600/10 flex items-center justify-between gap-3 group transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20 shrink-0">
                        {s.code}
                      </span>
                      <span className="text-sm font-medium text-slate-200 group-hover:text-blue-300 truncate">
                        {s.name}
                      </span>
                    </div>
                    <svg className="w-4 h-4 text-slate-500 group-hover:text-blue-400 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Quick Popular Picks */}
          <div className="flex items-center gap-2 flex-wrap mb-6">
            <span className="text-xs text-slate-400 font-medium">Quick Picks:</span>
            {POPULAR_COLLEGES.map((col) => (
              <button
                key={col.code}
                onClick={() => handleSelectCollege(col.code, col.name)}
                className={`text-xs px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                  activeCollegeCode === col.code
                    ? "bg-blue-600/20 border-blue-500 text-blue-300 font-semibold"
                    : "bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700"
                }`}
              >
                {col.name.split(',')[0]}
              </button>
            ))}
          </div>

          {/* Filters Bar: Quota Toggle, Round Selector, Search Button */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-end pt-4 border-t border-slate-800/80">
            {/* Quota Selector */}
            <div className="sm:col-span-6 md:col-span-5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Seat Quota / Exam Type
              </label>
              <div className="grid grid-cols-2 p-1 bg-slate-950/90 border border-slate-800 rounded-xl">
                <button
                  type="button"
                  onClick={() => handleQuotaChange('MH')}
                  className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    selectedQuota === 'MH'
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-600/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                  }`}
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <path d="M3 9h18" />
                    <path d="M9 21V9" />
                  </svg>
                  <span>State Seats (CET)</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuotaChange('AI')}
                  className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    selectedQuota === 'AI'
                      ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-md shadow-purple-600/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                  }`}
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="2" y1="12" x2="22" y2="12" />
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                  </svg>
                  <span>All India (JEE)</span>
                </button>
              </div>
            </div>

            {/* CAP Round Selector */}
            <div className="sm:col-span-6 md:col-span-4">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                CAP Admission Round
              </label>
              <div className="relative">
                <select
                  value={selectedRound}
                  onChange={(e) => handleRoundChange(Number(e.target.value))}
                  className="w-full appearance-none bg-slate-950/90 border border-slate-800 text-slate-200 text-sm font-semibold rounded-xl px-4 py-2.5 outline-none focus:border-blue-500 cursor-pointer pr-10 hover:border-slate-700 transition-colors"
                >
                  <option value={1}>CAP Round 1 (Initial)</option>
                  <option value={2}>CAP Round 2</option>
                  <option value={3}>CAP Round 3</option>
                  <option value={4}>CAP Round 4 (Final)</option>
                </select>
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Search Button */}
            <div className="sm:col-span-12 md:col-span-3">
              <button
                onClick={handleSearchClick}
                disabled={loading || (!activeCollegeCode && !searchInput.trim())}
                className="w-full bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-2.5 px-6 rounded-xl shadow-lg shadow-blue-600/25 hover:shadow-blue-600/40 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Fetching...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="11" cy="11" r="8" />
                      <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    <span>Search Cutoffs</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Search Results / Content Area */}
        {hasSearched && (
          <div className="space-y-6">
            {/* Active College Banner & Stats */}
            {activeCollegeCode && (
              <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-xl flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      Institute Code: {activeCollegeCode}
                    </span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-md border ${
                      selectedQuota === 'AI'
                        ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                        : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    }`}>
                      {selectedQuota === 'AI' ? '🇮🇳 All India (JEE Main)' : '🏛️ Maharashtra State (CET)'}
                    </span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700">
                      CAP Round {selectedRound}
                    </span>
                  </div>
                  <h2 className="text-lg sm:text-xl font-bold text-white">
                    {activeCollegeName || (collegeDictionary as Record<string, string>)[activeCollegeCode] || `College Code: ${activeCollegeCode}`}
                  </h2>
                </div>

                {/* Sub-filters within results: Branch Search, Reservation Category, Sort */}
                {results.length > 0 && (
                  <div className="flex items-center gap-2.5 flex-wrap">
                    {/* Branch text filter */}
                    <div className="relative">
                      <input
                        type="text"
                        value={branchFilter}
                        onChange={(e) => setBranchFilter(e.target.value)}
                        placeholder="Filter branch..."
                        className="bg-slate-950/80 border border-slate-800 focus:border-blue-500 text-xs text-slate-200 rounded-xl px-3 py-2 outline-none w-32 sm:w-40 hover:border-slate-700 transition-colors"
                      />
                      {branchFilter && (
                        <button
                          onClick={() => setBranchFilter('')}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs"
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    {/* Reservation Category Filter */}
                    <select
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      className="bg-slate-950/80 border border-slate-800 text-xs text-slate-300 rounded-xl px-3 py-2 outline-none cursor-pointer hover:border-slate-700 transition-colors"
                    >
                      <option value="All">All Categories ({availableCategories.length})</option>
                      {availableCategories.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat === 'AI' ? 'AI (All India)' : cat}
                        </option>
                      ))}
                    </select>

                    {/* Sort Options */}
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as SortOption)}
                      className="bg-slate-950/80 border border-slate-800 text-xs text-slate-300 rounded-xl px-3 py-2 outline-none cursor-pointer hover:border-slate-700 transition-colors"
                    >
                      <option value="percentile-desc">Cutoff: High to Low</option>
                      <option value="percentile-asc">Cutoff: Low to High</option>
                      <option value="branch-asc">Branch Name: A-Z</option>
                    </select>
                  </div>
                )}
              </div>
            )}

            {/* Results Count & Meta */}
            <div className="flex items-center justify-between text-xs text-slate-400 px-1">
              <span>
                Showing <strong className="text-slate-200">{processedResults.length}</strong> {processedResults.length === 1 ? 'cutoff entry' : 'cutoff entries'}
                {(branchFilter || selectedCategory !== 'All') && ` (filtered from ${results.length})`}
                {selectedCategory !== 'All' && (
                  <span className="ml-2 font-mono text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                    Category: {selectedCategory}
                  </span>
                )}
              </span>
              {results.length > 0 && (
                <span className="hidden sm:inline">
                  Highest: <strong className="text-emerald-400 font-mono">{Math.max(...results.map(r => r.closing_percentile)).toFixed(4)}%</strong>
                  {" • "}
                  Lowest: <strong className="text-blue-400 font-mono">{Math.min(...results.map(r => r.closing_percentile)).toFixed(4)}%</strong>
                </span>
              )}
            </div>

            {/* Results Cards Grid */}
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[1, 2, 3, 4, 5, 6].map((idx) => (
                  <div key={idx} className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-5 animate-pulse space-y-4">
                    <div className="h-5 bg-slate-800 rounded w-3/4" />
                    <div className="flex gap-2">
                      <div className="h-4 bg-slate-800 rounded w-20" />
                      <div className="h-4 bg-slate-800 rounded w-24" />
                    </div>
                    <div className="h-8 bg-slate-800/80 rounded-xl w-full" />
                  </div>
                ))}
              </div>
            ) : processedResults.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {processedResults.map((row, index) => {
                  const branchName = (branchDictionary as Record<string, string>)[row.branch_code] || row.branch_code;
                  const isAI = row.seat_type === 'AI';

                  // Calculate percentile color and bar width
                  const perc = row.closing_percentile;
                  const isHighTier = perc >= 90;
                  const isMidTier = perc >= 75 && perc < 90;

                  return (
                    <div
                      key={row.id || index}
                      className="group bg-slate-900/60 hover:bg-slate-900/90 border border-slate-800/80 hover:border-blue-500/40 rounded-2xl p-5 backdrop-blur-xl transition-all duration-200 hover:shadow-xl hover:shadow-blue-500/5 flex flex-col justify-between gap-4"
                    >
                      {/* Top Row: Branch Name & Category Badge */}
                      <div>
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <h3 className="font-bold text-base text-slate-100 group-hover:text-blue-300 transition-colors leading-snug">
                            {branchName}
                          </h3>
                          
                          <span
                            className={`shrink-0 text-xs font-bold px-2.5 py-1 rounded-lg border ${
                              isAI
                                ? 'bg-purple-500/10 text-purple-300 border-purple-500/30'
                                : row.seat_type.startsWith('G')
                                ? 'bg-blue-500/10 text-blue-300 border-blue-500/30'
                                : row.seat_type.startsWith('L')
                                ? 'bg-pink-500/10 text-pink-300 border-pink-500/30'
                                : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                            }`}
                          >
                            {isAI ? 'AI (All India)' : row.seat_type}
                          </span>
                        </div>

                        {/* Branch Code & Metadata */}
                        <div className="flex items-center gap-2 flex-wrap text-xs text-slate-400 mt-1">
                          <button
                            onClick={() => copyToClipboard(row.branch_code)}
                            className="inline-flex items-center gap-1 font-mono text-[11px] bg-slate-950/70 hover:bg-slate-800 border border-slate-800 px-2 py-0.5 rounded-md text-slate-300 transition-colors cursor-pointer"
                            title="Click to copy choice code"
                          >
                            <span>Code: {row.branch_code}</span>
                            {copiedCode === row.branch_code ? (
                              <span className="text-emerald-400">✓</span>
                            ) : (
                              <svg className="w-3 h-3 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                              </svg>
                            )}
                          </button>

                          <span>Round {row.cap_round}</span>
                          <span>•</span>
                          <span>{row.year}</span>
                        </div>
                      </div>

                      {/* Bottom Row: Closing Percentile Highlight */}
                      <div className="pt-3 border-t border-slate-800/60 flex items-end justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                            <span>Closing Score</span>
                            <span className="font-mono text-slate-400">
                              {isAI ? 'JEE Main Percentile' : 'MHT-CET Percentile'}
                            </span>
                          </div>
                          {/* Visual score gauge */}
                          <div className="w-full bg-slate-950/80 rounded-full h-1.5 overflow-hidden border border-slate-800">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                isHighTier
                                  ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                                  : isMidTier
                                  ? 'bg-gradient-to-r from-blue-500 to-cyan-400'
                                  : 'bg-gradient-to-r from-amber-500 to-orange-400'
                              }`}
                              style={{ width: `${Math.min(Math.max(perc, 5), 100)}%` }}
                            />
                          </div>
                        </div>

                        <div className="shrink-0 text-right">
                          <div className={`font-mono text-lg sm:text-xl font-extrabold tracking-tight ${
                            isHighTier
                              ? 'text-emerald-400'
                              : isMidTier
                              ? 'text-cyan-300'
                              : 'text-blue-300'
                          }`}>
                            {perc.toFixed(4)}%
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-slate-900/40 border border-slate-800/80 rounded-3xl p-10 text-center space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-slate-800/80 text-slate-400 flex items-center justify-center mx-auto">
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-slate-200">
                  No cutoffs found for this filter
                </h3>
                <p className="text-slate-400 text-sm max-w-md mx-auto">
                  {selectedCategory !== 'All'
                    ? `No cutoffs match the selected reservation category "${selectedCategory}" for this college and round.`
                    : selectedQuota === 'AI'
                    ? `No All India (JEE) cutoffs recorded for this college in CAP Round ${selectedRound}. Try selecting State Seats (CET) or another CAP round.`
                    : `No State (CET) cutoffs found for this college in CAP Round ${selectedRound}. Try selecting another CAP round or quota mode.`}
                </p>
                <div className="flex justify-center gap-3 pt-2">
                  {selectedCategory !== 'All' && (
                    <button
                      onClick={() => setSelectedCategory('All')}
                      className="text-xs font-semibold px-4 py-2 rounded-xl bg-blue-600/20 text-blue-300 border border-blue-500/30 hover:bg-blue-600/30 transition-colors cursor-pointer"
                    >
                      Clear Category Filter
                    </button>
                  )}
                  {branchFilter && (
                    <button
                      onClick={() => setBranchFilter('')}
                      className="text-xs font-semibold px-4 py-2 rounded-xl bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700 transition-colors cursor-pointer"
                    >
                      Clear Branch Search
                    </button>
                  )}
                  <button
                    onClick={() => handleQuotaChange(selectedQuota === 'AI' ? 'MH' : 'AI')}
                    className="text-xs font-semibold px-4 py-2 rounded-xl bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700 transition-colors cursor-pointer"
                  >
                    Switch to {selectedQuota === 'AI' ? 'State Seats (CET)' : 'All India (JEE)'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Initial Empty State Guide (When no search has occurred yet) */}
        {!hasSearched && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
            <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-6 backdrop-blur-sm space-y-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center border border-blue-500/20">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M3 9h18" />
                  <path d="M9 21V9" />
                </svg>
              </div>
              <h3 className="font-bold text-slate-100">State Quota (MHT-CET)</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Filter cutoffs by Maharashtra state categories including GOPENS, GSCS, GSTS, TFWS, and ladies quotas across all colleges.
              </p>
            </div>

            <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-6 backdrop-blur-sm space-y-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center border border-purple-500/20">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="2" y1="12" x2="22" y2="12" />
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
              </div>
              <h3 className="font-bold text-slate-100">All India Quota (JEE Main)</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Switch to All India mode to view closing percentiles based on JEE Main scores for candidates across India.
              </p>
            </div>

            <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-6 backdrop-blur-sm space-y-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center border border-cyan-500/20">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
              </div>
              <h3 className="font-bold text-slate-100">All 4 CAP Rounds</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Track how cutoff trends evolved from CAP Round 1 all the way through Round 4 to plan your option form strategy.
              </p>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-800/80 py-6 px-4 text-center text-xs text-slate-500">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Freshie Guide • Maharashtra Engineering Cutoff Search Engine</span>
          <span>Data source: State Common Entrance Test Cell, Maharashtra</span>
        </div>
      </footer>
    </div>
  );
}