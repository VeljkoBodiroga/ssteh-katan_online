<?php

use App\Http\Controllers\Api\ExpansionApiController;
use App\Http\Controllers\Api\GameApiController;
use Illuminate\Support\Facades\Route;

// Javno (gost)
Route::get('/expansions', [ExpansionApiController::class, 'index']);

// Autentifikovan korisnik / admin — koristi istu web sesiju (cookie) kao i Blade stranice,
// zato ide preko 'web' middleware grupe (session + CSRF), a ne posebnog API tokena.
Route::middleware(['web', 'auth'])->group(function () {
    Route::get('/games', [GameApiController::class, 'index']);
    Route::post('/games', [GameApiController::class, 'store']);
    Route::get('/games/{game}', [GameApiController::class, 'show']);
    Route::put('/games/{game}', [GameApiController::class, 'update']);
    Route::delete('/games/{game}', [GameApiController::class, 'destroy']);

    // ugnjezdena ruta
    Route::get('/games/{game}/players', [GameApiController::class, 'players']);
    Route::post('/games/{game}/setup-board', [GameApiController::class, 'setupBoard']);
    Route::post('/games/{game}/pick', [GameApiController::class, 'pick']);
    Route::post('/games/{game}/roll', [GameApiController::class, 'roll']);
    Route::post('/games/{game}/build-road', [GameApiController::class, 'buildRoad']);
    Route::post('/games/{game}/build-settlement', [GameApiController::class, 'buildSettlement']);
    Route::post('/games/{game}/build-city', [GameApiController::class, 'buildCity']);
    Route::post('/games/{game}/trade', [GameApiController::class, 'trade']);
    Route::post('/games/{game}/end-turn', [GameApiController::class, 'endTurn']);
});