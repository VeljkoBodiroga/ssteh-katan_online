<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Game;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use App\Models\PlayerStat;

class GameApiController extends Controller
{
    
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

    
    private const EDGES = [
        [0, 3], [0, 4], [1, 2], [1, 4], [2, 9], [3, 5], [4, 7], [5, 6], [5, 8], [6, 12],
        [7, 8], [7, 10], [8, 14], [9, 10], [9, 11], [10, 16], [11, 18], [12, 13], [13, 14], [13, 19],
        [14, 15], [15, 16], [15, 21], [16, 17], [17, 18], [17, 23], [19, 20], [20, 21], [21, 22], [22, 23],
    ];

    
    public function index(Request $zahtev)
    {
        $games = $zahtev->user()->games()->latest()->get();
        return response()->json($games);
    }

    public function store(Request $zahtev)
    {
        $podaci = $zahtev->validate([
            'board_state' => ['required', 'array'],
        ]);

        $game = DB::transaction(function () use ($podaci, $zahtev) {
            $game = Game::create([
                'created_by' => $zahtev->user()->id,
                'status' => 'in_progress',
                'board_state' => $podaci['board_state'],
                'started_at' => now(),
            ]);

            $game->players()->attach($zahtev->user()->id, [
                'resources' => json_encode(['drvo' => 0, 'ovca' => 0, 'psenica' => 0, 'cigla' => 0, 'kamen' => 0]),
            ]);

            return $game;
        });

        return response()->json($this->pripremiOdgovor($game), 201);
    }

    public function show(Game $game)
    {
        $this->proveriPristup($game);
        return response()->json($this->pripremiOdgovor($game));
    }

    // GET /api/games/{game}/players — ugnjezdena ruta: igraci u partiji
    public function players(Game $game)
    {
        $this->proveriPristup($game);
        return response()->json($game->players);
    }

    // PUT /api/games/{game} — opste cuvanje
    public function update(Request $zahtev, Game $game)
    {
        $this->proveriPristup($game);

        $podaci = $zahtev->validate([
            'board_state' => ['sometimes', 'array'],
            'status' => ['sometimes', 'in:setup,in_progress,finished'],
        ]);

        $game->update($podaci);

        return response()->json($this->pripremiOdgovor($game));
    }

    // POST /api/games/{game}/setup-board 
    public function setupBoard(Request $zahtev, Game $game)
    {
        $this->proveriPristup($game);
        abort_unless($game->created_by === $zahtev->user()->id, 403, 'Samo kreator partije postavlja tablu.');

        $podaci = $zahtev->validate([
            'tiles' => ['required', 'array', 'size:19'],
            'numbers' => ['required', 'array', 'size:19'],
        ]);

        $redosledPoteza = DB::table('game_players')
            ->where('game_id', $game->id)
            ->orderBy('id')
            ->pluck('user_id')
            ->values()
            ->all();

        $game->update([
            'status' => 'in_progress',
            'board_state' => [
                'tiles' => $podaci['tiles'],
                'numbers' => $podaci['numbers'],
                'turnOrder' => $redosledPoteza,
                'phase' => 'picking',
                'pickTurnIndex' => 0,
                'pickSubPhase' => 'settlement',
                'pendingRoadVertex' => null,
                'playTurnIndex' => 0,
                'hasRolledThisTurn' => false,
                'playerTromedje' => [],
                'roads' => [],
                'log' => [],
            ],
        ]);

        return response()->json($this->pripremiOdgovor($game->fresh()));
    }

