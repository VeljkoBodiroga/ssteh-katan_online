@if ($paginator->hasPages())
    <nav class="simple-pagination">
        @if ($paginator->onFirstPage())
            <span class="page-btn disabled">&laquo; Prethodna</span>
        @else
            <a href="{{ $paginator->previousPageUrl() }}" class="page-btn">&laquo; Prethodna</a>
        @endif

        <div class="page-numbers">
            @for ($i = 1; $i <= $paginator->lastPage(); $i++)
                @if ($i == $paginator->currentPage())
                    <span class="page-number active">{{ $i }}</span>
                @else
                    <a href="{{ $paginator->url($i) }}" class="page-number">{{ $i }}</a>
                @endif
            @endfor
        </div>

        @if ($paginator->hasMorePages())
            <a href="{{ $paginator->nextPageUrl() }}" class="page-btn">Sledeća &raquo;</a>
        @else
            <span class="page-btn disabled">Sledeća &raquo;</span>
        @endif
    </nav>
@endif