# Freshie Guide

A blazing-fast, Next.js-powered search engine designed to help engineering students seamlessly search and filter Maharashtra Engineering College Admission Cutoffs (MHT-CET & JEE Main).

## Key Features

* **Smart Search:** Instantly find colleges by name or DTE institute code.
* **Multi-Round Support:** View and compare historical cutoffs across CAP Rounds 1 through 4.
* **Quota Filtering:** Seamlessly toggle between State Seats (MHT-CET) and All India Seats (JEE Main).
* **Dynamic Categories:** Client-side filtering for specific reservation categories (GOPENS, TFWS, LOPENS, OBC, etc.) without re-fetching data.
* **Premium UI:** A sleek, fully responsive dark-mode interface built with Tailwind CSS.

## Tech Stack

* **Frontend:** Next.js (App Router), React, TypeScript, Tailwind CSS
* **Backend:** Supabase (PostgreSQL)
* **Data Pipeline:** Python (PDFPlumber, Regex) for extracting, cleaning, and migrating complex PDF data into a relational database.

## Getting Started

First, clone the repository and install the dependencies:

```bash
npm install