    // POST igrac na potezu bira selo (tromedju)
    public function pick(Request $zahtev, Game $game)
    {
        $this->proveriPristup($game);

        $podaci = $zahtev->validate([
            'tri_index' => ['required', 'integer', 'min:0', 'max:23'],
        ]);

        $stanjeTable = $game->board_state ?? [];
        abort_unless(($stanjeTable['phase'] ?? null) === 'picking', 422, 'Partija nije u fazi biranja terena.');

        $redosledPoteza = $stanjeTable['turnOrder'] ?? [];
        $indeksBiranja = $stanjeTable['pickTurnIndex'] ?? 0;
        $ukupnoIzbora = count($redosledPoteza) * 2;

        abort_if($indeksBiranja >= $ukupnoIzbora, 422, 'Biranje terena je već završeno.');

        $idTrenutnogIgraca = $redosledPoteza[$indeksBiranja % count($redosledPoteza)];
        abort_unless($idTrenutnogIgraca === $zahtev->user()->id, 403, 'Nije tvoj red za biranje terena.');

        $polja = self::TROMEDJE[$podaci['tri_index']];

foreach (($stanjeTable['playerTromedje'] ?? []) as $t) {
            $zajednicka = array_intersect($polja, $t['fields']);
            abort_if(count($zajednicka) >= 2, 422, 'Taj teren je zauzet ili je sused već zauzetom terenu.');
        }
        
        $brojPre = collect($stanjeTable['playerTromedje'] ?? [])->where('id', $idTrenutnogIgraca)->count();

        $stanjeTable['playerTromedje'][] = ['id' => $idTrenutnogIgraca, 'fields' => array_values($polja), 'type' => 'settlement', 'tri_index' => $podaci['tri_index']];

        
        
        $stanjeTable['pickSubPhase'] = 'road';
        $stanjeTable['pendingRoadVertex'] = $podaci['tri_index'];

        $game->update(['board_state' => $stanjeTable]);

        if ($brojPre >= 1) {
            $pocetniResursi = [];
            foreach ($polja as $idx) {
                $res = $stanjeTable['tiles'][$idx] ?? null;
                if ($res && $res !== 'pustinja') {
                    $pocetniResursi[$res] = ($pocetniResursi[$res] ?? 0) + 1;
                }
            }
            if ($pocetniResursi) {
                $this->dodajResurse($game, $idTrenutnogIgraca, $pocetniResursi);
            }
        }

        return response()->json($this->pripremiOdgovor($game->fresh()));
    }

    // POST besplatan put domah pored sela
    public function pickRoad(Request $zahtev, Game $game)
    {
        $this->proveriPristup($game);

        $podaci = $zahtev->validate([
            'edge_index' => ['required', 'integer', 'min:0', 'max:' . (count(self::EDGES) - 1)],
        ]);

        $stanjeTable = $game->board_state ?? [];
        abort_unless(($stanjeTable['phase'] ?? null) === 'picking', 422, 'Partija nije u fazi biranja.');
        abort_unless(($stanjeTable['pickSubPhase'] ?? null) === 'road', 422, 'Prvo moraš da izabereš selo.');

        $redosledPoteza = $stanjeTable['turnOrder'] ?? [];
        $indeksBiranja = $stanjeTable['pickTurnIndex'] ?? 0;
        $idTrenutnogIgraca = $redosledPoteza[$indeksBiranja % count($redosledPoteza)];
        abort_unless($idTrenutnogIgraca === $zahtev->user()->id, 403, 'Nije tvoj red.');

        $ivica = self::EDGES[$podaci['edge_index']];
        $ocekivanoTeme = $stanjeTable['pendingRoadVertex'] ?? null;
        abort_unless(in_array($ocekivanoTeme, $ivica, true), 422, 'Put mora biti tačno pored sela koje si upravo izabrao.');

        $putevi = $stanjeTable['roads'] ?? [];
        abort_if(collect($putevi)->contains(fn ($r) => $r['edge_index'] === $podaci['edge_index']), 422, 'Tu već postoji put.');

        $putevi[] = ['id' => $idTrenutnogIgraca, 'edge_index' => $podaci['edge_index']];
        $stanjeTable['roads'] = $putevi;

        $ukupnoIzbora = count($redosledPoteza) * 2;
        $stanjeTable['pickTurnIndex'] = $indeksBiranja + 1;
        $stanjeTable['pickSubPhase'] = 'settlement';
        $stanjeTable['pendingRoadVertex'] = null;

        if ($stanjeTable['pickTurnIndex'] >= $ukupnoIzbora) {
            $stanjeTable['phase'] = 'playing';
            $stanjeTable['playTurnIndex'] = 0;
            $stanjeTable['hasRolledThisTurn'] = false;
        }

        $game->update(['board_state' => $stanjeTable]);

        return response()->json($this->pripremiOdgovor($game->fresh()));
    }

