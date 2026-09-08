@extends('layouts.app')

@section('title', 'Nova ekspanzija')

@section('content')
<div class="register-container">
    <div class="register-wrapper" style="grid-template-columns: 1fr;">
        <form method="POST" action="{{ route('expansions.store') }}" enctype="multipart/form-data" class="register-form">
            @csrf
            <h2>Nova ekspanzija</h2>

            @if ($errors->any())
                <p class="error-message">{{ $errors->first() }}</p>
            @endif

            <label>Naziv</label>
            <input type="text" name="title" value="{{ old('title') }}" required>

            <label>Opis</label>
            <textarea name="description" rows="4" required>{{ old('description') }}</textarea>

            <label>Slika</label>
            <input type="file" name="image" accept="image/*" required>

            <button type="submit">Sačuvaj</button>

            <div class="register-section">
                <a href="{{ route('expansions.index') }}">← Nazad na listu</a>
            </div>
        </form>
    </div>
</div>
@endsection
