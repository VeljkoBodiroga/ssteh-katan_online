<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class LoginController extends Controller
{
    public function show()
    {
        return view('auth.login');
    }

    public function login(Request $zahtev)
    {
        $credentials = $zahtev->validate([
            'login' => ['required', 'string'],   
            'password' => ['required', 'string'],
        ]);

        $field = filter_var($credentials['login'], FILTER_VALIDATE_EMAIL) ? 'email' : 'username';

        if (Auth::attempt([$field => $credentials['login'], 'password' => $credentials['password']], $zahtev->boolean('remember'))) {
            $zahtev->session()->regenerate();
            return redirect()->intended('/');
        }

        return back()->withErrors(['login' => 'Pogrešno korisničko ime/email ili lozinka'])->onlyInput('login');
    }

    public function logout(Request $zahtev)
    {
        Auth::logout();
        $zahtev->session()->invalidate();
        $zahtev->session()->regenerateToken();
        return redirect('/');
    }
}
