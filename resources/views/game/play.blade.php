@extends('layouts.app')

@section('title', 'Igraj')

@push('styles')
<link rel="stylesheet" href="{{ asset('css/igraj.css') }}">
@endpush

@section('content')
@if ($game)
    <p style="text-align:center; color:#23232e; margin:10px 0;">
        Partija #{{ $game->id }} — igrači: {{ $players->pluck('name')->join(', ') }}
    </p>
@endif
<div id="game-over-overlay" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:1000; align-items:center; justify-content:center; flex-direction:column; gap:20px;">
    <h1 style="color:white;">🏁 Kraj igre!</h1>
    <p id="game-over-text" style="color:white; font-size:22px;"></p>
    <a href="{{ route('home') }}" class="start-btn">Vrati se na početnu</a>
</div>
<div class="board-wrapper">
    <div class="left-column">
        <p id="waiting-host-msg" style="display:none; color:#23232e;">
            ⏳ Čeka se da kreator lobija postavi tablu (izabere polja i baci kockicu za brojeve)...
        </p>

        <div id="setup-controls">
            <button class="dice-btn" id="btn-roll-setup">Baci kocku i dodeli brojeve</button>
            <p id="setup-roll-result"></p>
            <button class="start-btn" id="btn-submit-board" style="display:none;">Postavi tablu</button>
        </div>

        <div id="picking-controls" style="display:none;">
            <p id="turn-indicator" style="font-weight:600;"></p>
            <ul id="tromedje-list" style="list-style:none; padding:0; max-height:260px; overflow-y:auto;"></ul>
            <button class="start-btn" id="btn-start-game" style="display:none;">Počni igru</button>
        </div>

        <div id="game-controls" style="display:none;">
            <div class="button-row">
                <p id="turn-indicator-playing" style="font-weight:600; margin:0 10px 0 0;"></p>
                <div class="dice-icon" id="dice-icon">
                    <span style="font-size: 32px; cursor: pointer;">🎲</span>
                </div>
            </div>
                <div class="player-info" id="player-info"></div>
                <div class="build-actions">
                <button class="start-btn" id="btn-build-road" style="display:none;">Sagradi put</button>
                <button class="start-btn" id="btn-build-settlement" style="display:none;">Sagradi selo</button>
                <button class="start-btn" id="btn-build-city" style="display:none;">Izgradi grad</button>
                <button class="start-btn" id="btn-trade-resources" style="display:none;">Razmeni resurse (4:1)</button>
            </div>

            <div class="trade-panel" id="trade-panel" style="display:none;">
                <label>
                    Daj 4x:
                    <select id="trade-give">
                        <option value="drvo">🌲 Drvo</option>
                        <option value="ovca">🐑 Ovca</option>
                        <option value="psenica">🌾 Pšenica</option>
                        <option value="cigla">🧱 Cigla</option>
                        <option value="kamen">🪨 Kamen</option>
                    </select>
                </label>
                <label>
                    Dobij 1x:
                    <select id="trade-get">
                        <option value="drvo">🌲 Drvo</option>
                        <option value="ovca">🐑 Ovca</option>
                        <option value="psenica">🌾 Pšenica</option>
                        <option value="cigla">🧱 Cigla</option>
                        <option value="kamen">🪨 Kamen</option>
                    </select>
                </label>
                <button class="start-btn" id="btn-confirm-trade">Potvrdi razmenu</button>
            </div>

            <div class="button-row">
                <button class="start-btn" id="btn-next-turn" style="display:none;">Dalje</button>
                <button class="start-btn" id="btn-finish-game">Završi partiju</button>
            </div>

                <div class="discard-panel" id="discard-panel" style="display:none;">
                <p id="discard-info" style="font-weight:600;"></p>
                <label>🌲 Drvo <input type="number" id="discard-drvo" min="0" value="0"></label>
                <label>🐑 Ovca <input type="number" id="discard-ovca" min="0" value="0"></label>
                <label>🌾 Pšenica <input type="number" id="discard-psenica" min="0" value="0"></label>
                <label>🧱 Cigla <input type="number" id="discard-cigla" min="0" value="0"></label>
                <label>🪨 Kamen <input type="number" id="discard-kamen" min="0" value="0"></label>
                <button class="start-btn" id="btn-confirm-discard">Potvrdi odbacivanje</button>
            </div>

            

            <div class="roll-log">
                <h3>Poslednja bacanja:</h3>
                <ul id="roll-log-list"></ul>
            </div>
        </div>
    </div>

    <div class="board" id="board"></div>

    <div class="controls-top">
        <button id="btn-save" class="small-btn">Sačuvaj</button>
        <button id="btn-load" class="small-btn">Učitaj</button>
    </div>
</div>
@endsection

@push('scripts')
<script>
    window.CATAN_CONFIG = {
        csrfToken: document.querySelector('meta[name="csrf-token"]').content,
        imagesBase: "{{ asset('images') }}",
        apiBase: "{{ url('/api') }}",
        gameId: @json($game->id ?? null),
        players: @json($players ?? []),
        currentUserId: {{ auth()->id() ?? 'null' }},
    };
</script>
<script src="{{ asset('js/game.js') }}"></script>
@endpush