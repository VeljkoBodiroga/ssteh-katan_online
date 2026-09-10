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
    public function index(Request $request)
    {
        $search = $request->string('search')->toString();
        $sort = $request->string('sort', 'title')->toString();

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

    public function store(Request $request)
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'description' => ['required', 'string'],
            'image' => ['required', 'image', 'max:4096'],
        ]);

        $path = $request->file('image')->store('expansions', 'public');

        Expansion::create([
            'title' => $data['title'],
            'description' => $data['description'],
            'image' => $path,
        ]);

        return redirect()->route('expansions.index')->with('status', 'Ekspanzija dodata.');
    }

    public function edit(Expansion $expansion)
    {
        return view('expansions.edit', compact('expansion'));
    }

    public function update(Request $request, Expansion $expansion)
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'description' => ['required', 'string'],
            'image' => ['nullable', 'image', 'max:4096'],
        ]);

        if ($request->hasFile('image')) {
            if ($expansion->image && Storage::disk('public')->exists($expansion->image)) {
                Storage::disk('public')->delete($expansion->image);
            }
            $data['image'] = $request->file('image')->store('expansions', 'public');
        }

        $expansion->update($data);

        return redirect()->route('expansions.index')->with('status', 'Ekspanzija izmenjena.');
    }

    public function destroy(Expansion $expansion)
    {
        $expansion->delete();
        return redirect()->route('expansions.index')->with('status', 'Ekspanzija obrisana.');
    }

    
}