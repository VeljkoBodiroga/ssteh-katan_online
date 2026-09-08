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
    // Ista "master" lista tromedja kao u public/js/game.js - MORA biti identicna,
    // jer server proverava (validira) izbore igraca po ovim indeksima.
    private const TROMEDJE = [
        [0, 1, 4], [1, 2, 5], [2, 5, 6],
        [0, 3, 4], [1, 4, 5],
        [3, 4, 8], [3, 7, 8], [4, 5, 9],
        [4, 8, 9], [5, 6, 10], [5, 9, 10],
        [6, 10, 11],
        [7, 8, 12], [8, 12, 13], [8, 9, 13],
        [9, 13, 14], [9, 10, 14],
        [10, 14, 15], [10, 11, 15],
        [12, 13, 16], [13, 16, 17], [13, 14, 17],
        [14, 17, 18], [14, 15, 18],
    ];

    // GET /api/games — sve partije trenutnog korisnika
    public function index(Request $request)
    {
        $games = $request->user()->games()->latest()->get();
        return response()->json($games);
    }

    // POST /api/games — kreiranje nove partije (koristi se SAMO u "hotseat" rezimu bez lobija)
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
                'started_at' => now(),
            ]);

            $game->players()->attach($request->user()->id, [
                'resources' => json_encode(['drvo' => 0, 'ovca' => 0, 'psenica' => 0, 'cigla' => 0, 'kamen' => 0]),
            ]);

            return $game;
        });

        return response()->json($this->present($game), 201);
    }

    // GET /api/games/{game} — detalji partije (koristi se za polling od strane SVIH igraca)
    public function show(Game $game)
    {
        $this->authorizeAccess($game);
        return response()->json($this->present($game));
    }

    // GET /api/games/{game}/players — ugnjezdena ruta: igraci u partiji
    public function players(Game $game)
    {
        $this->authorizeAccess($game);
        return response()->json($game->players);
    }

    // PUT /api/games/{game} — opste cuvanje (koristi ga npr. "Sacuvaj" dugme u hotseat rezimu)
    public function update(Request $request, Game $game)
    {
        $this->authorizeAccess($game);

        $data = $request->validate([
            'board_state' => ['sometimes', 'array'],
            'status' => ['sometimes', 'in:setup,in_progress,finished'],
        ]);

        $game->update($data);

        return response()->json($this->present($game));
    }

    // POST /api/games/{game}/setup-board — SAMO kreator postavlja tablu (polja+brojevi)
    // i time otvara fazu biranja terena za sve igrace.
    public function setupBoard(Request $request, Game $game)
    {
        $this->authorizeAccess($game);
        abort_unless($game->created_by === $request->user()->id, 403, 'Samo kreator partije postavlja tablu.');

        $data = $request->validate([
            'tiles' => ['required', 'array', 'size:19'],
            'numbers' => ['required', 'array', 'size:19'],
        ]);

        // Redosled poteza = redosled ulaska u lobi (redosled redova u game_players tabeli).
        $turnOrder = DB::table('game_players')
            ->where('game_id', $game->id)
            ->orderBy('id')
            ->pluck('user_id')
            ->values()
            ->all();

        $game->update([
            'status' => 'in_progress',
            'board_state' => [
                'tiles' => $data['tiles'],
                'numbers' => $data['numbers'],
                'turnOrder' => $turnOrder,
                'phase' => 'picking',
                'pickTurnIndex' => 0,
                'playTurnIndex' => 0,
                'playerTromedje' => [],
                'log' => [],
            ],
        ]);

        return response()->json($this->present($game->fresh()));
    }

    // POST /api/games/{game}/pick — igrac na potezu bira teren (tromedju)
    public function pick(Request $request, Game $game)
    {
        $this->authorizeAccess($game);

        $data = $request->validate([
            'tri_index' => ['required', 'integer', 'min:0', 'max:23'],
        ]);

        $bs = $game->board_state ?? [];
        abort_unless(($bs['phase'] ?? null) === 'picking', 422, 'Partija nije u fazi biranja terena.');

        $turnOrder = $bs['turnOrder'] ?? [];
        $pickIdx = $bs['pickTurnIndex'] ?? 0;
        $totalPicks = count($turnOrder) * 2;

        abort_if($pickIdx >= $totalPicks, 422, 'Biranje terena je već završeno.');

        $currentUserId = $turnOrder[$pickIdx % count($turnOrder)];
        abort_unless($currentUserId === $request->user()->id, 403, 'Nije tvoj red za biranje terena.');

        $fields = self::TROMEDJE[$data['tri_index']];

        foreach (($bs['playerTromedje'] ?? []) as $t) {
            $common = array_intersect($fields, $t['fields']);
            abort_if(count($common) >= 2, 422, 'Taj teren je zauzet ili je sused već zauzetom terenu.');
        }

        $bs['playerTromedje'][] = ['id' => $currentUserId, 'fields' => array_values($fields)];
        $bs['pickTurnIndex'] = $pickIdx + 1;

        if ($bs['pickTurnIndex'] >= $totalPicks) {
            $bs['phase'] = 'playing';
        }

        $game->update(['board_state' => $bs]);

        return response()->json($this->present($game->fresh()));
    }

    // POST /api/games/{game}/roll — SAMO igrac na potezu baca kockice (preko javnog REST servisa),
    // server deli resurse svim igracima i predaje red sledecem.
    public function roll(Request $request, Game $game)
    {
        $this->authorizeAccess($game);

        $bs = $game->board_state ?? [];
        abort_unless(($bs['phase'] ?? null) === 'playing', 422, 'Partija nije u fazi bacanja kocke.');

        $turnOrder = $bs['turnOrder'] ?? [];
        abort_if(empty($turnOrder), 422, 'Partija nema definisan redosled poteza.');

        $playIdx = $bs['playTurnIndex'] ?? 0;
        $currentUserId = $turnOrder[$playIdx % count($turnOrder)];
        abort_unless($currentUserId === $request->user()->id, 403, 'Nije tvoj red za bacanje kocke.');

        try {
            $response = Http::timeout(5)->get('https://www.dejete.com/api/dice', [
                'numdice' => 2,
                'numsides' => 6,
            ]);
            $sum = $response->ok() ? array_sum($response->json('dice', [])) : (random_int(1, 6) + random_int(1, 6));
        } catch (\Throwable $e) {
            $sum = random_int(1, 6) + random_int(1, 6);
        }

        // Podela resursa svim igracima cija tromedja dodiruje polje sa brojem $sum.
        foreach (($bs['playerTromedje'] ?? []) as $t) {
            $gained = [];
            foreach ($t['fields'] as $idx) {
                $num = $bs['numbers'][$idx] ?? null;
                $res = $bs['tiles'][$idx] ?? null;
                if ($num == $sum && $res && $res !== 'pustinja') {
                    $gained[$res] = ($gained[$res] ?? 0) + 1;
                }
            }
            if ($gained) {
                $pivot = DB::table('game_players')
                    ->where('game_id', $game->id)
                    ->where('user_id', $t['id'])
                    ->first();
                $resources = $pivot && $pivot->resources ? json_decode($pivot->resources, true) : [];
                foreach ($gained as $res => $qty) {
                    $resources[$res] = ($resources[$res] ?? 0) + $qty;
                }
                $game->players()->updateExistingPivot($t['id'], ['resources' => json_encode($resources)]);
            }
        }

        $log = $bs['log'] ?? [];
        array_unshift($log, "Bačeno je {$sum}");
        $bs['log'] = array_slice($log, 0, 4);
        $bs['playTurnIndex'] = $playIdx + 1;

        $game->update(['board_state' => $bs]);

        return response()->json($this->present($game->fresh()));
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

    // Standardizovan JSON odgovor: partija + igraci sa dekodiranim resursima.
    private function present(Game $game): array
    {
        $game->load('players');

        return [
            'id' => $game->id,
            'status' => $game->status,
            'created_by' => $game->created_by,
            'board_state' => $game->board_state,
            'players' => $game->players->map(fn ($u) => [
                'id' => $u->id,
                'username' => $u->username,
                'resources' => $u->pivot->resources ? json_decode($u->pivot->resources, true) : [],
            ]),
        ];
    }
}