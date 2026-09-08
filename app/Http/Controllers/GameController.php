<?php

namespace App\Http\Controllers;

use App\Models\Game;
use Illuminate\Http\Request;

class GameController extends Controller
{
    public function play(Request $request)
    {
        $game = null;
        $players = [];

        if ($request->filled('game')) {
            $game = Game::with('players')->findOrFail($request->integer('game'));

            abort_unless(
                $game->players->contains($request->user()->id) || $request->user()->isAdmin(),
                403,
                'Nisi deo ove partije.'
            );

            $players = $game->players->map(fn ($u) => [
                'id' => $u->id,
                'name' => $u->username,
            ])->values();
        }

        return view('game.play', [
            'game' => $game,
            'players' => $players,
        ]);
    }
}