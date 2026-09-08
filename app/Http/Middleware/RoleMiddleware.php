<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class RoleMiddleware
{
    /**
     * Koristi se u rutama kao middleware('role:admin')
     * Omogucava razlikovanje minimum 3 uloge: gost (nije ulogovan), user, admin.
     */
    public function handle(Request $request, Closure $next, string $role): Response
    {
        if (! $request->user() || $request->user()->role !== $role) {
            abort(403, 'Nemate dozvolu za pristup ovoj stranici.');
        }

        return $next($request);
    }
}
