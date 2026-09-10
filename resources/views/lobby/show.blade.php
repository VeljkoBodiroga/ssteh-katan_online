@extends('layouts.app')

@section('title', 'Čekaonica')

@section('content')
<div class="stats-container">
    <h1>Čekaonica</h1>

    <p style="text-align:center;">
        Kod lobija: <strong style="font-size:22px; letter-spacing:2px;">{{ $game->lobby_code }}</strong><br>
        <span style="color:#999;">Podeli ovaj kod sa ostalim igračima da se pridruže.</span>
    </p>

    @if ($errors->any())
        <p class="error-message" style="text-align:center;">{{ $errors->first() }}</p>
    @endif

    <div class="quote-box">
        <h2>Igrači (<span id="player-count">0</span> / {{ $game->max_players }})</h2>
        <ul id="players-list" style="list-style:none; padding:0; font-size:18px;"></ul>
        <p id="waiting-msg" style="color:#999;">Čeka se da se pridruže još igrači...</p>
    </div>

    <p id="closed-msg" style="display:none; text-align:center; color:#e53935; font-size:20px; font-weight:700; margin-top:20px;">
        ⚠️ Lobi je ugašen. Vraćam te na listu lobija...
    </p>

    <div style="text-align:center; margin-top:20px; display:flex; flex-direction:column; align-items:center; gap:14px;">
        @if ($isCreator)
            <form method="POST" action="{{ route('lobby.start', $game) }}" id="start-form">
                @csrf
                <button type="submit" class="lobby-btn lobby-btn-primary" id="btn-start-lobby" disabled>Počni igru</button>
            </form>
            <p style="color:#999; font-size:14px; margin:0;">Potrebno je bar 2 igrača da bi partija mogla da počne.</p>

            <form method="POST" action="{{ route('lobby.cancel', $game) }}" onsubmit="return confirm('Sigurno gasiš lobi? Svi igrači će izaći.')">
                @csrf
                <button type="submit" class="lobby-btn lobby-btn-danger">Ugasi lobi</button>
            </form>
        @else
            <p style="color:#999; margin:0;">Čekaj da kreator lobija pokrene partiju...</p>

            <form method="POST" action="{{ route('lobby.leave', $game) }}">
                @csrf
                <button type="submit" class="lobby-btn lobby-btn-danger">Izađi iz lobija</button>
            </form>
        @endif
    </div>
</div>
@endsection

@push('scripts')
<script>
    const statusUrl = "{{ route('lobby.status', $game) }}";
    const playUrl = "{{ route('play') }}";
    const lobbyIndexUrl = "{{ route('lobby.index') }}";
    const isCreator = @json($isCreator);
    let stopped = false;

    async function refreshLobby() {
        if (stopped) return;
        try {
            const res = await fetch(statusUrl, { headers: { Accept: 'application/json' } });

            if (res.status === 404) {
                stopped = true;
                document.getElementById('closed-msg').style.display = 'block';
                setTimeout(() => { window.location.href = lobbyIndexUrl; }, 2000);
                return;
            }
            if (!res.ok) throw new Error('bad response');

            const data = await res.json();

            document.getElementById('player-count').textContent = data.players.length;

            const list = document.getElementById('players-list');
            list.innerHTML = '';
            data.players.forEach((p) => {
                const li = document.createElement('li');
                li.textContent = '👤 ' + p.username;
                list.appendChild(li);
            });

            document.getElementById('waiting-msg').style.display = data.is_full ? 'none' : 'block';

            if (isCreator) {
                document.getElementById('btn-start-lobby').disabled = data.players.length < 2;
            }

            if (data.status !== 'lobby') {
                window.location.href = `${playUrl}?game={{ $game->id }}`;
            }
        } catch (e) {
            console.warn('Greška pri osvežavanju lobija:', e);
        }
    }

    refreshLobby();
    setInterval(refreshLobby, 2500);
</script>
@endpush