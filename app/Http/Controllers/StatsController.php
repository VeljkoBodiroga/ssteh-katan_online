<?php

namespace App\Http\Controllers;

use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

class StatsController extends Controller
{
    public function index()
    {
        $korisnik = Auth::user();
        $stats = $korisnik->playerStat;

        // Poziv javnog veb servisa (isto sto i fetch(api.quotable.io) u React verziji).
        // Keširamo 60s da ne udaramo API pri svakom refresh-u (dodatna funkcionalnost: keširanje).
        $quote = Cache::remember('motivational_quote', 60, function () {
            try {
                $odgovor = Http::timeout(5)->get('https://api.quotable.io/random');
                if ($odgovor->ok()) {
                    $podaci = $odgovor->json();
                    return "\"{$podaci['content']}\" — {$podaci['author']}";
                }
            } catch (\Throwable $e) {
                // ignorisi, koristi fallback ispod
            }
            return 'You win some, you lose some.';
        });

        return view('stats', compact('stats', 'quote'));
    }
}
