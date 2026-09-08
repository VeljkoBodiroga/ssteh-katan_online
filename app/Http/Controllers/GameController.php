<?php

namespace App\Http\Controllers;

class GameController extends Controller
{
    public function play()
    {
        return view('game.play');
    }
}
