@extends('layouts.app')

@section('title', 'Zaboravljena lozinka')

@section('content')
<div class="login-container">
    <div class="login-wrapper">
        <form method="POST" action="{{ route('password.email') }}" class="login-form">
            @csrf
            <h2>Zaboravljena lozinka</h2>

            @if (session('status'))
                <p style="color:#2e7d32;">{{ session('status') }}</p>
            @endif
            @if ($errors->any())
                <p class="error-message">{{ $errors->first() }}</p>
            @endif

            <label>Email</label>
            <input type="email" name="email" placeholder="Unesite email" required>

            <button type="submit">Pošalji link za reset</button>
        </form>
    </div>
</div>
@endsection
