@extends('layouts.app')

@section('title', 'Igraj')

@push('styles')
<link rel="stylesheet" href="{{ asset('css/igraj.css') }}">
@endpush

@section('content')
@if ($game)
    <p style="text-align:center; color:#ccc; margin:10px 0;">
        Partija #{{ $game->id }} — igrači: {{ $players->pluck('name')->join(', ') }}
    </p>
@endif
<div class="board-wrapper">
    <div class="left-column">
        <p id="waiting-host-msg" style="display:none; color:#ccc;">
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

            <div class="build-actions">
                <button class="start-btn" id="btn-build-road" style="display:none;">Sagradi put</button>
                <button class="start-btn" id="btn-build-settlement" style="display:none;">Sagradi selo</button>
                <button class="start-btn" id="btn-build-city" style="display:none;">Izgradi grad</button>
            </div>

            <div class="button-row">
                <button class="start-btn" id="btn-next-turn" style="display:none;">Dalje</button>
                <button class="start-btn" id="btn-finish-game">Završi partiju</button>
            </div>

            <div class="player-info" id="player-info"></div>

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
        <button id="btn-reset" class="small-btn">Reset</button>
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