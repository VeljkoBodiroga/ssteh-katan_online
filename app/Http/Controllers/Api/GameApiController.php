<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Game;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;

class GameApiController extends Controller
{
    // GET /api/games — sve partije trenutnog korisnika
    public function index(Request $request)
    {
        $games = $request->user()->games()->latest()->get();
        return response()->json($games);
    }

    // POST /api/games — kreiranje nove partije
    public function store(Request $request)
    {
        $data = $request->validate([
            'board_state' => ['required', 'array'],
        ]);

        $game = DB::transaction(function () use ($data, $request) {
            $game = Game::create([
                'created_by' => $request->user()->id,
                'status' => 'in_progress',
                'board_state' => $data['board_state'],
                'log' => [],
                'started_at' => now(),
            ]);

            $game->players()->attach($request->user()->id, [
                'resources' => json_encode(['drvo' => 0, 'ovca' => 0, 'psenica' => 0, 'cigla' => 0, 'kamen' => 0]),
            ]);

            return $game;
        });

        return response()->json($game, 201);
    }

    // GET /api/games/{game} — detalji partije
    public function show(Game $game)
    {
        $this->authorizeAccess($game);
        return response()->json($game->load('players'));
    }

    // GET /api/games/{game}/players — ugnjezdena ruta: igraci u partiji
    public function players(Game $game)
    {
        $this->authorizeAccess($game);
        return response()->json($game->players);
    }

    // PUT /api/games/{game} — cuvanje stanja table (isto sto i saveGame() u React)
    public function update(Request $request, Game $game)
    {
        $this->authorizeAccess($game);

        $data = $request->validate([
            'board_state' => ['sometimes', 'array'],
            'status' => ['sometimes', 'in:setup,in_progress,finished'],
        ]);

        $game->update($data);

        return response()->json($game);
    }

    // POST /api/games/{game}/roll — baca kockice preko javnog REST servisa (dejete.com dice API)
    // isto sto i rollTwoDiceAPI() u React verziji, samo sad na backend-u
    public function roll(Game $game)
    {
        $this->authorizeAccess($game);

        try {
            $response = Http::timeout(5)->get('https://www.dejete.com/api/dice', [
                'numdice' => 2,
                'numsides' => 6,
            ]);
            $sum = $response->ok() ? array_sum($response->json('dice', [])) : (random_int(1, 6) + random_int(1, 6));
        } catch (\Throwable $e) {
            $sum = random_int(1, 6) + random_int(1, 6);
        }

        $log = $game->log ?? [];
        array_unshift($log, "Dobijen je broj {$sum}");
        $game->update(['log' => array_slice($log, 0, 4)]);

        return response()->json(['roll' => $sum, 'log' => $game->log]);
    }

    // DELETE /api/games/{game} — brise partiju (vlasnik ili admin)
    public function destroy(Request $request, Game $game)
    {
        if ($game->created_by !== $request->user()->id && ! $request->user()->isAdmin()) {
            abort(403);
        }
        $game->delete();
        return response()->json(null, 204);
    }

    private function authorizeAccess(Game $game): void
    {
        $user = Auth::user();
        if (! $user || (! $user->isAdmin() && ! $game->players->contains($user->id) && $game->created_by !== $user->id)) {
            abort(403, 'Nemate pristup ovoj partiji.');
        }
    }
}
