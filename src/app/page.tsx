"use client";

import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

// 1. DIRECT CONNECTION: Bypasses all folder imports and .env errors
const supabaseUrl = "https://miqyijdbfwsdxwpdizcc.supabase.co"; 
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pcXlpamRiZndzZHh3cGRpemNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMzMzcyNzgsImV4cCI6MjA5ODkxMzI3OH0.n2uExa8DtZbBthwxd8cDtlLIEZISWetYlnqhZ71uOTE"; 

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 2. DATA SHAPE
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
  const [results, setResults] = useState<CutoffData[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!searchInput) return;
    
    setLoading(true);
    
    const { data, error } = await supabase
      .from('raw_cutoffs')
      .select('*')
      .eq('college_code', searchInput)
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
      <p className="mb-8 text-gray-400">Functional Prototype</p>
      
      <div className="flex gap-4 mb-8">
        <input 
          type="text" 
          placeholder="Enter a 4 or 5-digit College Code (e.g., 01005)" 
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="border border-gray-600 bg-gray-800 text-white p-2 flex-grow rounded"
        />
        <button 
          onClick={handleSearch}
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded font-bold"
        >
          {loading ? "Searching..." : "Search"}
        </button>
      </div>

      <div className="bg-gray-900 border border-gray-700 rounded p-6 h-[500px] overflow-auto">
        {results.length === 0 && !loading && (
          <p className="text-gray-500">No results yet. Try searching for a college code!</p>
        )}
        
        {results.map((row, index) => (
          <div key={index} className="border-b border-gray-800 py-3 flex justify-between">
            <div>
              <span className="font-bold text-blue-400 mr-4">Branch: {row.branch_code}</span>
              <span className="text-gray-300">Category: {row.seat_type}</span>
            </div>
            <div className="text-green-400 font-mono font-bold">
              {row.closing_percentile.toFixed(4)}%
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}