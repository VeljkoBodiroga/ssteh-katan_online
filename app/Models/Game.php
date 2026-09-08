<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Game extends Model
{
    protected $fillable = ['created_by', 'lobby_code', 'status', 'max_players', 'board_state', 'log', 'started_at', 'finished_at'];

    public const STATUSES = ['lobby', 'setup', 'in_progress', 'finished'];

    protected $casts = [
        'board_state' => 'array',
        'log' => 'array',
        'started_at' => 'datetime',
        'finished_at' => 'datetime',
    ];

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function players()
    {
        return $this->belongsToMany(User::class, 'game_players')
            ->withPivot(['resources', 'fields', 'points'])
            ->withTimestamps();
    }

    public function isFull(): bool
    {
        return $this->players()->count() >= $this->max_players;
    }

    public static function generateLobbyCode(): string
    {
        do {
            $code = strtoupper(\Illuminate\Support\Str::random(6));
        } while (self::where('lobby_code', $code)->exists());

        return $code;
    }
}