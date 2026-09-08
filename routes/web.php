<?php

use App\Http\Controllers\Auth\LoginController;
use App\Http\Controllers\Auth\PasswordResetController;
use App\Http\Controllers\Auth\RegisterController;
use App\Http\Controllers\ExpansionController;
use App\Http\Controllers\GameController;
use App\Http\Controllers\HomeController;
use App\Http\Controllers\StatsController;
use Illuminate\Support\Facades\Route;

// ---- Javno dostupno (gost) ----
Route::get('/', [HomeController::class, 'index'])->name('home');
Route::get('/pravila', [HomeController::class, 'rules'])->name('rules');

Route::get('/ekspanzije', [ExpansionController::class, 'index'])->name('expansions.index');
Route::get('/ekspanzije/export', [ExpansionController::class, 'exportCsv'])->name('expansions.export');

// ---- Gost (samo neulogovan) ----
Route::middleware('guest')->group(function () {
    Route::get('/login', [LoginController::class, 'show'])->name('login');
    Route::post('/login', [LoginController::class, 'login']);
    Route::get('/register', [RegisterController::class, 'show'])->name('register');
    Route::post('/register', [RegisterController::class, 'register']);

    Route::get('/forgot-password', [PasswordResetController::class, 'showRequestForm'])->name('password.request');
    Route::post('/forgot-password', [PasswordResetController::class, 'sendResetLink'])->name('password.email');
    Route::get('/reset-password/{token}', [PasswordResetController::class, 'showResetForm'])->name('password.reset');
    Route::post('/reset-password', [PasswordResetController::class, 'reset'])->name('password.update');
});

Route::post('/logout', [LoginController::class, 'logout'])->middleware('auth')->name('logout');

// ---- Autentifikovan korisnik ----
Route::middleware('auth')->group(function () {
    Route::get('/statistika', [StatsController::class, 'index'])->name('stats');
    Route::get('/igraj', [GameController::class, 'play'])->name('play');
});

// ---- Admin ----
Route::middleware(['auth', 'role:admin'])->prefix('admin')->group(function () {
    Route::get('/ekspanzije/nova', [ExpansionController::class, 'create'])->name('expansions.create');
    Route::post('/ekspanzije', [ExpansionController::class, 'store'])->name('expansions.store');
    Route::get('/ekspanzije/{expansion}/izmena', [ExpansionController::class, 'edit'])->name('expansions.edit');
    Route::put('/ekspanzije/{expansion}', [ExpansionController::class, 'update'])->name('expansions.update');
    Route::delete('/ekspanzije/{expansion}', [ExpansionController::class, 'destroy'])->name('expansions.destroy');
});