    // POST bacanje kockica
    public function roll(Request $zahtev, Game $game)
    {
        $this->proveriPristup($game);

        $stanjeTable = $game->board_state ?? [];
        abort_unless(($stanjeTable['phase'] ?? null) === 'playing', 422, 'Partija nije u fazi bacanja kocke.');

        $redosledPoteza = $stanjeTable['turnOrder'] ?? [];
        abort_if(empty($redosledPoteza), 422, 'Partija nema definisan redosled poteza.');

        $playIdx = $stanjeTable['playTurnIndex'] ?? 0;
        $idTrenutnogIgraca = $redosledPoteza[$playIdx % count($redosledPoteza)];
        abort_unless($idTrenutnogIgraca === $zahtev->user()->id, 403, 'Nije tvoj red za bacanje kocke.');
        abort_if($stanjeTable['hasRolledThisTurn'] ?? false, 422, 'Već si bacio kockicu ovog poteza.');

        try {
            $odgovor = Http::timeout(5)->get('https://www.dejete.com/api/dice', [
                'numdice' => 2,
                'numsides' => 6,
            ]);
            $zbir = $odgovor->ok() ? array_sum($odgovor->json('dice', [])) : (random_int(1, 6) + random_int(1, 6));
        } catch (\Throwable $e) {
            $zbir = random_int(1, 6) + random_int(1, 6);
        }

                if ($zbir == 7) {
            
            $moraOdbaciti = [];
            $sviPivoti = DB::table('game_players')->where('game_id', $game->id)->get();
            foreach ($sviPivoti as $pivotPodaci) {
                $resursi = $pivotPodaci->resources ? json_decode($pivotPodaci->resources, true) : [];
                $ukupno = array_sum($resursi);
                if ($ukupno > 7) {
                    $moraOdbaciti[$pivotPodaci->user_id] = intdiv($ukupno, 2);
                }
            }
            $stanjeTable['mustDiscard'] = $moraOdbaciti;
        } else {
            foreach (($stanjeTable['playerTromedje'] ?? []) as $t) {
                $dobijeno = [];
                $iznos = ($t['type'] ?? 'settlement') === 'city' ? 2 : 1; 
                foreach ($t['fields'] as $idx) {
                    $brojPolja = $stanjeTable['numbers'][$idx] ?? null;
                    $res = $stanjeTable['tiles'][$idx] ?? null;
                    if ($brojPolja == $zbir && $res && $res !== 'pustinja') {
                        $dobijeno[$res] = ($dobijeno[$res] ?? 0) + $iznos;
                    }
                }
                if ($dobijeno) {
                    $this->dodajResurse($game, $t['id'], $dobijeno);
                }
            }
        }

        $istorija = $stanjeTable['log'] ?? [];
        array_unshift($istorija, "Bačeno je {$zbir}");
        $stanjeTable['log'] = array_slice($istorija, 0, 4);
        $stanjeTable['hasRolledThisTurn'] = true;

        $game->update(['board_state' => $stanjeTable]);

        return response()->json($this->pripremiOdgovor($game->fresh()));
    }

