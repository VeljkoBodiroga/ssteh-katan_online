@extends('layouts.app')

@section('title', 'Settlers of CATAN')

@section('content')
<div class="home">
    <main class="home-main" style="background-image: url('{{ asset('images/pozadina.png') }}')">
        <div class="center-content">
            <div class="table-logo">
                <img src="{{ asset('images/katantabla.png') }}" alt="Catan logo" class="hex-logo">
            </div>

            @auth
                <a href="{{ route('play') }}" class="play-btn">Igraj</a>
            @else
                <a href="{{ route('login') }}" class="play-btn">Igraj</a>
            @endauth

            <div class="options-wrapper">
                <a href="{{ route('rules') }}" class="option-btn">Pravila igre</a>
                <a href="{{ route('expansions.index') }}" class="option-btn">Ekspanzije</a>
            </div>
        </div>
    </main>
</div>
@endsection
