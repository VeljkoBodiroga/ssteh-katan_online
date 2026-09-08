<nav class="navbar">
    <div class="navbar-left">
        @if (!request()->is('/'))
            <a href="{{ route('home') }}">
                <img src="{{ asset('images/home.png') }}" alt="Home" class="home-icon">
            </a>
        @endif
        <h1>Settlers of CATAN</h1>
    </div>

    <div class="navbar-center">
        @if (!request()->is('/'))
            <a href="{{ route('rules') }}">Pravila igre</a>
            @auth
                <a href="{{ route('play') }}">Igraj</a>
            @endauth
            <a href="{{ route('expansions.index') }}">Ekspanzije</a>
        @endif
    </div>

    <div class="navbar-right">
        @guest
            <a href="{{ route('login') }}" class="nav-btn login-btn">Login</a>
        @else
            <div class="user-section">
                <form action="{{ route('logout') }}" method="POST" style="display:inline;">
                    @csrf
                    <button type="submit" class="logout-btn">Logout</button>
                </form>
                @if (auth()->user()->isAdmin())
                    <a href="{{ route('expansions.create') }}" class="user-btn">⚙️ Admin</a>
                @endif
                <a href="{{ route('stats') }}" class="user-btn">
                    <span class="user-icon">👤</span>
                    <span class="username">{{ auth()->user()->username }}</span>
                </a>
            </div>
        @endguest
    </div>
</nav>
