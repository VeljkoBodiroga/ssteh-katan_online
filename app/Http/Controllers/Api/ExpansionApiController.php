<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Expansion;
use Illuminate\Http\Request;

class ExpansionApiController extends Controller
{
    // GET /api/expansions — javno dostupno (koristi ga i frontend fetch da demonstrira sopstveni REST API)
    public function index(Request $request)
    {
        $search = $request->string('search')->toString();

        $expansions = Expansion::when($search, fn ($q) => $q->where('title', 'like', "%{$search}%"))
            ->orderBy('title')
            ->get();

        return response()->json($expansions);
    }
}
