@extends('layouts.app')

@section('title', 'Izmena ekspanzije')

@section('content')
<div class="register-container">
    <div class="register-wrapper" style="grid-template-columns: 1fr;">
        <form method="POST" action="{{ route('expansions.update', $expansion) }}" enctype="multipart/form-data" class="register-form">
            @csrf
            @method('PUT')
            <h2>Izmena ekspanzije</h2>

            @if ($errors->any())
                <p class="error-message">{{ $errors->first() }}</p>
            @endif

            <label>Naziv</label>
            <input type="text" name="title" value="{{ old('title', $expansion->title) }}" required>

            <label>Opis</label>
            <textarea name="description" rows="4" required>{{ old('description', $expansion->description) }}</textarea>

            <img src="{{ $expansion->image_url }}" alt="{{ $expansion->title }}" style="max-width:150px;display:block;margin:10px 0;">

            <label>Nova slika (opciono)</label>
            <input type="file" name="image" accept="image/*">

            <button type="submit">Sačuvaj izmene</button>

            <div class="register-section">
                <a href="{{ route('expansions.index') }}">← Nazad na listu</a>
            </div>
        </form>
    </div>
</div>
@endsection
