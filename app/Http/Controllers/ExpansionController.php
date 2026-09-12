<?php

namespace App\Http\Controllers;

use App\Models\Expansion;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class ExpansionController extends Controller
{
    /**
     * Javna lista ekspanzija: pretraga + sortiranje + paginacija
     * (isto sto i Stranice/Ekspanzije.tsx u React verziji, samo sad iz baze)
     */
    public function index(Request $zahtev)
    {
        $search = $zahtev->string('search')->toString();
        $sort = $zahtev->string('sort', 'title')->toString();

        $query = Expansion::query()
            ->when($search, fn ($q) => $q->where('title', 'like', "%{$search}%"));

        $query = $sort === 'length'
            ? $query->orderByRaw('CHAR_LENGTH(description) asc')
            : $query->orderBy('title');

        $expansions = $query->paginate(2)->withQueryString();

        return view('expansions.index', compact('expansions', 'search', 'sort'));
    }

    public function create()
    {
        return view('expansions.create');
    }

    public function store(Request $zahtev)
    {
        $podaci = $zahtev->validate([
            'title' => ['required', 'string', 'max:255'],
            'description' => ['required', 'string'],
            'image' => ['required', 'image', 'max:4096'],
        ]);

        $putanja = $zahtev->file('image')->store('expansions', 'public');

        Expansion::create([
            'title' => $podaci['title'],
            'description' => $podaci['description'],
            'image' => $putanja,
        ]);

        return redirect()->route('expansions.index')->with('status', 'Ekspanzija dodata.');
    }

    public function edit(Expansion $expansion)
    {
        return view('expansions.edit', compact('expansion'));
    }

    public function update(Request $zahtev, Expansion $expansion)
    {
        $podaci = $zahtev->validate([
            'title' => ['required', 'string', 'max:255'],
            'description' => ['required', 'string'],
            'image' => ['nullable', 'image', 'max:4096'],
        ]);

        if ($zahtev->hasFile('image')) {
            if ($expansion->image && Storage::disk('public')->exists($expansion->image)) {
                Storage::disk('public')->delete($expansion->image);
            }
            $podaci['image'] = $zahtev->file('image')->store('expansions', 'public');
        }

        $expansion->update($podaci);

        return redirect()->route('expansions.index')->with('status', 'Ekspanzija izmenjena.');
    }

    public function destroy(Expansion $expansion)
    {
        $expansion->delete();
        return redirect()->route('expansions.index')->with('status', 'Ekspanzija obrisana.');
    }

    
}