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
    <div className="min-h-screen bg-black text-white flex flex-col font-sans selection:bg-zinc-800 selection:text-white">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-black border-b border-zinc-900 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 bg-white" />
              <span className="font-bold text-sm tracking-tight text-white">
                Freshie Guide
              </span>
              <span className="font-mono text-[10px] uppercase tracking-wider px-1.5 py-0.5 bg-zinc-900 text-zinc-400 border border-zinc-800">
                AY 2025-26
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-2 px-2 py-1 bg-zinc-950 border border-zinc-900 text-zinc-500 font-mono text-[10px]">
              <span className="w-1.5 h-1.5 bg-zinc-400 rounded-none" />
              <span>DB: ONLINE</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-8 z-10 flex flex-col gap-8">
        
        {/* Search & Filter Control Hub */}
        <div className="border border-zinc-900 bg-zinc-950/50 p-5">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-end">
            {/* Main Search Input */}
            <div className="md:col-span-4 relative" ref={searchContainerRef}>
              <label className="block text-[10px] font-mono uppercase tracking-wider text-zinc-500 mb-2">
                Institute Search
              </label>
              <div className="relative">
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
                  placeholder="Name or DTE Code..."
                  className="w-full bg-black border border-zinc-800 text-zinc-200 placeholder-zinc-600 text-sm px-3 py-2 outline-none focus:border-zinc-500 transition-none"
                />
                {searchInput && (
                  <button
                    onClick={() => {
                      setSearchInput('');
                      setActiveCollegeCode('');
                      setActiveCollegeName('');
                      setSuggestions([]);
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white bg-black px-1"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Auto-suggest Dropdown */}
              {suggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-black border border-zinc-800 z-50 max-h-60 overflow-y-auto">
                  {suggestions.map((s) => (
                    <button
                      key={s.code}
                      onClick={() => handleSelectCollege(s.code, s.name)}
                      className="w-full text-left px-3 py-2 hover:bg-zinc-900 flex items-center gap-3 border-b border-zinc-900 last:border-0"
                    >
                      <span className="font-mono text-[10px] text-zinc-500 shrink-0">
                        {s.code}
                      </span>
                      <span className="text-sm text-zinc-300 truncate">
                        {s.name}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Quota Selector */}
            <div className="md:col-span-3">
              <label className="block text-[10px] font-mono uppercase tracking-wider text-zinc-500 mb-2">
                Exam Quota
              </label>
              <div className="flex border border-zinc-800 bg-black">
                <button
                  type="button"
                  onClick={() => handleQuotaChange('MH')}
                  className={`flex-1 py-2 px-2 text-xs text-center font-mono transition-none ${
                    selectedQuota === 'MH'
                      ? 'bg-zinc-200 text-black font-semibold'
                      : 'text-zinc-500 hover:bg-zinc-900 hover:text-zinc-300'
                  }`}
                >
                  MH (CET)
                </button>
                <div className="w-[1px] bg-zinc-800" />
                <button
                  type="button"
                  onClick={() => handleQuotaChange('AI')}
                  className={`flex-1 py-2 px-2 text-xs text-center font-mono transition-none ${
                    selectedQuota === 'AI'
                      ? 'bg-zinc-200 text-black font-semibold'
                      : 'text-zinc-500 hover:bg-zinc-900 hover:text-zinc-300'
                  }`}
                >
                  AI (JEE)
                </button>
              </div>
            </div>

            {/* CAP Round Selector */}
            <div className="md:col-span-3">
              <label className="block text-[10px] font-mono uppercase tracking-wider text-zinc-500 mb-2">
                CAP Round
              </label>
              <select
                value={selectedRound}
                onChange={(e) => handleRoundChange(Number(e.target.value))}
                className="w-full bg-black border border-zinc-800 text-zinc-200 text-sm px-3 py-2 outline-none focus:border-zinc-500 cursor-pointer font-mono"
              >
                <option value={1}>Round 1</option>
                <option value={2}>Round 2</option>
                <option value={3}>Round 3</option>
                <option value={4}>Round 4</option>
              </select>
            </div>

            {/* Search Button */}
            <div className="md:col-span-2">
              <button
                onClick={handleSearchClick}
                disabled={loading || (!activeCollegeCode && !searchInput.trim())}
                className="w-full bg-white text-black disabled:bg-zinc-900 disabled:text-zinc-600 font-semibold text-sm py-2 px-4 border border-white disabled:border-zinc-900 hover:bg-zinc-200 transition-none"
              >
                {loading ? 'Fetching...' : 'Query Data'}
              </button>
            </div>
          </div>
          
          {/* Quick Picks */}
          <div className="flex items-center gap-2 flex-wrap mt-4">
            <span className="text-[10px] font-mono uppercase text-zinc-600 mr-2">Top Institutions:</span>
            {POPULAR_COLLEGES.map((col) => (
              <button
                key={col.code}
                onClick={() => handleSelectCollege(col.code, col.name)}
                className={`text-[10px] px-2 py-0.5 border font-mono transition-none ${
                  activeCollegeCode === col.code
                    ? "bg-zinc-800 border-zinc-700 text-white"
                    : "bg-black border-zinc-900 text-zinc-500 hover:text-zinc-300 hover:border-zinc-700 hover:bg-zinc-950"
                }`}
              >
                {col.code}
              </button>
            ))}
          </div>
        </div>

        {/* Results Area */}
        {hasSearched ? (
          <div className="flex flex-col gap-4">
            {/* Active College Banner & Stats */}
            {activeCollegeCode && (
              <div className="border border-zinc-900 bg-black p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] px-1.5 py-0.5 border border-zinc-800 bg-zinc-950 text-zinc-400">
                      ID: {activeCollegeCode}
                    </span>
                    <span className="font-mono text-[10px] px-1.5 py-0.5 border border-zinc-800 bg-zinc-950 text-zinc-400">
                      QUOTA: {selectedQuota === 'AI' ? 'ALL INDIA' : 'STATE'}
                    </span>
                    <span className="font-mono text-[10px] px-1.5 py-0.5 border border-zinc-800 bg-zinc-950 text-zinc-400">
                      R{selectedRound}
                    </span>
                  </div>
                  <h2 className="text-xl font-medium text-white truncate tracking-tight">
                    {activeCollegeName || (collegeDictionary as Record<string, string>)[activeCollegeCode] || `Unknown Code: ${activeCollegeCode}`}
                  </h2>
                </div>

                {/* Filters */}
                {results.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <input
                      type="text"
                      value={branchFilter}
                      onChange={(e) => setBranchFilter(e.target.value)}
                      placeholder="Filter branch..."
                      className="bg-black border border-zinc-800 text-xs text-zinc-200 px-3 py-1.5 outline-none focus:border-zinc-500 w-32 font-mono"
                    />
                    <select
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      className="bg-black border border-zinc-800 text-xs text-zinc-200 px-3 py-1.5 outline-none cursor-pointer font-mono"
                    >
                      <option value="All">All Categories</option>
                      {availableCategories.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as SortOption)}
                      className="bg-black border border-zinc-800 text-xs text-zinc-200 px-3 py-1.5 outline-none cursor-pointer font-mono"
                    >
                      <option value="percentile-desc">Sort: Highest %</option>
                      <option value="percentile-asc">Sort: Lowest %</option>
                      <option value="branch-asc">Sort: Branch A-Z</option>
                    </select>
                  </div>
                )}
              </div>
            )}

            {/* Results Table/Grid */}
            {loading ? (
              <div className="border border-zinc-900 bg-black p-12 text-center flex flex-col items-center justify-center gap-3 text-zinc-500">
                <span className="font-mono text-sm animate-pulse">Querying Database...</span>
              </div>
            ) : processedResults.length > 0 ? (
              <div className="flex flex-col border border-zinc-900 bg-black">
                {/* Table Header */}
                <div className="grid grid-cols-12 gap-4 border-b border-zinc-900 px-4 py-3 bg-zinc-950/50 text-[10px] font-mono tracking-widest text-zinc-500 uppercase">
                  <div className="col-span-2">Choice Code</div>
                  <div className="col-span-5">Branch Name</div>
                  <div className="col-span-2">Category</div>
                  <div className="col-span-3 text-right">Closing %ile</div>
                </div>
                {/* Table Rows */}
                <div className="divide-y divide-zinc-900">
                  {processedResults.map((row, index) => {
                    const branchName = (branchDictionary as Record<string, string>)[row.branch_code] || row.branch_code;
                    return (
                      <div
                        key={row.id || index}
                        className="grid grid-cols-12 gap-4 px-4 py-3 hover:bg-zinc-900/50 items-center text-sm transition-colors"
                      >
                        <div className="col-span-2 font-mono text-[11px] text-zinc-400 flex items-center gap-2">
                          <button
                            onClick={() => copyToClipboard(row.branch_code)}
                            className="hover:text-white border-b border-transparent hover:border-white transition-colors cursor-pointer"
                            title="Copy Code"
                          >
                            {row.branch_code}
                          </button>
                          {copiedCode === row.branch_code && <span className="text-[9px] text-zinc-600 uppercase">Copied</span>}
                        </div>
                        <div className="col-span-5 text-zinc-200 truncate pr-4 text-[13px]" title={branchName}>
                          {branchName}
                        </div>
                        <div className="col-span-2 font-mono text-[11px] text-zinc-400">
                          {row.seat_type === 'AI' ? 'AI (JEE)' : row.seat_type}
                        </div>
                        <div className="col-span-3 text-right font-mono text-sm text-white font-medium">
                          {row.closing_percentile.toFixed(4)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="border border-zinc-900 bg-black p-12 text-center flex flex-col items-center gap-4">
                <span className="text-sm font-mono text-zinc-500">No cutoff records found.</span>
                <div className="flex gap-2">
                  {selectedCategory !== 'All' && (
                    <button onClick={() => setSelectedCategory('All')} className="text-xs font-mono px-3 py-1.5 border border-zinc-800 hover:bg-zinc-900 text-zinc-300 cursor-pointer">
                      Clear Category Filter
                    </button>
                  )}
                  {branchFilter && (
                    <button onClick={() => setBranchFilter('')} className="text-xs font-mono px-3 py-1.5 border border-zinc-800 hover:bg-zinc-900 text-zinc-300 cursor-pointer">
                      Clear Branch Filter
                    </button>
                  )}
                  <button onClick={() => handleQuotaChange(selectedQuota === 'AI' ? 'MH' : 'AI')} className="text-xs font-mono px-3 py-1.5 border border-zinc-800 hover:bg-zinc-900 text-zinc-300 cursor-pointer">
                    Switch to {selectedQuota === 'AI' ? 'MH' : 'AI'}
                  </button>
                </div>
              </div>
            )}
            
            {processedResults.length > 0 && (
              <div className="flex items-center justify-between mt-2">
                <div className="text-[10px] font-mono text-zinc-600">
                  Total Entries: <span className="text-zinc-400">{processedResults.length}</span>
                </div>
                <div className="text-[10px] font-mono text-zinc-600">
                  Data sourced from State CET Cell, Maharashtra
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Empty State / Initial View */
          <div className="border border-zinc-900 bg-black p-8 sm:p-12 text-center flex flex-col items-center justify-center min-h-[40vh]">
            <div className="w-8 h-8 border border-zinc-800 flex items-center justify-center mb-4">
              <span className="w-2 h-2 bg-zinc-700" />
            </div>
            <h2 className="text-lg font-medium text-white mb-2">System Ready</h2>
            <p className="text-sm text-zinc-500 max-w-md mx-auto mb-6">
              Enter an institute name or DTE code to query historical cutoff data across State (MHT-CET) and All India (JEE) quotas.
            </p>
            <div className="flex gap-4 text-[10px] font-mono text-zinc-600 uppercase">
              <span>Records: 4 Rounds</span>
              <span>•</span>
              <span>Year: 2025-26</span>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}