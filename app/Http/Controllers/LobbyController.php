<?php

namespace App\Http\Controllers;

use App\Models\Game;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class LobbyController extends Controller
{
    // GET lobi, lista lobija
    public function index()
    {
        $openLobbies = Game::where('status', 'lobby')
            ->with('players', 'creator')
            ->withCount('players')
            ->latest()
            ->get();

        return view('lobby.index', compact('openLobbies'));
    }

    // POST lobi, kreira lobi
    public function store(Request $zahtev)
    {
        $podaci = $zahtev->validate([
            'max_players' => ['required', 'integer', 'min:2', 'max:4'],
        ]);

        $game = DB::transaction(function () use ($podaci, $zahtev) {
            $game = Game::create([
                'created_by' => $zahtev->user()->id,
                'lobby_code' => Game::generateLobbyCode(),
                'status' => 'lobby',
                'max_players' => $podaci['max_players'],
            ]);

            $game->players()->attach($zahtev->user()->id, [
                'resources' => json_encode([]),
            ]);

            return $game;
        });

        return redirect()->route('lobby.show', $game);
    }

    // GET cekaonica
    public function show(Game $game)
    {
        abort_if($game->status !== 'lobby' && ! $game->players->contains(request()->user()->id), 404);

        return view('lobby.show', [
            'game' => $game,
            'isCreator' => $game->created_by === request()->user()->id,
        ]);
    }

    // GET osvezavanje lista igraca
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

    // POST pridruzivanje pomocu koda lobija
    public function joinByCode(Request $zahtev)
    {
        $podaci = $zahtev->validate(['code' => ['required', 'string']]);

        $game = Game::where('lobby_code', strtoupper($podaci['code']))
            ->where('status', 'lobby')
            ->first();

        if (! $game) {
            return back()->withErrors(['code' => 'Lobi sa tim kodom ne postoji ili je partija već počela.']);
        }

        return $this->join($zahtev, $game);
    }

    public function join(Request $zahtev, Game $game)
    {
        if ($game->status !== 'lobby') {
            return redirect()->route('lobby.index')->withErrors(['lobby' => 'Ovaj lobi je već pokrenuo partiju.']);
        }
        if ($game->isFull()) {
            return redirect()->route('lobby.index')->withErrors(['lobby' => 'Lobi je pun.']);
        }
        if (! $game->players->contains($zahtev->user()->id)) {
            $game->players()->attach($zahtev->user()->id, ['resources' => json_encode([])]);
        }

        return redirect()->route('lobby.show', $game);
    }

    // POST pokretanje, samo kreator moze da pokrene partiju
    public function start(Request $zahtev, Game $game)
    {
        abort_unless($game->created_by === $zahtev->user()->id, 403, 'Samo kreator lobija može da pokrene partiju.');

        if ($game->players()->count() < 2) {
            return back()->withErrors(['lobby' => 'Potrebno je bar 2 igrača da bi partija počela.']);
        }

        $game->update(['status' => 'setup', 'started_at' => now()]);

        return redirect()->route('play', ['game' => $game->id]);
    }

    // POST ugasi, samo kreator moze, sve izbaci iz lobija
    public function cancel(Request $zahtev, Game $game)
    {
        abort_unless($game->created_by === $zahtev->user()->id, 403, 'Samo kreator lobija može da ga ugasi.');
        abort_unless($game->status === 'lobby', 422, 'Partija je već pokrenuta.');

        $game->delete();

        return redirect()->route('lobby.index')->with('status', 'Lobi je ugašen.');
    }

    // POST bican igrac napusta lobi
    public function leave(Request $zahtev, Game $game)
    {
        abort_if($game->created_by === $zahtev->user()->id, 403, 'Kreator ne može da napusti sopstveni lobi — ugasi ga.');
        abort_unless($game->status === 'lobby', 422, 'Partija je već pokrenuta.');

        $game->players()->detach($zahtev->user()->id);

        return redirect()->route('lobby.index')->with('status', 'Napustio si lobi.');
    }
}