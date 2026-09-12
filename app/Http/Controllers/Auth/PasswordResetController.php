<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;

class PasswordResetController extends Controller
{
    public function showRequestForm()
    {
        return view('auth.forgot-password');
    }

    // Salje link za reset na email (koristi Laravel Password broker + queue mail)
    public function sendResetLink(Request $zahtev)
    {
        $zahtev->validate(['email' => ['required', 'email']]);

        $status = Password::sendResetLink($zahtev->only('email'));

        return $status === Password::RESET_LINK_SENT
            ? back()->with('status', 'Link za resetovanje lozinke je poslat na email.')
            : back()->withErrors(['email' => __($status)]);
    }

    public function showResetForm(Request $zahtev, string $token)
    {
        return view('auth.reset-password', ['token' => $token, 'email' => $zahtev->email]);
    }

    public function reset(Request $zahtev)
    {
        $zahtev->validate([
            'token' => ['required'],
            'email' => ['required', 'email'],
            'password' => ['required', 'confirmed', 'min:6'],
        ]);

        $status = Password::reset(
            $zahtev->only('email', 'password', 'password_confirmation', 'token'),
            function ($korisnik, $password) {
                $korisnik->forceFill(['password' => Hash::make($password)])->save();
            }
        );

        return $status === Password::PASSWORD_RESET
            ? redirect('/login')->with('status', 'Lozinka je uspešno promenjena.')
            : back()->withErrors(['email' => __($status)]);
    }
}
