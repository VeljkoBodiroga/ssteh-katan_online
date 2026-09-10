@extends('layouts.app')

@section('title', 'Ekspanzije')

@section('content')
<div class="ekspanzije-container">

        <form method="GET" action="{{ route('expansions.index') }}" class="filters">
        <input type="text" name="search" value="{{ $search }}" placeholder="Pretraži po nazivu..."
               onkeydown="if(event.key==='Enter'){this.form.submit();}">
        <select name="sort" onchange="this.form.submit()">
            <option value="title" @selected($sort === 'title')>Sortiraj po nazivu</option>
            <option value="length" @selected($sort === 'length')>Sortiraj po dužini opisa</option>
        </select>
        @auth
            @if (auth()->user()->isAdmin())
                <a href="{{ route('expansions.create') }}" style="margin-left:10px;">+ Nova ekspanzija</a>
            @endif
        @endauth
    </form>

    <div class="ekspanzije-grid">
        @foreach ($expansions as $exp)
            <div class="ekspanzija-box">
                <h3>{{ $exp->title }}</h3>
                <img src="{{ $exp->image_url }}" alt="{{ $exp->title }}">
                <p>{{ $exp->shortDesc(80) }}</p>

                @auth
                    @if (auth()->user()->isAdmin())
                        <div style="margin-top:8px; display:flex; gap:8px; justify-content:center;">
                            <a href="{{ route('expansions.edit', $exp) }}">Izmeni</a>
                            <form method="POST" action="{{ route('expansions.destroy', $exp) }}" onsubmit="return confirm('Obrisati ekspanziju?')">
                                @csrf @method('DELETE')
                                <button type="submit">Obriši</button>
                            </form>
                        </div>
                    @endif
                @endauth
            </div>
        @endforeach
    </div>

        <div class="pagination">
        {{ $expansions->onEachSide(1)->links('partials.pagination') }}
    </div>
</div>
@endsection