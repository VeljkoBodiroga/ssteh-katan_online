<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\PlayerStat;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;

class RegisterController extends Controller
{
    public function show()
    {
        return view('auth.register');
    }

    public function register(Request $zahtev)
    {
        $podaci = $zahtev->validate([
            'username' => ['required', 'string', 'max:50', 'unique:users,username'],
            'email' => ['required', 'string', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'min:6', 'confirmed'],
        ]);

        $korisnik = User::create([
            'username' => $podaci['username'],
            'email' => $podaci['email'],
            'password' => Hash::make($podaci['password']),
            'role' => 'user',
        ]);

        // svaki novi igrac odmah dobija red u player_stats (default 0)
        PlayerStat::create(['user_id' => $korisnik->id]);

        Auth::login($korisnik);

        return redirect('/');
    }
}
