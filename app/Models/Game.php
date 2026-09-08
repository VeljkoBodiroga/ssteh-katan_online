<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Game extends Model
{
    protected $fillable = ['created_by', 'status', 'board_state', 'log', 'started_at', 'finished_at'];

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
}
