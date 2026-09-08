@extends('layouts.app')

@section('title', 'Nova lozinka')

@section('content')
<div class="login-container">
    <div class="login-wrapper">
        <form method="POST" action="{{ route('password.update') }}" class="login-form">
            @csrf
            <input type="hidden" name="token" value="{{ $token }}">
            <h2>Postavi novu lozinku</h2>

            @if ($errors->any())
                <p class="error-message">{{ $errors->first() }}</p>
            @endif

            <label>Email</label>
            <input type="email" name="email" value="{{ old('email', $email ?? '') }}" required>

            <label>Nova lozinka</label>
            <input type="password" name="password" required>

            <label>Ponovi lozinku</label>
            <input type="password" name="password_confirmation" required>

            <button type="submit">Sačuvaj novu lozinku</button>
        </form>
    </div>
</div>
@endsection
