@extends('layouts.app')

@section('title', 'Lobi')

@section('content')
<div class="lobby-page">
    <div class="lobby-actions">
        <form method="POST" action="{{ route('lobby.store') }}" class="login-form">
            @csrf
            <h2>Napravi lobi</h2>

            @if ($errors->any())
                <p class="error-message">{{ $errors->first() }}</p>
            @endif

            <label>Broj igrača</label>
            <select name="max_players">
                <option value="2">2 igrača</option>
                <option value="3">3 igrača</option>
                <option value="4" selected>4 igrača</option>
            </select>

            <button type="submit">Napravi lobi</button>
        </form>

        <form method="POST" action="{{ route('lobby.joinByCode') }}" class="login-form">
            @csrf
            <h2>Pridruži se lobiju</h2>
            <label>Kod lobija</label>
            <input type="text" name="code" placeholder="npr. AB12CD" style="text-transform:uppercase;" required>
            <button type="submit">Pridruži se</button>
        </form>

        <div class="lobby-open-list">
            <h2>Otvoreni lobiji</h2>

            @if ($openLobbies->isEmpty())
                <p style="color:#23232e; text-align:center;">Trenutno nema otvorenih lobija. Napravi svoj!</p>
            @else
                <table class="stats-table">
                    <thead>
                        <tr>
                            <th>Kod</th>
                            <th>Kreator</th>
                            <th>Igrači</th>
                        </tr>
                    </thead>
                    <tbody>
                        @foreach ($openLobbies as $lobby)
                            <tr>
                                <td>{{ $lobby->lobby_code }}</td>
                                <td>{{ $lobby->creator->username }}</td>
                                <td>{{ $lobby->players_count }} / {{ $lobby->max_players }}</td>
                            </tr>
                        @endforeach
                    </tbody>
                </table>
                
            @endif
        </div>
    </div>
</div>
@endsection