<?php

namespace App\Http\Controllers;

use App\Models\Game;
use Illuminate\Http\Request;

class GameController extends Controller
{
    public function play(Request $zahtev)
    {
        $game = null;
        $igraci = [];

        if ($zahtev->filled('game')) {
            $game = Game::with('players')->findOrFail($zahtev->integer('game'));

            abort_unless(
                $game->players->contains($zahtev->user()->id) || $zahtev->user()->isAdmin(),
                403,
                'Nisi deo ove partije.'
            );

            $igraci = $game->players->map(fn ($u) => [
                'id' => $u->id,
                'name' => $u->username,
            ])->values();
        }

        return view('game.play', [
            'game' => $game,
            'players' => $igraci,
        ]);
    }
}