    // POST odbacivanje karti posle bacene 7
    public function discard(Request $zahtev, Game $game)
    {
        $this->proveriPristup($game);

        $podaci = $zahtev->validate([
            'resources' => ['required', 'array'],
            'resources.drvo' => ['integer', 'min:0'],
            'resources.ovca' => ['integer', 'min:0'],
            'resources.psenica' => ['integer', 'min:0'],
            'resources.cigla' => ['integer', 'min:0'],
            'resources.kamen' => ['integer', 'min:0'],
        ]);

        $stanjeTable = $game->board_state ?? [];
        $moraOdbaciti = $stanjeTable['mustDiscard'] ?? [];
        $idKorisnika = $zahtev->user()->id;

        abort_unless(array_key_exists($idKorisnika, $moraOdbaciti), 422, 'Ne duguješ odbacivanje karata.');

        $potrebnoZaOdbacivanje = $moraOdbaciti[$idKorisnika];
        $ukupnoDato = array_sum($podaci['resources']);
        abort_unless($ukupnoDato === $potrebnoZaOdbacivanje, 422, "Moraš odbaciti tačno {$potrebnoZaOdbacivanje} karata.");

        $pivotPodaci = DB::table('game_players')->where('game_id', $game->id)->where('user_id', $idKorisnika)->first();
        $resursi = $pivotPodaci && $pivotPodaci->resources ? json_decode($pivotPodaci->resources, true) : [];
        foreach ($podaci['resources'] as $res => $kolicina) {
            abort_if(($resursi[$res] ?? 0) < $kolicina, 422, 'Nemaš toliko tog resursa.');
        }

        $razlika = [];
        foreach ($podaci['resources'] as $res => $kolicina) {
            $razlika[$res] = -$kolicina;
        }
        $this->dodajResurse($game, $idKorisnika, $razlika);

        unset($moraOdbaciti[$idKorisnika]);
        $stanjeTable['mustDiscard'] = $moraOdbaciti;
        $game->update(['board_state' => $stanjeTable]);

        return response()->json($this->pripremiOdgovor($game->fresh()));
    }

    // POST gradnja puta
    public function buildRoad(Request $zahtev, Game $game)
    {
        $this->proveriPristup($game);

        $podaci = $zahtev->validate([
            'edge_index' => ['required', 'integer', 'min:0', 'max:' . (count(self::EDGES) - 1)],
        ]);

        $stanjeTable = $game->board_state ?? [];
        abort_unless(($stanjeTable['phase'] ?? null) === 'playing', 422, 'Partija nije u toku.');

        $redosledPoteza = $stanjeTable['turnOrder'] ?? [];
        $playIdx = $stanjeTable['playTurnIndex'] ?? 0;
        $idTrenutnogIgraca = $redosledPoteza[$playIdx % count($redosledPoteza)];
        abort_unless($idTrenutnogIgraca === $zahtev->user()->id, 403, 'Nije tvoj red.');

        $ivica = self::EDGES[$podaci['edge_index']];
        $putevi = $stanjeTable['roads'] ?? [];

        abort_if(collect($putevi)->contains(fn ($r) => $r['edge_index'] === $podaci['edge_index']), 422, 'Tu već postoji put.');

        
        $pivotPodaci = DB::table('game_players')->where('game_id', $game->id)->where('user_id', $idTrenutnogIgraca)->first();
        $resursi = $pivotPodaci && $pivotPodaci->resources ? json_decode($pivotPodaci->resources, true) : [];
        abort_if(($resursi['drvo'] ?? 0) < 1 || ($resursi['cigla'] ?? 0) < 1, 422, 'Nemaš dovoljno resursa (1 drvo + 1 cigla).');

                $indeksiMojihSela = collect($stanjeTable['playerTromedje'] ?? [])
            ->where('id', $idTrenutnogIgraca)
            ->pluck('tri_index');

       
        $indeksiTudjihSela = collect($stanjeTable['playerTromedje'] ?? [])
            ->where('id', '!=', $idTrenutnogIgraca)
            ->pluck('tri_index');

        
        $temenaMojihPuteva = collect($putevi)
            ->where('id', $idTrenutnogIgraca)
            ->flatMap(fn ($r) => self::EDGES[$r['edge_index']])
            ->unique();

        $povezano = false;
        foreach ($ivica as $teme) {
            $jeMojeSelo = $indeksiMojihSela->contains($teme);
            $jeKrajMogPuta = $temenaMojihPuteva->contains($teme) && ! $indeksiTudjihSela->contains($teme);
            if ($jeMojeSelo || $jeKrajMogPuta) {
                $povezano = true;
                break;
            }
        }
        abort_unless($povezano, 422, 'Put mora biti nadovezan na tvoje selo ili tvoj postojeći put (i ne sme preseći tuđe selo).');

        $putevi[] = ['id' => $idTrenutnogIgraca, 'edge_index' => $podaci['edge_index']];
        $stanjeTable['roads'] = $putevi;
        $game->update(['board_state' => $stanjeTable]);

        $this->dodajResurse($game, $idTrenutnogIgraca, ['drvo' => -1, 'cigla' => -1]);

        return response()->json($this->pripremiOdgovor($game->fresh()));
    }

