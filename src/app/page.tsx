"use client";

import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import collegeDictionary from './colleges.json'; 
// 1. IMPORT THE NEW BRANCH DECODER
import branchDictionary from './branches.json'; 

// Database Connection
const supabaseUrl = "https://miqyijdbfwsdxwpdizcc.supabase.co"; // Keep your URL
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pcXlpamRiZndzZHh3cGRpemNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMzMzcyNzgsImV4cCI6MjA5ODkxMzI3OH0.n2uExa8DtZbBthwxd8cDtlLIEZISWetYlnqhZ71uOTE"; // Keep your Key
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface CutoffData {
  college_code: string;
  branch_code: string;
  seat_type: string;
  closing_percentile: number;
  year: number;
  cap_round: number;
}

export default function Home() {
  const [searchInput, setSearchInput] = useState('');
  const [suggestions, setSuggestions] = useState<{code: string, name: string}[]>([]);
  const [activeCollegeCode, setActiveCollegeCode] = useState('');
  
  const [results, setResults] = useState<CutoffData[]>([]);
  const [loading, setLoading] = useState(false);

  const handleType = (text: string) => {
    setSearchInput(text);
    
    if (text.length > 2) {
      const matches = Object.entries(collegeDictionary)
        .filter(([code, name]) => name.toLowerCase().includes(text.toLowerCase()))
        .map(([code, name]) => ({ code, name }));
      
      setSuggestions(matches.slice(0, 5));
    } else {
      setSuggestions([]);
    }
  };

  const handleSelect = (code: string, name: string) => {
    setSearchInput(name); 
    setActiveCollegeCode(code); 
    setSuggestions([]); 
  };

  const handleSearch = async () => {
    if (!activeCollegeCode) return;
    
    setLoading(true);
    
    const { data, error } = await supabase
      .from('raw_cutoffs')
      .select('*')
      .eq('college_code', activeCollegeCode)
      .order('closing_percentile', { ascending: false });

    if (error) {
      console.error("Error fetching data:", error);
    } else {
      setResults(data || []);
    }
    
    setLoading(false);
  };

  return (
    <main className="p-10 font-sans max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">Freshie Guide: Cutoff Search</h1>
      <p className="mb-8 text-gray-400">Search by College Name 🔍</p>
      
      <div className="flex gap-4 mb-8 relative">
        <div className="flex-grow relative">
          <input 
            type="text" 
            placeholder="Type a college name (e.g., V.J.T.I or Amravati)..." 
            value={searchInput}
            onChange={(e) => handleType(e.target.value)}
            className="border border-gray-600 bg-gray-800 text-white p-2 w-full rounded"
          />
          
          {suggestions.length > 0 && (
            <div className="absolute w-full bg-gray-800 border border-gray-600 mt-1 rounded shadow-xl z-10">
              {suggestions.map((s) => (
                <div 
                  key={s.code} 
                  onClick={() => handleSelect(s.code, s.name)}
                  className="p-3 border-b border-gray-700 hover:bg-gray-700 cursor-pointer text-sm text-gray-200"
                >
                  <span className="text-blue-400 font-mono text-xs mr-2">[{s.code}]</span> 
                  {s.name}
                </div>
              ))}
            </div>
          )}
        </div>

        <button 
          onClick={handleSearch}
          disabled={loading || !activeCollegeCode}
          className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 text-white px-6 py-2 rounded font-bold transition-colors"
        >
          {loading ? "Searching..." : "Search"}
        </button>
      </div>

      <div className="bg-gray-900 border border-gray-700 rounded p-6 h-[500px] overflow-auto">
        {results.length === 0 && !loading && (
          <p className="text-gray-500">Search for a college to see cutoffs...</p>
        )}
        
        {results.map((row, index) => {
          // 2. THE DECODER IN ACTION
          // We look up the raw code in our dictionary. If it fails for any reason, we fallback to showing the raw code.
          const branchName = (branchDictionary as Record<string, string>)[row.branch_code] || row.branch_code;

          return (
            <div key={index} className="border-b border-gray-800 py-3 flex justify-between">
              <div className="flex flex-col">
                <span className="font-bold text-blue-400">{branchName}</span>
                <div className="text-gray-400 text-sm mt-1">
                  <span className="mr-4">Code: {row.branch_code}</span>
                  <span>Category: <span className="text-gray-200 font-semibold">{row.seat_type}</span></span>
                </div>
              </div>
              <div className="text-green-400 font-mono font-bold flex items-center">
                {row.closing_percentile.toFixed(4)}%
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}