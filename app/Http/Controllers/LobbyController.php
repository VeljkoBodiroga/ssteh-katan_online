<?php

namespace App\Http\Controllers;

use App\Models\Game;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class LobbyController extends Controller
{
    // GET /lobi — lista otvorenih lobija + forma za kreiranje novog
    public function index()
    {
        $openLobbies = Game::where('status', 'lobby')
            ->with('players', 'creator')
            ->withCount('players')
            ->latest()
            ->get();

        return view('lobby.index', compact('openLobbies'));
    }

    // POST /lobi — kreira novi lobi, kreator automatski postaje prvi igrac
    public function store(Request $request)
    {
        $data = $request->validate([
            'max_players' => ['required', 'integer', 'min:2', 'max:4'],
        ]);

        $game = DB::transaction(function () use ($data, $request) {
            $game = Game::create([
                'created_by' => $request->user()->id,
                'lobby_code' => Game::generateLobbyCode(),
                'status' => 'lobby',
                'max_players' => $data['max_players'],
            ]);

            $game->players()->attach($request->user()->id, [
                'resources' => json_encode([]),
            ]);

            return $game;
        });

        return redirect()->route('lobby.show', $game);
    }

    // GET /lobi/{game} — cekaonica (waiting room)
    public function show(Game $game)
    {
        abort_if($game->status !== 'lobby' && ! $game->players->contains(request()->user()->id), 404);

        return view('lobby.show', [
            'game' => $game,
            'isCreator' => $game->created_by === request()->user()->id,
        ]);
    }

    // GET /lobi/{game}/status — JSON za polling (auto-osvezavanje liste igraca)
    public function status(Game $game)
    {
        return response()->json([
            'status' => $game->status,
            'players' => $game->players()->get(['users.id', 'username'])->map(fn ($u) => [
                'id' => $u->id,
                'username' => $u->username,
            ]),
            'max_players' => $game->max_players,
            'is_full' => $game->isFull(),
        ]);
    }

    // POST /lobi/pridruzi — pridruzivanje pomocu koda lobija
    public function joinByCode(Request $request)
    {
        $data = $request->validate(['code' => ['required', 'string']]);

        $game = Game::where('lobby_code', strtoupper($data['code']))
            ->where('status', 'lobby')
            ->first();

        if (! $game) {
            return back()->withErrors(['code' => 'Lobi sa tim kodom ne postoji ili je partija već počela.']);
        }

        return $this->join($request, $game);
    }

    public function join(Request $request, Game $game)
    {
        if ($game->status !== 'lobby') {
            return redirect()->route('lobby.index')->withErrors(['lobby' => 'Ovaj lobi je već pokrenuo partiju.']);
        }
        if ($game->isFull()) {
            return redirect()->route('lobby.index')->withErrors(['lobby' => 'Lobi je pun.']);
        }
        if (! $game->players->contains($request->user()->id)) {
            $game->players()->attach($request->user()->id, ['resources' => json_encode([])]);
        }

        return redirect()->route('lobby.show', $game);
    }

    // POST /lobi/{game}/pokreni — samo kreator moze da pokrene partiju
    public function start(Request $request, Game $game)
    {
        abort_unless($game->created_by === $request->user()->id, 403, 'Samo kreator lobija može da pokrene partiju.');

        if ($game->players()->count() < 2) {
            return back()->withErrors(['lobby' => 'Potrebno je bar 2 igrača da bi partija počela.']);
        }

        $game->update(['status' => 'setup', 'started_at' => now()]);

        return redirect()->route('play', ['game' => $game->id]);
    }
}