    // POST novo selo tokom igre 
    public function buildSettlement(Request $zahtev, Game $game)
    {
        $this->proveriPristup($game);

        $podaci = $zahtev->validate([
            'tri_index' => ['required', 'integer', 'min:0', 'max:23'],
        ]);

        $stanjeTable = $game->board_state ?? [];
        abort_unless(($stanjeTable['phase'] ?? null) === 'playing', 422, 'Partija nije u toku.');

        $redosledPoteza = $stanjeTable['turnOrder'] ?? [];
        $playIdx = $stanjeTable['playTurnIndex'] ?? 0;
        $idTrenutnogIgraca = $redosledPoteza[$playIdx % count($redosledPoteza)];
        abort_unless($idTrenutnogIgraca === $zahtev->user()->id, 403, 'Nije tvoj red.');

        $polja = self::TROMEDJE[$podaci['tri_index']];
        $tromedjeIgraca = $stanjeTable['playerTromedje'] ?? [];

        
        foreach ($tromedjeIgraca as $t) {
            $zajednicka = array_intersect($polja, $t['fields']);
            abort_if(count($zajednicka) >= 2, 422, 'Selo je preblizu drugog naselja.');
        }

        
        $putevi = $stanjeTable['roads'] ?? [];
        $temenaMojihPuteva = collect($putevi)
            ->where('id', $idTrenutnogIgraca)
            ->flatMap(fn ($r) => self::EDGES[$r['edge_index']])
            ->unique();
        abort_unless($temenaMojihPuteva->contains($podaci['tri_index']), 422, 'Selo mora biti povezano tvojim putem.');

        // Resursi
        $pivotPodaci = DB::table('game_players')->where('game_id', $game->id)->where('user_id', $idTrenutnogIgraca)->first();
        $resursi = $pivotPodaci && $pivotPodaci->resources ? json_decode($pivotPodaci->resources, true) : [];
        foreach (['drvo', 'cigla', 'ovca', 'psenica'] as $potrebnoResurs) {
            abort_if(($resursi[$potrebnoResurs] ?? 0) < 1, 422, 'Nemaš dovoljno resursa (1 drvo + 1 cigla + 1 ovca + 1 pšenica).');
        }

        $tromedjeIgraca[] = ['id' => $idTrenutnogIgraca, 'fields' => array_values($polja), 'type' => 'settlement', 'tri_index' => $podaci['tri_index']];
        $stanjeTable['playerTromedje'] = $tromedjeIgraca;

        $result = $this->proveriKrajIgre($game, $stanjeTable);
        $stanjeTable = $result['bs'];
        $update = ['board_state' => $stanjeTable];
        if ($result['finished']) {
            $update['status'] = 'finished';
        }
        $game->update($update);

        $this->dodajResurse($game, $idTrenutnogIgraca, ['drvo' => -1, 'cigla' => -1, 'ovca' => -1, 'psenica' => -1]);

        return response()->json($this->pripremiOdgovor($game->fresh()));
    }

