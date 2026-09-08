<?php

namespace App\Http\Controllers;

use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

class StatsController extends Controller
{
    public function index()
    {
        $user = Auth::user();
        $stats = $user->playerStat;

        // Poziv javnog veb servisa (isto sto i fetch(api.quotable.io) u React verziji).
        // Keširamo 60s da ne udaramo API pri svakom refresh-u (dodatna funkcionalnost: keširanje).
        $quote = Cache::remember('motivational_quote', 60, function () {
            try {
                $response = Http::timeout(5)->get('https://api.quotable.io/random');
                if ($response->ok()) {
                    $data = $response->json();
                    return "\"{$data['content']}\" — {$data['author']}";
                }
            } catch (\Throwable $e) {
                // ignorisi, koristi fallback ispod
            }
            return 'You win some, you lose some.';
        });

        return view('stats', compact('stats', 'quote'));
    }
}
