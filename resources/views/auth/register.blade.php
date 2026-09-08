@extends('layouts.app')

@section('title', 'Registracija')

@section('content')
<div class="register-container">
    <div class="register-wrapper">
        <form method="POST" action="{{ route('register') }}" class="register-form">
            @csrf
            <h2>Registracija</h2>

            @if ($errors->any())
                <p class="error-message">{{ $errors->first() }}</p>
            @endif

            <label for="username">Korisničko ime</label>
            <input id="username" type="text" name="username" value="{{ old('username') }}" placeholder="Unesite korisničko ime">

            <label for="email">Email</label>
            <input id="email" type="email" name="email" value="{{ old('email') }}" placeholder="Unesite email">

            <label for="password">Lozinka</label>
            <input id="password" type="password" name="password" placeholder="Unesite lozinku">

            <label for="password_confirmation">Ponovi lozinku</label>
            <input id="password_confirmation" type="password" name="password_confirmation" placeholder="Ponovite lozinku">

            <button type="submit">Registracija</button>

            <div class="register-section">
                Već imate nalog?
                <a href="{{ route('login') }}" class="login-link">Prijavite se</a>
            </div>
        </form>

        <img src="{{ asset('images/katantabla.png') }}" alt="Catan" class="register-image">
    </div>
</div>
@endsection