    // POST unapredjenje sela u grad 
    public function buildCity(Request $zahtev, Game $game)
    {
        $this->proveriPristup($game);

        $podaci = $zahtev->validate([
            'tri_index' => ['required', 'integer', 'min:0', 'max:23'],
        ]);

        $stanjeTable = $game->board_state ?? [];
        abort_unless(($stanjeTable['phase'] ?? null) === 'playing', 422, 'Partija nije u toku.');

        $redosledPoteza = $stanjeTable['turnOrder'] ?? [];
        $playIdx = $stanjeTable['playTurnIndex'] ?? 0;
        $idTrenutnogIgraca = $redosledPoteza[$playIdx % count($redosledPoteza)];
        abort_unless($idTrenutnogIgraca === $zahtev->user()->id, 403, 'Nije tvoj red.');

        $polja = self::TROMEDJE[$podaci['tri_index']];
        $tromedjeIgraca = $stanjeTable['playerTromedje'] ?? [];

        $pronadjeniIndeks = null;
        foreach ($tromedjeIgraca as $i => $t) {
            if (($t['tri_index'] ?? null) === $podaci['tri_index']) {
                $pronadjeniIndeks = $i;
                break;
            }
        }
        abort_if(is_null($pronadjeniIndeks), 422, 'Tu ne postoji tvoje selo.');
        abort_unless($tromedjeIgraca[$pronadjeniIndeks]['id'] === $idTrenutnogIgraca, 403, 'To nije tvoje selo.');
        abort_if(($tromedjeIgraca[$pronadjeniIndeks]['type'] ?? 'settlement') === 'city', 422, 'Tu je već izgrađen grad.');

        $pivotPodaci = DB::table('game_players')->where('game_id', $game->id)->where('user_id', $idTrenutnogIgraca)->first();
        $resursi = $pivotPodaci && $pivotPodaci->resources ? json_decode($pivotPodaci->resources, true) : [];
        abort_if(($resursi['psenica'] ?? 0) < 2 || ($resursi['kamen'] ?? 0) < 3, 422, 'Nemaš dovoljno resursa (2 pšenice + 3 kamena).');

        $tromedjeIgraca[$pronadjeniIndeks]['type'] = 'city';
        $stanjeTable['playerTromedje'] = $tromedjeIgraca;

        $result = $this->proveriKrajIgre($game, $stanjeTable);
        $stanjeTable = $result['bs'];
        $update = ['board_state' => $stanjeTable];
        if ($result['finished']) {
            $update['status'] = 'finished';
        }
        $game->update($update);

        $this->dodajResurse($game, $idTrenutnogIgraca, ['psenica' => -2, 'kamen' => -3]);

        return response()->json($this->pripremiOdgovor($game->fresh()));
    }



    // POST zavrsavanje poteza
    public function endTurn(Request $zahtev, Game $game)
    {
        $this->proveriPristup($game);

        $stanjeTable = $game->board_state ?? [];
        abort_unless(($stanjeTable['phase'] ?? null) === 'playing', 422, 'Partija nije u toku.');

        $redosledPoteza = $stanjeTable['turnOrder'] ?? [];
        $playIdx = $stanjeTable['playTurnIndex'] ?? 0;
        $idTrenutnogIgraca = $redosledPoteza[$playIdx % count($redosledPoteza)];
        abort_unless($idTrenutnogIgraca === $zahtev->user()->id, 403, 'Nije tvoj red.');

        $stanjeTable['playTurnIndex'] = $playIdx + 1;
        $stanjeTable['hasRolledThisTurn'] = false;
        $game->update(['board_state' => $stanjeTable]);

        return response()->json($this->pripremiOdgovor($game->fresh()));
    }

