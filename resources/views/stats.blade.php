@extends('layouts.app')

@section('title', 'Statistika igrača')

@section('content')
<div class="stats-container">
    <h1>Statistika igrača: {{ auth()->user()->username }}</h1>

    <table class="stats-table">
        <thead>
            <tr>
                <th>Odigrane partije</th>
                <th>Pobedjene partije</th>
                <th>Procenat pobeda</th>
                <th>Poeni po partiji</th>
                <th>Ukupno poena</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td>{{ $stats->odigrane ?? 0 }}</td>
                <td>{{ $stats->pobedjene ?? 0 }}</td>
                <td>{{ $stats->procenat ?? 0 }}%</td>
                <td>{{ $stats->poeni_po_partiji ?? 0 }}</td>
                <td>{{ $stats->ukupno_poena ?? 0 }}</td>
            </tr>
        </tbody>
    </table>

    <div class="quote-box">
        <h2>Motivacija za nastavak igre</h2>
        <p>{{ $quote }}</p>
    </div>
</div>
@endsection
