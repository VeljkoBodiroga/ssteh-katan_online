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

    // Ista lista "ivica" (moguci putevi) kao u public/js/game.js - svaka ivica je par
    // indeksa u TROMEDJE (dva susedna temena koja dele tacno 2 zajednicka polja).
    private const EDGES = [
        [0, 3], [0, 4], [1, 2], [1, 4], [2, 9], [3, 5], [4, 7], [5, 6], [5, 8], [6, 12],
        [7, 8], [7, 10], [8, 14], [9, 10], [9, 11], [10, 16], [11, 18], [12, 13], [13, 14], [13, 19],
        [14, 15], [15, 16], [15, 21], [16, 17], [17, 18], [17, 23], [19, 20], [20, 21], [21, 22], [22, 23],
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
                'hasRolledThisTurn' => false,
                'playerTromedje' => [],
                'roads' => [],
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

        $bs['playerTromedje'][] = ['id' => $currentUserId, 'fields' => array_values($fields), 'type' => 'settlement', 'tri_index' => $data['tri_index']];
        $bs['pickTurnIndex'] = $pickIdx + 1;

        if ($bs['pickTurnIndex'] >= $totalPicks) {
            $bs['phase'] = 'playing';
        }

        $game->update(['board_state' => $bs]);

        return response()->json($this->present($game->fresh()));
    }

    // POST /api/games/{game}/roll — SAMO igrac na potezu baca kockice, JEDNOM po potezu.
    // Vise NE predaje red automatski - za to sluzi posebna /end-turn ruta.
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
        abort_if($bs['hasRolledThisTurn'] ?? false, 422, 'Već si bacio kockicu ovog poteza.');

        try {
            $response = Http::timeout(5)->get('https://www.dejete.com/api/dice', [
                'numdice' => 2,
                'numsides' => 6,
            ]);
            $sum = $response->ok() ? array_sum($response->json('dice', [])) : (random_int(1, 6) + random_int(1, 6));
        } catch (\Throwable $e) {
            $sum = random_int(1, 6) + random_int(1, 6);
        }

        foreach (($bs['playerTromedje'] ?? []) as $t) {
            $gained = [];
            $amount = ($t['type'] ?? 'settlement') === 'city' ? 2 : 1; // grad daje duplo resursa
            foreach ($t['fields'] as $idx) {
                $num = $bs['numbers'][$idx] ?? null;
                $res = $bs['tiles'][$idx] ?? null;
                if ($num == $sum && $res && $res !== 'pustinja') {
                    $gained[$res] = ($gained[$res] ?? 0) + $amount;
                }
            }
            if ($gained) {
                $this->addResources($game, $t['id'], $gained);
            }
        }

        $log = $bs['log'] ?? [];
        array_unshift($log, "Bačeno je {$sum}");
        $bs['log'] = array_slice($log, 0, 4);
        $bs['hasRolledThisTurn'] = true;

        $game->update(['board_state' => $bs]);

        return response()->json($this->present($game->fresh()));
    }

    // POST /api/games/{game}/build-road — gradnja puta (1 drvo + 1 cigla)
    public function buildRoad(Request $request, Game $game)
    {
        $this->authorizeAccess($game);

        $data = $request->validate([
            'edge_index' => ['required', 'integer', 'min:0', 'max:' . (count(self::EDGES) - 1)],
        ]);

        $bs = $game->board_state ?? [];
        abort_unless(($bs['phase'] ?? null) === 'playing', 422, 'Partija nije u toku.');

        $turnOrder = $bs['turnOrder'] ?? [];
        $playIdx = $bs['playTurnIndex'] ?? 0;
        $currentUserId = $turnOrder[$playIdx % count($turnOrder)];
        abort_unless($currentUserId === $request->user()->id, 403, 'Nije tvoj red.');

        $edge = self::EDGES[$data['edge_index']];
        $roads = $bs['roads'] ?? [];

        abort_if(collect($roads)->contains(fn ($r) => $r['edge_index'] === $data['edge_index']), 422, 'Tu već postoji put.');

        // Provera resursa (1 drvo + 1 cigla).
        $pivot = DB::table('game_players')->where('game_id', $game->id)->where('user_id', $currentUserId)->first();
        $resources = $pivot && $pivot->resources ? json_decode($pivot->resources, true) : [];
        abort_if(($resources['drvo'] ?? 0) < 1 || ($resources['cigla'] ?? 0) < 1, 422, 'Nemaš dovoljno resursa (1 drvo + 1 cigla).');

        // Provera povezanosti: bar jedno teme ivice mora biti moje selo, ili kraj mog
        // vec postojeceg puta (a ta tacka ne sme biti tudje selo - "ne sece kucu drugog igraca").
                $mySettlementVertexIndices = collect($bs['playerTromedje'] ?? [])
            ->where('id', $currentUserId)
            ->pluck('tri_index');

        // Sva temena gde postoji BILO CIJE selo, da znamo gde se moj put "prekida".
        $enemySettlementVertexIndices = collect($bs['playerTromedje'] ?? [])
            ->where('id', '!=', $currentUserId)
            ->pluck('tri_index');

        // Temena na krajevima MOJIH postojecih puteva.
        $myRoadVertices = collect($roads)
            ->where('id', $currentUserId)
            ->flatMap(fn ($r) => self::EDGES[$r['edge_index']])
            ->unique();

        $connected = false;
        foreach ($edge as $vertex) {
            $isMySettlement = $mySettlementVertexIndices->contains($vertex);
            $isMyRoadEnd = $myRoadVertices->contains($vertex) && ! $enemySettlementVertexIndices->contains($vertex);
            if ($isMySettlement || $isMyRoadEnd) {
                $connected = true;
                break;
            }
        }
        abort_unless($connected, 422, 'Put mora biti nadovezan na tvoje selo ili tvoj postojeći put (i ne sme preseći tuđe selo).');

        $roads[] = ['id' => $currentUserId, 'edge_index' => $data['edge_index']];
        $bs['roads'] = $roads;
        $game->update(['board_state' => $bs]);

        $this->addResources($game, $currentUserId, ['drvo' => -1, 'cigla' => -1]);

        return response()->json($this->present($game->fresh()));
    }

    // POST /api/games/{game}/build-settlement — novo selo tokom igre (1 drvo+1 cigla+1 ovca+1 psenica)
    public function buildSettlement(Request $request, Game $game)
    {
        $this->authorizeAccess($game);

        $data = $request->validate([
            'tri_index' => ['required', 'integer', 'min:0', 'max:23'],
        ]);

        $bs = $game->board_state ?? [];
        abort_unless(($bs['phase'] ?? null) === 'playing', 422, 'Partija nije u toku.');

        $turnOrder = $bs['turnOrder'] ?? [];
        $playIdx = $bs['playTurnIndex'] ?? 0;
        $currentUserId = $turnOrder[$playIdx % count($turnOrder)];
        abort_unless($currentUserId === $request->user()->id, 403, 'Nije tvoj red.');

        $fields = self::TROMEDJE[$data['tri_index']];
        $playerTromedje = $bs['playerTromedje'] ?? [];

        // Pravilo razdaljine: ne sme deliti 2 zajednicka polja ni sa jednim postojecim
        // naseljem/gradom (bilo cijim) - to znaci "susedno teme".
        foreach ($playerTromedje as $t) {
            $common = array_intersect($fields, $t['fields']);
            abort_if(count($common) >= 2, 422, 'Selo je preblizu drugog naselja.');
        }

        // Mora biti povezano MOJIM putem (bar jedan moj put ima ovo teme kao kraj).
        $roads = $bs['roads'] ?? [];
        $myRoadVertices = collect($roads)
            ->where('id', $currentUserId)
            ->flatMap(fn ($r) => self::EDGES[$r['edge_index']])
            ->unique();
        abort_unless($myRoadVertices->contains($data['tri_index']), 422, 'Selo mora biti povezano tvojim putem.');

        // Resursi.
        $pivot = DB::table('game_players')->where('game_id', $game->id)->where('user_id', $currentUserId)->first();
        $resources = $pivot && $pivot->resources ? json_decode($pivot->resources, true) : [];
        foreach (['drvo', 'cigla', 'ovca', 'psenica'] as $need) {
            abort_if(($resources[$need] ?? 0) < 1, 422, 'Nemaš dovoljno resursa (1 drvo + 1 cigla + 1 ovca + 1 pšenica).');
        }

        $playerTromedje[] = ['id' => $currentUserId, 'fields' => array_values($fields), 'type' => 'settlement', 'tri_index' => $data['tri_index']];
        $bs['playerTromedje'] = $playerTromedje;
        $game->update(['board_state' => $bs]);

        $this->addResources($game, $currentUserId, ['drvo' => -1, 'cigla' => -1, 'ovca' => -1, 'psenica' => -1]);

        return response()->json($this->present($game->fresh()));
    }


    // POST /api/games/{game}/build-city — unapredjenje sela u grad (2 psenica + 3 kamen)
    public function buildCity(Request $request, Game $game)
    {
        $this->authorizeAccess($game);

        $data = $request->validate([
            'tri_index' => ['required', 'integer', 'min:0', 'max:23'],
        ]);

        $bs = $game->board_state ?? [];
        abort_unless(($bs['phase'] ?? null) === 'playing', 422, 'Partija nije u toku.');

        $turnOrder = $bs['turnOrder'] ?? [];
        $playIdx = $bs['playTurnIndex'] ?? 0;
        $currentUserId = $turnOrder[$playIdx % count($turnOrder)];
        abort_unless($currentUserId === $request->user()->id, 403, 'Nije tvoj red.');

        $fields = self::TROMEDJE[$data['tri_index']];
        $playerTromedje = $bs['playerTromedje'] ?? [];

        $foundIndex = null;
        foreach ($playerTromedje as $i => $t) {
            if (($t['tri_index'] ?? null) === $data['tri_index']) {
                $foundIndex = $i;
                break;
            }
        }
        abort_if(is_null($foundIndex), 422, 'Tu ne postoji tvoje selo.');
        abort_unless($playerTromedje[$foundIndex]['id'] === $currentUserId, 403, 'To nije tvoje selo.');
        abort_if(($playerTromedje[$foundIndex]['type'] ?? 'settlement') === 'city', 422, 'Tu je već izgrađen grad.');

        $pivot = DB::table('game_players')->where('game_id', $game->id)->where('user_id', $currentUserId)->first();
        $resources = $pivot && $pivot->resources ? json_decode($pivot->resources, true) : [];
        abort_if(($resources['psenica'] ?? 0) < 2 || ($resources['kamen'] ?? 0) < 3, 422, 'Nemaš dovoljno resursa (2 pšenice + 3 kamena).');

        $playerTromedje[$foundIndex]['type'] = 'city';
        $bs['playerTromedje'] = $playerTromedje;
        $game->update(['board_state' => $bs]);

        $this->addResources($game, $currentUserId, ['psenica' => -2, 'kamen' => -3]);

        return response()->json($this->present($game->fresh()));
    }



    // POST /api/games/{game}/end-turn — igrac na potezu zavrsava potez i predaje ga sledecem
    public function endTurn(Request $request, Game $game)
    {
        $this->authorizeAccess($game);

        $bs = $game->board_state ?? [];
        abort_unless(($bs['phase'] ?? null) === 'playing', 422, 'Partija nije u toku.');

        $turnOrder = $bs['turnOrder'] ?? [];
        $playIdx = $bs['playTurnIndex'] ?? 0;
        $currentUserId = $turnOrder[$playIdx % count($turnOrder)];
        abort_unless($currentUserId === $request->user()->id, 403, 'Nije tvoj red.');

        $bs['playTurnIndex'] = $playIdx + 1;
        $bs['hasRolledThisTurn'] = false;
        $game->update(['board_state' => $bs]);

        return response()->json($this->present($game->fresh()));
    }

    // POST /api/games/{game}/trade — razmena 4 istog resursa za 1 drugi (banka, 4:1)
    public function trade(Request $request, Game $game)
    {
        $this->authorizeAccess($game);

        $data = $request->validate([
            'give' => ['required', 'in:drvo,ovca,psenica,cigla,kamen'],
            'get' => ['required', 'in:drvo,ovca,psenica,cigla,kamen'],
        ]);

        abort_if($data['give'] === $data['get'], 422, 'Izaberi različite resurse.');

        $bs = $game->board_state ?? [];
        abort_unless(($bs['phase'] ?? null) === 'playing', 422, 'Partija nije u toku.');

        $turnOrder = $bs['turnOrder'] ?? [];
        $playIdx = $bs['playTurnIndex'] ?? 0;
        $currentUserId = $turnOrder[$playIdx % count($turnOrder)];
        abort_unless($currentUserId === $request->user()->id, 403, 'Nije tvoj red.');

        $pivot = DB::table('game_players')->where('game_id', $game->id)->where('user_id', $currentUserId)->first();
        $resources = $pivot && $pivot->resources ? json_decode($pivot->resources, true) : [];
        abort_if(($resources[$data['give']] ?? 0) < 4, 422, 'Nemaš dovoljno resursa za razmenu (potrebno 4).');

        $this->addResources($game, $currentUserId, [$data['give'] => -4, $data['get'] => 1]);

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

    // Dodaje (ili oduzima, ako je qty negativan) resurse igracu u game_players pivot tabeli.
    private function addResources(Game $game, int $userId, array $delta): void
    {
        $pivot = DB::table('game_players')->where('game_id', $game->id)->where('user_id', $userId)->first();
        $resources = $pivot && $pivot->resources ? json_decode($pivot->resources, true) : [];
        foreach ($delta as $res => $qty) {
            $resources[$res] = max(0, ($resources[$res] ?? 0) + $qty);
        }
        $game->players()->updateExistingPivot($userId, ['resources' => json_encode($resources)]);
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