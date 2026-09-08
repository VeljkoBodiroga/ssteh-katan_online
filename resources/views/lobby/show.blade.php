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

    <div style="text-align:center; margin-top:20px;">
        @if ($isCreator)
            <form method="POST" action="{{ route('lobby.start', $game) }}" id="start-form">
                @csrf
                <button type="submit" class="dice-btn" id="btn-start-lobby" disabled>Počni igru</button>
            </form>
            <p style="color:#999; font-size:14px;">Potrebno je bar 2 igrača da bi partija mogla da počne.</p>
        @else
            <p style="color:#999;">Čekaj da kreator lobija pokrene partiju...</p>
        @endif
    </div>
</div>
@endsection

@push('scripts')
<script>
    const statusUrl = "{{ route('lobby.status', $game) }}";
    const playUrl = "{{ route('play') }}";
    const isCreator = @json($isCreator);

    async function refreshLobby() {
        try {
            const res = await fetch(statusUrl, { headers: { Accept: 'application/json' } });
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

            // Ako je kreator vec pokrenuo partiju (status vise nije 'lobby'), i drugi igraci
            // treba automatski da odu na tablu.
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