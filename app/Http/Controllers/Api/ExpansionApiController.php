<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Expansion;
use Illuminate\Http\Request;

class ExpansionApiController extends Controller
{
    public function index(Request $zahtev)
    {
        $search = $zahtev->string('search')->toString();

        $expansions = Expansion::when($search, fn ($q) => $q->where('title', 'like', "%{$search}%"))
            ->orderBy('title')
            ->get();

        return response()->json($expansions);
    }
}
