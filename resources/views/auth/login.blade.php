@extends('layouts.app')

@section('title', 'Prijava')

@section('content')
<div class="login-container">
    <div class="login-wrapper">
        <form method="POST" action="{{ route('login') }}" class="login-form">
            @csrf
            <h2>Prijavi se:</h2>

            @if ($errors->any())
                <p class="error-message">{{ $errors->first() }}</p>
            @endif

            <label>Username/Email</label>
            <input type="text" name="login" value="{{ old('login') }}" placeholder="Unesite korisničko ime ili email" required>

            <label>Lozinka</label>
            <input type="password" name="password" placeholder="Unesite lozinku" required>

            <button type="submit">Prijavi se</button>
            <a href="{{ route('password.request') }}">Zaboravljena šifra?</a>

            <div class="register-section">
                <p>ili ukoliko nemaš nalog:</p>
                <a href="{{ route('register') }}"><button type="button">Registracija</button></a>
            </div>
        </form>

        <img class="login-image" src="{{ asset('images/katantabla.png') }}" alt="Catan tabla">
    </div>
</div>
@endsection