    // POST razmena 4 za 1
    public function trade(Request $zahtev, Game $game)
    {
        $this->proveriPristup($game);

        $podaci = $zahtev->validate([
            'give' => ['required', 'in:drvo,ovca,psenica,cigla,kamen'],
            'get' => ['required', 'in:drvo,ovca,psenica,cigla,kamen'],
        ]);

        abort_if($podaci['give'] === $podaci['get'], 422, 'Izaberi različite resurse.');

        $stanjeTable = $game->board_state ?? [];
        abort_unless(($stanjeTable['phase'] ?? null) === 'playing', 422, 'Partija nije u toku.');

        $redosledPoteza = $stanjeTable['turnOrder'] ?? [];
        $playIdx = $stanjeTable['playTurnIndex'] ?? 0;
        $idTrenutnogIgraca = $redosledPoteza[$playIdx % count($redosledPoteza)];
        abort_unless($idTrenutnogIgraca === $zahtev->user()->id, 403, 'Nije tvoj red.');

        $pivotPodaci = DB::table('game_players')->where('game_id', $game->id)->where('user_id', $idTrenutnogIgraca)->first();
        $resursi = $pivotPodaci && $pivotPodaci->resources ? json_decode($pivotPodaci->resources, true) : [];
        abort_if(($resursi[$podaci['give']] ?? 0) < 4, 422, 'Nemaš dovoljno resursa za razmenu (potrebno 4).');

        $this->dodajResurse($game, $idTrenutnogIgraca, [$podaci['give'] => -4, $podaci['get'] => 1]);

        return response()->json($this->pripremiOdgovor($game->fresh()));
    }


    // DELETE brise partiju 
    public function destroy(Request $zahtev, Game $game)
    {
        if ($game->created_by !== $zahtev->user()->id && ! $zahtev->user()->isAdmin()) {
            abort(403);
        }
        $game->delete();
        return response()->json(null, 204);
    }

    private function proveriPristup(Game $game): void
    {
        $korisnik = Auth::user();
        if (! $korisnik || (! $korisnik->isAdmin() && ! $game->players->contains($korisnik->id) && $game->created_by !== $korisnik->id)) {
            abort(403, 'Nemate pristup ovoj partiji.');
        }
    }

    
    private function proveriKrajIgre(Game $game, array $stanjeTable): array
    {
        if ($game->status === 'finished') {
            return ['bs' => $stanjeTable, 'finished' => false];
        }

        $poeniPoIgracu = [];
        foreach (($stanjeTable['playerTromedje'] ?? []) as $t) {
            $poeniPoIgracu[$t['id']] = ($poeniPoIgracu[$t['id']] ?? 0) + (($t['type'] ?? 'settlement') === 'city' ? 2 : 1);
        }

        $idPobednika = null;
        foreach ($poeniPoIgracu as $uid => $poeni) {
            if ($poeni >= 5) {
                $idPobednika = $uid;
                break;
            }
        }

        if (! $idPobednika) {
            return ['bs' => $stanjeTable, 'finished' => false];
        }

        $stanjeTable['winnerId'] = $idPobednika;

        foreach ($game->players as $korisnik) {
            $poeni = $poeniPoIgracu[$korisnik->id] ?? 0;
            $statistika = PlayerStat::firstOrCreate(['user_id' => $korisnik->id]);
            $statistika->increment('odigrane');
            $statistika->increment('ukupno_poena', $poeni);
            if ($korisnik->id === $idPobednika) {
                $statistika->increment('pobedjene');
            }
        }

        return ['bs' => $stanjeTable, 'finished' => true];
    }

    
    private function dodajResurse(Game $game, int $idKorisnika, array $razlika): void
    {
        $pivotPodaci = DB::table('game_players')->where('game_id', $game->id)->where('user_id', $idKorisnika)->first();
        $resursi = $pivotPodaci && $pivotPodaci->resources ? json_decode($pivotPodaci->resources, true) : [];
        foreach ($razlika as $res => $kolicina) {
            $resursi[$res] = max(0, ($resursi[$res] ?? 0) + $kolicina);
        }
        $game->players()->updateExistingPivot($idKorisnika, ['resources' => json_encode($resursi)]);
    }

    
    private function pripremiOdgovor(Game $game): array
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