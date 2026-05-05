const API_KEY = '52b5b50d2761bc6f0a61091bc7326848';
const BASE_URL = 'https://api.themoviedb.org/3';
const IMG_URL = 'https://image.tmdb.org/t/p/w500';
const BACKDROP_URL = 'https://image.tmdb.org/t/p/original';

const categories = [
    { id: 'top10', title: 'TOP 10 Today', url: `/trending/all/day?api_key=${API_KEY}`, isTop10: true },
    { id: 'trending_movies', title: 'Trending Movies', url: `/trending/movie/week?api_key=${API_KEY}`, isTop10: false },
    { id: 'trending_tv', title: 'Trending TV Shows', url: `/trending/tv/week?api_key=${API_KEY}`, isTop10: false },
    { id: 'netflix', title: 'Only on Netflix', url: `/discover/tv?api_key=${API_KEY}&with_networks=213`, isTop10: false },
    { id: 'prime', title: 'Amazon Prime Originals', url: `/discover/tv?api_key=${API_KEY}&with_networks=1024`, isTop10: false },
    { id: 'disney', title: 'Disney+ Exclusives', url: `/discover/tv?api_key=${API_KEY}&with_networks=2739`, isTop10: false },
    { id: 'action', title: 'Action & Adventure', url: `/discover/movie?api_key=${API_KEY}&with_genres=28,12`, isTop10: false },
    { id: 'comedy', title: 'Comedy Mix', url: `/discover/movie?api_key=${API_KEY}&with_genres=35`, isTop10: false },
    { id: 'horror', title: 'Horror & Thrillers', url: `/discover/movie?api_key=${API_KEY}&with_genres=27,53`, isTop10: false },
    { id: 'kdrama_anime', title: 'K-Drama & Anime', url: `/discover/tv?api_key=${API_KEY}&with_original_language=ko|ja`, isTop10: false },
    { id: 'new_arrivals', title: 'New Arrivals', url: `/movie/now_playing?api_key=${API_KEY}`, isTop10: false },
    { id: 'top_rated', title: 'IMDb Top Rated', url: `/movie/top_rated?api_key=${API_KEY}`, isTop10: false }
];

let isMuted = true;
let currentTvId = null;
let currentImdbId = null;
let currentPlaySeason = null;
let currentPlayEpisode = null;
let availablePlaySeasons = [];
let currentPage = 1;
let currentFetchUrl = '';
let isLoading = false;
const CONTINUE_STORAGE_KEY = 'filmoContinueWatching';
const CONTINUE_STORAGE_LIMIT = 8;

function getContinueWatchingItems() {
    try {
        const raw = localStorage.getItem(CONTINUE_STORAGE_KEY);
        const items = raw ? JSON.parse(raw) : [];
        return Array.isArray(items) ? items.filter(Boolean) : [];
    } catch (error) {
        return [];
    }
}

function buildContinueKey(item) {
    return [item.type || 'unknown', item.tmdbId || item.id || '', item.imdbId || '', item.season || '', item.episode || ''].join(':');
}

function buildContinueSeriesKey(item) {
    if (!item) return 'unknown';

    const identity = item.tmdbId || item.imdbId || item.id || '';
    if (item.type === 'tv') {
        return ['tv', identity].join(':');
    }

    return buildContinueKey(item);
}

function saveContinueWatchingItem(item) {
    if (!item || !item.type) return;

    const key = item.key || buildContinueKey(item);
    const seriesKey = item.seriesKey || buildContinueSeriesKey(item);
    const normalized = {
        ...item,
        key,
        seriesKey,
        watchedAt: item.watchedAt || Date.now()
    };

    const existingItems = getContinueWatchingItems().filter(entry => (entry.seriesKey || buildContinueSeriesKey(entry)) !== seriesKey);
    existingItems.unshift(normalized);
    localStorage.setItem(CONTINUE_STORAGE_KEY, JSON.stringify(existingItems.slice(0, CONTINUE_STORAGE_LIMIT)));
}

window.removeContinueWatchingItem = function(seriesKey, element) {
    if (!seriesKey) return;
    const existingItems = getContinueWatchingItems();
    const updatedItems = existingItems.filter(item => (item.seriesKey || buildContinueSeriesKey(item)) !== seriesKey);
    localStorage.setItem(CONTINUE_STORAGE_KEY, JSON.stringify(updatedItems));
    
    const card = element.closest('.resume-card');
    if (card) {
        card.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        card.style.opacity = '0';
        card.style.transform = 'scale(0.95)';
        setTimeout(() => {
            card.remove();
            const row = document.querySelector('.continue-row');
            if (row && row.hasChildNodes() && row.children.length === 0) {
                row.closest('.continue-section')?.remove();
            }
        }, 300);
    }
}

window.scrollRow = function(e, btn, direction) {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    const wrapper = btn.closest('.scroll-wrapper');
    if (wrapper) {
        const container = wrapper.querySelector('.row-posters, .cast-list');
        if (container) {
            const scrollAmount = container.clientWidth * 0.75;
            container.scrollBy({ left: scrollAmount * direction, behavior: 'smooth' });
        }
    }
}

function formatLastWatched(timestamp) {
    if (!timestamp) return 'Recently watched';

    const elapsed = Date.now() - timestamp;
    const minute = 60 * 1000;
    const hour = 60 * minute;
    const day = 24 * hour;

    if (elapsed < minute) return 'Just now';
    if (elapsed < hour) return `${Math.max(1, Math.round(elapsed / minute))}m ago`;
    if (elapsed < day) return `${Math.max(1, Math.round(elapsed / hour))}h ago`;
    return `${Math.max(1, Math.round(elapsed / day))}d ago`;
}

function getContinueTitle(item) {
    return item.title || item.name || 'Untitled';
}

function getContinueSubtitle(item) {
    if (item.type === 'tv') {
        const season = item.season ? `Season ${item.season}` : 'TV Show';
        const episode = item.episode ? `Episode ${item.episode}` : '';
        return [season, episode].filter(Boolean).join(' • ');
    }

    return 'Movie';
}

function getContinuePlayUrl(item) {
    if (item.playUrl) return item.playUrl;

    if (item.type === 'tv' && item.tmdbId && item.imdbId && item.season && item.episode) {
        return `play.html?id=${item.tmdbId}&imdb=${item.imdbId}&type=tv&s=${item.season}&e=${item.episode}`;
    }

    if (item.type === 'movie' && item.imdbId) {
        return `play.html?imdb=${item.imdbId}&type=movie`;
    }

    return item.detailsUrl || '#';
}

function getContinueRestartUrl(item) {
    if (item.type === 'tv' && item.tmdbId && item.imdbId) {
        return `play.html?id=${item.tmdbId}&imdb=${item.imdbId}&type=tv&s=1&e=1`;
    }

    return item.detailsUrl || getContinuePlayUrl(item);
}

async function hydrateContinueWatchingItem(item) {
    if (item.title && item.posterPath && item.tmdbId) {
        return item;
    }

    if (!item.imdbId) {
        return item;
    }

    try {
        const res = await fetch(`${BASE_URL}/find/${item.imdbId}?api_key=${API_KEY}&external_source=imdb_id`);
        const data = await res.json();
        const result = item.type === 'tv' ? data.tv_results?.[0] : data.movie_results?.[0];

        if (result) {
            item.title = item.title || result.name || result.title;
            item.posterPath = item.posterPath || result.poster_path || '';
            item.backdropPath = item.backdropPath || result.backdrop_path || '';
            item.tmdbId = item.tmdbId || result.id || '';
            if (!item.detailsUrl && item.tmdbId) {
                item.detailsUrl = `details.html?id=${item.tmdbId}&type=${item.type}`;
            }
        }
    } catch (error) {
        console.error('Unable to hydrate continue watching item', error);
    }

    return item;
}

async function renderContinueWatchingSection(container) {
    if (!container) {
        console.error('Continue Watching ERROR: container is null or undefined');
        return;
    }

    const items = getContinueWatchingItems();
    console.log('Continue Watching DEBUG: Total items in storage:', items.length, items);
    
    if (!items.length) {
        console.log('Continue Watching: No items stored yet');
        return;
    }

    const dedupedItems = [];
    const seenSeries = new Set();

    items.forEach(item => {
        const seriesKey = item.seriesKey || buildContinueSeriesKey(item);
        if (seenSeries.has(seriesKey)) return;
        seenSeries.add(seriesKey);
        dedupedItems.push(item);
    });

    console.log('Deduped items:', dedupedItems.length);

    const hydratedItems = await Promise.all(dedupedItems.slice(0, 4).map(item => hydrateContinueWatchingItem({ ...item })));
    const visibleItems = hydratedItems.filter(item => item.title || item.posterPath || item.playUrl);

    console.log('Visible items after hydration:', visibleItems.length);

    if (!visibleItems.length) {
        console.log('No visible items - stopping render');
        return;
    }

    const section = document.createElement('section');
    section.className = 'movie-row continue-section';
    section.innerHTML = `
        <div class="section-header">
            <div>
                <h2>Continue Watching</h2>
                <p class="section-note">Pick up where you left off across movies and TV shows.</p>
            </div>
        </div>
        <div class="scroll-wrapper">
        <button class="scroll-arrow left-arrow" onclick="scrollRow(event, this, -1)"><i class="fas fa-chevron-left"></i></button>
            <div class="row-posters continue-row"></div>
        <button class="scroll-arrow right-arrow" onclick="scrollRow(event, this, 1)"><i class="fas fa-chevron-right"></i></button>
        </div>
    `;

    const row = section.querySelector('.continue-row');
    visibleItems.forEach(item => {
        const poster = item.posterPath ? `${IMG_URL + item.posterPath}` : 'https://via.placeholder.com/300x450?text=No+Image';
        const playUrl = getContinuePlayUrl(item);
        const restartUrl = getContinueRestartUrl(item);
        const badgeText = item.type === 'tv' ? 'TV' : 'Movie';
        const subtitle = getContinueSubtitle(item);
        const watchedText = formatLastWatched(item.watchedAt);

        row.insertAdjacentHTML('beforeend', `
            <article class="resume-card">
                <a class="resume-poster" href="${playUrl}">
                    <img src="${poster}" alt="${getContinueTitle(item)}" loading="lazy">
                    <span class="resume-badge">${badgeText}</span>
                </a>
                <div class="resume-copy">
                    <p class="resume-kicker">Continue watching</p>
                    <h3 class="resume-title">${getContinueTitle(item)}</h3>
                    <p class="resume-meta">${subtitle} • ${watchedText}</p>
                    <div class="resume-actions">
                        <a href="${playUrl}" class="resume-btn primary"><i class="fas fa-play"></i> Continue</a>
                        <a href="${restartUrl}" class="resume-btn secondary"><i class="fas fa-rotate-left"></i> Restart</a>
                        <button onclick="removeContinueWatchingItem('${item.seriesKey}', this)" class="resume-btn tertiary" title="Remove from list"><i class="fas fa-times"></i> Remove</button>
                    </div>
                </div>
            </article>
        `);
    });

    console.log('Continue Watching DEBUG: About to insert section with', visibleItems.length, 'items');
    container.insertAdjacentElement('afterbegin', section);
    console.log('✓ Continue Watching section inserted successfully');
}

window.saveContinueWatchingFromPlayback = async function(payload) {
    if (!payload || !payload.type) return;

    const item = {
        type: payload.type,
        tmdbId: payload.tmdbId || payload.id || '',
        imdbId: payload.imdbId || payload.imdb || '',
        season: payload.season || '',
        episode: payload.episode || '',
        title: payload.title || '',
        posterPath: payload.posterPath || '',
        backdropPath: payload.backdropPath || '',
        playUrl: payload.playUrl || window.location.href,
        detailsUrl: payload.detailsUrl || '',
        watchedAt: Date.now()
    };

    if ((!item.title || !item.posterPath || !item.tmdbId) && item.imdbId) {
        try {
            const res = await fetch(`${BASE_URL}/find/${item.imdbId}?api_key=${API_KEY}&external_source=imdb_id`);
            const data = await res.json();
            const result = item.type === 'tv' ? data.tv_results?.[0] : data.movie_results?.[0];

            if (result) {
                item.title = item.title || result.name || result.title || '';
                item.posterPath = item.posterPath || result.poster_path || '';
                item.backdropPath = item.backdropPath || result.backdrop_path || '';
                item.tmdbId = item.tmdbId || result.id || '';
                if (!item.detailsUrl && item.tmdbId) {
                    item.detailsUrl = `details.html?id=${item.tmdbId}&type=${item.type}`;
                }
            }
        } catch (error) {
            console.error('Unable to look up playback metadata', error);
        }
    }

    saveContinueWatchingItem(item);
};

window.addEventListener('DOMContentLoaded', () => {
    const nav = document.getElementById('navbar');
    if(nav) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 50) nav.classList.add('scrolled');
            else nav.classList.remove('scrolled');
        });
    }

    if (document.getElementById('browseGrid')) {
        initBrowse(); 
    } else if (document.getElementById('mainContent') && !window.location.pathname.includes('details.html') && !window.location.pathname.includes('play.html')) {
        loadHomePage(); 
    }

    /* ================= පරණ SEARCH එකමයි ================= */
    const searchInput = document.getElementById('searchInput');
    if(searchInput) {
        const mobileSearchBtn = document.getElementById('mobileSearchBtn');
        const searchContainer = document.querySelector('.search-container');
        
        if (mobileSearchBtn && searchContainer) {
            mobileSearchBtn.addEventListener('click', (e) => {
                e.preventDefault();
                searchContainer.classList.toggle('active');
                if (searchContainer.classList.contains('active')) {
                    searchInput.focus();
                }
            });
        }

        const suggestionsBox = document.getElementById('searchSuggestions');
        searchInput.addEventListener('input', async (e) => {
            const query = e.target.value;
            if (query.length < 2) { suggestionsBox.style.display = 'none'; return; }
            try {
                const res = await fetch(`${BASE_URL}/search/multi?api_key=${API_KEY}&query=${encodeURIComponent(query)}`);
                const data = await res.json();
                suggestionsBox.innerHTML = '';
                if (data.results.length > 0) {
                    suggestionsBox.style.display = 'block';
                    data.results.slice(0, 8).forEach(item => {
                        if(item.media_type === 'person' || !item.poster_path) return;
                        const type = item.media_type || 'movie';
                        suggestionsBox.insertAdjacentHTML('beforeend', `
                            <a href="details.html?id=${item.id}&type=${type}" class="suggestion-item">
                                <img src="${IMG_URL + item.poster_path}">
                                <div><div style="font-weight: 500;">${item.title || item.name}</div>
                                <div style="font-size: 11px; color: var(--text-mid); margin-top: 4px;">${type.toUpperCase()} • ${(item.release_date || item.first_air_date || '').split('-')[0]}</div>
                                </div>
                            </a>`);
                    });
                }
            } catch(e) { console.error("Search err", e); }
        });
        document.addEventListener('click', (e) => {
            if (!searchInput.contains(e.target) && !suggestionsBox.contains(e.target)) {
                suggestionsBox.style.display = 'none';
            }

            // Mobile Search bar එකෙන් පිට click කරාම Auto Close වෙන්න
            if (window.innerWidth <= 768 && searchContainer && searchContainer.classList.contains('active')) {
                if (!searchContainer.contains(e.target) && (!mobileSearchBtn || !mobileSearchBtn.contains(e.target))) {
                    searchContainer.classList.remove('active');
                    suggestionsBox.style.display = 'none';
                }
            }
        });
    }
});

let heroSlides = [];
let currentHeroIndex = 0;
let heroSlideInterval = null;
let isTrailerPlaying = false;

async function loadHomePage() {
    try {
        const res = await fetch(BASE_URL + categories[0].url);
        const data = await res.json();
        
        // Get top 5 valid movies for the slider
        heroSlides = data.results.filter(m => m.backdrop_path && m.overview).slice(0, 5);
        
        if (heroSlides.length > 0) {
            buildHeroIndicators();
            showHeroSlide(0);
            startHeroSlider();
        }

        const mainContent = document.getElementById('mainContent');
        if(mainContent) {
            await renderContinueWatchingSection(mainContent);
            categories.forEach(cat => {
                mainContent.insertAdjacentHTML('beforeend', `
                    <div class="movie-row">
                        <h2>${cat.title}</h2>
                        <div class="scroll-wrapper">
                        <button class="scroll-arrow left-arrow" onclick="scrollRow(event, this, -1)"><i class="fas fa-chevron-left"></i></button>
                            <div class="row-posters" id="${cat.id}"></div>
                        <button class="scroll-arrow right-arrow" onclick="scrollRow(event, this, 1)"><i class="fas fa-chevron-right"></i></button>
                        </div>
                    </div>`);
                fetchAndBuildRow(cat.id, cat.url, cat.isTop10);
            });
        }
    } catch (error) { console.error("Home page error:", error); }
}

function buildHeroIndicators() {
    const container = document.getElementById('heroIndicators');
    if(!container) return;
    container.innerHTML = '';
    heroSlides.forEach((_, i) => {
        container.insertAdjacentHTML('beforeend', `<div class="indicator" onclick="goToHeroSlide(${i})"></div>`);
    });
}

function showHeroSlide(index) {
    currentHeroIndex = index;
    const movie = heroSlides[index];
    if (!movie) return;

    const title = movie.title || movie.name;
    const year = (movie.release_date || movie.first_air_date || '').split('-')[0];
    const type = movie.media_type === 'tv' ? 'TV Show' : 'Movie';

    // Re-trigger animation
    const content = document.querySelector('.hero-content');
    if(content) {
        content.style.animation = 'none';
        void content.offsetWidth; // trigger reflow
        content.style.animation = 'slideUp 0.8s ease-out';
    }

    const heroTitle = document.getElementById('heroTitle');
    if(heroTitle) heroTitle.innerText = title;
    const heroDesc = document.getElementById('heroDesc');
    if(heroDesc) heroDesc.innerText = movie.overview.substring(0, 180) + "...";
    const heroMeta = document.getElementById('heroMeta');
    if(heroMeta) {
        heroMeta.innerHTML = `<span class="rating"><i class="fas fa-star"></i> ${movie.vote_average.toFixed(1)}</span><span>•</span><span>${year}</span><span>•</span><span>${type}</span>`;
    }
    
    const heroVideoContainer = document.getElementById('heroVideoContainer');
    if(heroVideoContainer) {
        heroVideoContainer.innerHTML = ''; // clear iframe so trailer stops
        heroVideoContainer.style.backgroundImage = `url(${BACKDROP_URL + movie.backdrop_path})`;
    }
    
    const playBtn = document.getElementById('heroPlayBtn');
    if(playBtn) playBtn.href = `details.html?id=${movie.id}&type=${movie.media_type || 'movie'}&play=true`;
    const infoBtn = document.getElementById('heroInfoBtn');
    if(infoBtn) infoBtn.onclick = () => { window.location.href = `details.html?id=${movie.id}&type=${movie.media_type || 'movie'}`; };

    // Update indicators
    document.querySelectorAll('#heroIndicators .indicator').forEach((ind, i) => {
        if(i === index) ind.classList.add('active');
        else ind.classList.remove('active');
    });

    isTrailerPlaying = false;
    const trailerPlayBtn = document.getElementById('trailerPlayBtn');
    if(trailerPlayBtn) trailerPlayBtn.innerHTML = '<i class="fas fa-play"></i>';
    const muteBtn = document.getElementById('muteBtn');
    if(muteBtn) muteBtn.style.display = 'none';
}

function startHeroSlider() {
    stopHeroSlider();
    heroSlideInterval = setInterval(() => {
        let nextIndex = (currentHeroIndex + 1) % heroSlides.length;
        showHeroSlide(nextIndex);
    }, 6000);
}

function stopHeroSlider() {
    if(heroSlideInterval) clearInterval(heroSlideInterval);
    heroSlideInterval = null;
}

window.goToHeroSlide = function(index) {
    showHeroSlide(index);
    startHeroSlider();
}

window.toggleHeroTrailer = function() {
    if(isTrailerPlaying) {
        showHeroSlide(currentHeroIndex); 
        startHeroSlider();
    } else {
        stopHeroSlider();
        const movie = heroSlides[currentHeroIndex];
        if(movie) loadTrailer(movie.id, movie.media_type || 'movie');
    }
}

async function fetchAndBuildRow(rowId, fetchUrl, isTop10) {
    try {
        const res = await fetch(BASE_URL + fetchUrl);
        const data = await res.json();
        const row = document.getElementById(rowId);
        if(!row) return;
        let count = 0;
        data.results.forEach((item, index) => {
            if (item.poster_path && count < 20) {
                const type = item.media_type || (fetchUrl.includes('/tv') ? 'tv' : 'movie');
                let topBadge = isTop10 && index < 10 ? `<div class="top-badge"><span class="top-text">Top</span><span class="top-num">${String(index+1).padStart(2,'0')}</span></div>` : '';
                const mediaBadge = `<div class="media-badge">${type === 'tv' ? 'TV' : 'Movie'}</div>`;
                row.insertAdjacentHTML('beforeend', `
                    <a href="details.html?id=${item.id}&type=${type}" class="movie-card">
                    <div class="card-img-container">${topBadge}${mediaBadge}<img src="${IMG_URL + item.poster_path}" loading="lazy"></div>
                    <h3 class="card-title">${item.title || item.name}</h3>
                    <div class="card-meta">
                    <span class="rating"><i class="fas fa-star"></i> ${item.vote_average.toFixed(1)}</span>
                    <span>•</span><span>${(item.release_date || item.first_air_date || '').split('-')[0]}</span>
                    </div></a>`);
                count++;
            }
        });
    } catch(err) { console.error("Row error:", err); }
}

window.loadFullDetails = async function(id, type, shouldPlay) {
    try {
        const res = await fetch(`${BASE_URL}/${type}/${id}?api_key=${API_KEY}&append_to_response=credits,external_ids,similar,recommendations,videos,images,keywords`);
        const data = await res.json();
        
        document.getElementById('heroTitle').innerText = data.title || data.name;
        
        const taglineEl = document.getElementById('heroTagline');
        if(taglineEl) {
            taglineEl.innerText = data.tagline ? `"${data.tagline}"` : '';
            taglineEl.style.display = data.tagline ? 'block' : 'none';
        }
        
        document.getElementById('heroDesc').innerText = data.overview;
        
        const runtime = data.runtime || (data.episode_run_time && data.episode_run_time[0]) || 0;
        const runtimeStr = runtime ? `${Math.floor(runtime/60)}h ${runtime%60}m` : 'N/A';
        const adultBadge = data.adult ? '<span class="adult-badge">18+</span>' : '';
        const year = (data.release_date || data.first_air_date || '').split('-')[0];

        document.getElementById('heroMeta').innerHTML = `
            ${adultBadge}
            <span class="rating"><i class="fas fa-star"></i> ${data.vote_average.toFixed(1)}</span>
            <span>•</span><span>${year}</span>
            <span>•</span><span>${runtimeStr}</span>
            <span>•</span><span>${data.genres.map(g => g.name).join(', ')}</span>`;
            
        document.getElementById('heroVideoContainer').style.backgroundImage = `url(${BACKDROP_URL + data.backdrop_path})`;
        loadTrailer(id, type);
        
        const grid = document.getElementById('fullDetailsGrid');
        if(grid) {
            let tickerContent = '';
            tickerContent += `<div class="detail-item"><span class="detail-label">Status:</span><span class="detail-val">${data.status || 'N/A'}</span></div>`;
            tickerContent += `<div class="detail-item"><span class="detail-label">Original Title:</span><span class="detail-val">${data.original_title || data.original_name || 'N/A'}</span></div>`;
            tickerContent += `<div class="detail-item"><span class="detail-label">Language:</span><span class="detail-val">${(data.original_language || 'EN').toUpperCase()}</span></div>`;
            
            if(type === 'movie') {
                tickerContent += `<div class="detail-item"><span class="detail-label">Budget:</span><span class="detail-val">${data.budget ? '$'+data.budget.toLocaleString() : 'N/A'}</span></div>`;
                tickerContent += `<div class="detail-item"><span class="detail-label">Revenue:</span><span class="detail-val">${data.revenue ? '$'+data.revenue.toLocaleString() : 'N/A'}</span></div>`;
            }
            
            tickerContent += `<div class="detail-item"><span class="detail-label">Countries:</span><span class="detail-val">${data.production_countries?.map(c => c.name).join(', ') || 'N/A'}</span></div>`;

            if(type === 'tv') {
                const networks = data.networks?.map(n => n.name).join(', ') || 'N/A';
                const nextEp = data.next_episode_to_air ? data.next_episode_to_air.air_date : 'Ended';
                tickerContent += `<div class="detail-item"><span class="detail-label">Networks:</span><span class="detail-val">${networks}</span></div>`;
                tickerContent += `<div class="detail-item"><span class="detail-label">Seasons:</span><span class="detail-val">${data.number_of_seasons || 0}</span></div>`;
                tickerContent += `<div class="detail-item"><span class="detail-label">Episodes:</span><span class="detail-val">${data.number_of_episodes || 0}</span></div>`;
                tickerContent += `<div class="detail-item"><span class="detail-label">Next Ep:</span><span class="detail-val">${nextEp}</span></div>`;
            }

            if(data.credits && data.credits.crew) {
                const directors = data.credits.crew.filter(c => c.job === 'Director').slice(0,2);
                const writers = data.credits.crew.filter(c => c.job === 'Writer' || c.job === 'Screenplay').slice(0,3);
                const composers = data.credits.crew.filter(c => c.job === 'Original Music Composer').slice(0,2);
                
                if(directors.length) tickerContent += `<div class="detail-item"><span class="detail-label">Director:</span><span class="detail-val">${directors.map(c=>c.name).join(', ')}</span></div>`;
                if(writers.length) tickerContent += `<div class="detail-item"><span class="detail-label">Writer:</span><span class="detail-val">${writers.map(c=>c.name).join(', ')}</span></div>`;
                if(composers.length) tickerContent += `<div class="detail-item"><span class="detail-label">Composer:</span><span class="detail-val">${composers.map(c=>c.name).join(', ')}</span></div>`;
            }

            grid.innerHTML = `
                <div class="marquee-wrapper">
                    <div class="marquee-track">${tickerContent}</div>
                    <div class="marquee-track">${tickerContent}</div>
                    <div class="marquee-track">${tickerContent}</div>
                    <div class="marquee-track">${tickerContent}</div>
                </div>
            `;
        }

        const tvInfoSection = document.getElementById('tvInfoSection');
        if(tvInfoSection) tvInfoSection.style.display = 'none';

        const crewSection = document.getElementById('crewSection');
        if(crewSection) crewSection.style.display = 'none';

        const mediaGallery = document.getElementById('mediaGallerySection');
        if(mediaGallery && ((data.images?.backdrops?.length > 0) || (data.videos?.results?.length > 0))) {
            let mediaHtml = `<h2>Media & Gallery</h2><div class="scroll-wrapper"><button class="scroll-arrow left-arrow" onclick="scrollRow(event, this, -1)"><i class="fas fa-chevron-left"></i></button><div class="row-posters" style="gap: 15px;">`;
            if(data.videos?.results) {
                data.videos.results.filter(v => v.site === 'YouTube').slice(0, 6).forEach(vid => {
                    mediaHtml += `<div class="gallery-item" onclick="openLightbox('video', '${vid.key}')"><img src="https://img.youtube.com/vi/${vid.key}/hqdefault.jpg" loading="lazy"><div class="gallery-play"><i class="fas fa-play-circle"></i></div></div>`;
                });
            }
            if(data.images?.backdrops) {
                data.images.backdrops.slice(0, 10).forEach(img => {
                    const highResImg = BACKDROP_URL + img.file_path;
                    mediaHtml += `<div class="gallery-item" onclick="openLightbox('image', '${highResImg}')"><img src="${IMG_URL + img.file_path}" loading="lazy"></div>`;
                });
            }
            mediaHtml += `</div><button class="scroll-arrow right-arrow" onclick="scrollRow(event, this, 1)"><i class="fas fa-chevron-right"></i></button></div>`;
            mediaGallery.innerHTML = mediaHtml;
            mediaGallery.style.display = 'block';
        }

        const prodSection = document.getElementById('productionSection');
        if(prodSection) {
            let prodHtml = `<h2>Production & Tags</h2>`;
            let hasContent = false;
            if(data.production_companies?.length > 0) {
                hasContent = true;
                prodHtml += `<div class="company-logos">`;
                data.production_companies.forEach(comp => {
                    if(comp.logo_path) prodHtml += `<img src="${IMG_URL + comp.logo_path}" class="company-logo" title="${comp.name}" loading="lazy">`;
                    else prodHtml += `<span style="color: #333; font-weight: 800; font-size: 14px; text-transform: uppercase;">${comp.name}</span>`;
                });
                prodHtml += `</div>`;
            }
            const keywords = data.keywords?.keywords || data.keywords?.results || [];
            if(keywords.length > 0) {
                hasContent = true;
                prodHtml += `<div class="keywords-container">`;
                keywords.slice(0, 20).forEach(kw => {
                    prodHtml += `<span class="keyword-tag">#${kw.name}</span>`;
                });
                prodHtml += `</div>`;
            }
            if(hasContent) {
                prodSection.innerHTML = prodHtml;
                prodSection.style.display = 'block';
            }
        }
        
        const castList = document.getElementById('castList');
        if(data.credits && data.credits.cast && castList) {
            data.credits.cast.slice(0, 10).forEach(actor => {
                const img = actor.profile_path ? IMG_URL + actor.profile_path : 'https://via.placeholder.com/50';
                castList.insertAdjacentHTML('beforeend', `
                    <div class="cast-card">
                    <img src="${img}" class="cast-img">
                    <div class="cast-info">
                    <span class="cast-name">${actor.name}</span>
                    <span class="cast-role">${actor.character}</span>
                    </div></div>`);
            });
        }
        
        currentImdbId = data.external_ids?.imdb_id;
        
        const playSection = document.getElementById('moviePlaySection');
        const playBtn = document.getElementById('finalPlayLink');

        if (type === 'movie') {
            if (currentImdbId && playSection && playBtn) {
                const detailsUrl = `details.html?id=${id}&type=movie`;
                const playUrl = `play.html?imdb=${currentImdbId}&type=movie&id=${id}&detailsUrl=${encodeURIComponent(detailsUrl)}`;
                playBtn.href = playUrl;
                playBtn.onclick = null; // කලින් දීපු click ඉවෙන්ට් අයින් කරන්න
                playBtn.removeAttribute('target');
                playSection.style.display = 'block';
                playBtn.style.display = 'inline-flex';
                if(shouldPlay === 'true') window.location.href = playUrl;
            }
        } else if (type === 'tv') {
            currentTvId = id;
            const tvSection = document.getElementById('tvShowSection');
            if(tvSection) tvSection.style.display = 'block';
            const select = document.getElementById('seasonSelect');
            if(select && data.seasons) {
                data.seasons.filter(s => s.season_number > 0).forEach(s => {
                    select.insertAdjacentHTML('beforeend', `<option value="${s.season_number}">${s.name}</option>`);
                });
                changeSeason();
            }
            
            // TV Show එකක් සඳහා Watch Now බොත්තම සකසන ආකාරය
            if (playSection && playBtn) {
                playBtn.href = '#tvShowSection';
                playBtn.onclick = (e) => {
                    e.preventDefault();
                    const targetSection = document.getElementById('tvShowSection');
                    if(targetSection) {
                        const yOffset = -100; // Navbar එකට යට නොවී ලස්සනට පේන්න
                        const y = targetSection.getBoundingClientRect().top + window.scrollY + yOffset;
                        window.scrollTo({top: y, behavior: 'smooth'});
                    }
                };
                playBtn.removeAttribute('target');
                playSection.style.display = 'block';
                playBtn.style.display = 'inline-flex';
                
                // Home page එකේ Play එක click කරලා ආවනම් ඔටෝම පහලට යන්න
                if(shouldPlay === 'true') {
                    setTimeout(() => playBtn.click(), 500);
                }
            }
        }
        
        const similarSection = document.getElementById('similarContent');
        if(similarSection) {
            if(data.similar?.results.length > 0) {
                similarSection.insertAdjacentHTML('beforeend', `
                    <div class="movie-row">
                        <h2>Similar Titles</h2>
                        <div class="scroll-wrapper">
                            <button class="scroll-arrow left-arrow" onclick="scrollRow(event, this, -1)"><i class="fas fa-chevron-left"></i></button>
                            <div class="row-posters" id="simRow"></div>
                            <button class="scroll-arrow right-arrow" onclick="scrollRow(event, this, 1)"><i class="fas fa-chevron-right"></i></button>
                        </div>
                    </div>`);
                buildSimpleRow('simRow', data.similar.results, type);
            } else if(data.recommendations?.results.length > 0) {
                similarSection.insertAdjacentHTML('beforeend', `
                    <div class="movie-row">
                        <h2>Recommended For You</h2>
                        <div class="scroll-wrapper">
                        <button class="scroll-arrow left-arrow" onclick="scrollRow(event, this, -1)"><i class="fas fa-chevron-left"></i></button>
                            <div class="row-posters" id="recRow"></div>
                        <button class="scroll-arrow right-arrow" onclick="scrollRow(event, this, 1)"><i class="fas fa-chevron-right"></i></button>
                        </div>
                    </div>`);
                buildSimpleRow('recRow', data.recommendations.results, type);
            }
        }

        loadExtraDetailRows();
    } catch (error) { console.error(error); }
}

window.openLightbox = function(type, source) {
    const modal = document.getElementById('mediaLightbox');
    const body = document.getElementById('lightboxBody');
    if (!modal || !body) return;
    if (type === 'video') {
        body.innerHTML = `<iframe src="https://www.youtube.com/embed/${source}?autoplay=1&rel=0&modestbranding=1" allow="autoplay; fullscreen" allowfullscreen></iframe>`;
    } else if (type === 'image') {
        body.innerHTML = `<img src="${source}" alt="Gallery Image">`;
    }
    modal.classList.add('active');
    document.body.style.overflow = 'hidden'; 
}

window.closeLightbox = function(e) {
    if (e && !e.target.classList.contains('lightbox-overlay') && !e.target.closest('.lightbox-close')) return;
    const modal = document.getElementById('mediaLightbox');
    const body = document.getElementById('lightboxBody');
    if (modal && body) { modal.classList.remove('active'); body.innerHTML = ''; document.body.style.overflow = ''; }
}

function buildSimpleRow(rowId, items, type) {
    const row = document.getElementById(rowId);
    if(!row) return;
    items.slice(0, 15).forEach(item => {
        if(item.poster_path) {
            const mediaBadge = `<div class="media-badge">${type === 'tv' ? 'TV' : 'Movie'}</div>`;
            row.insertAdjacentHTML('beforeend', `
                <a href="details.html?id=${item.id}&type=${type}" class="movie-card">
                <div class="card-img-container">${mediaBadge}<img src="${IMG_URL + item.poster_path}" loading="lazy"></div>
                <h3 class="card-title">${item.title || item.name}</h3></a>`);
        }
    });
}

function loadExtraDetailRows() {
    const extraRowsContainer = document.getElementById('extraContentRows');
    if (!extraRowsContainer) return;

    const desiredCategoryIds = ['top10', 'trending_movies', 'trending_tv', 'top_rated', 'new_arrivals'];
    const categoriesToShow = categories.filter(cat => desiredCategoryIds.includes(cat.id));

    categoriesToShow.forEach(cat => {
        const rowId = `extra_${cat.id}`;
        extraRowsContainer.insertAdjacentHTML('beforeend', `
            <div class="movie-row">
                <h2>${cat.title}</h2>
                <div class="scroll-wrapper">
                    <button class="scroll-arrow left-arrow" onclick="scrollRow(event, this, -1)"><i class="fas fa-chevron-left"></i></button>
                    <div class="row-posters" id="${rowId}"></div>
                    <button class="scroll-arrow right-arrow" onclick="scrollRow(event, this, 1)"><i class="fas fa-chevron-right"></i></button>
                </div>
            </div>`);
        fetchAndBuildRow(rowId, cat.url, cat.isTop10);
    });
}

window.changeSeason = async function() {
    const sNum = document.getElementById('seasonSelect').value;
    const grid = document.getElementById('episodesGrid');
    if(!grid) return;
    grid.innerHTML = '<p style="color:white;">Loading episodes...</p>';
    const detailsUrl = `details.html?id=${currentTvId}&type=tv`;
    try {
        const res = await fetch(`${BASE_URL}/tv/${currentTvId}/season/${sNum}?api_key=${API_KEY}`);
        const data = await res.json();
        grid.innerHTML = '';
        data.episodes.forEach(ep => {
            const img = ep.still_path ? IMG_URL + ep.still_path : 'https://via.placeholder.com/300x169?text=No+Image';
            
            // TMDB ID එකත් ලින්ක් එකට යැව්වා
            const playUrl = currentImdbId ? `play.html?id=${currentTvId}&imdb=${currentImdbId}&type=tv&s=${sNum}&e=${ep.episode_number}&detailsUrl=${encodeURIComponent(detailsUrl)}` : '#';
            
            grid.insertAdjacentHTML('beforeend', `
                <a href="${playUrl}" class="episode-card">
                <div class="ep-img-wrapper">
                <img src="${img}" loading="lazy">
                <div class="ep-play-icon"><i class="fas fa-play-circle"></i></div>
                </div>
                <div class="ep-info">
                <div class="ep-title">${ep.episode_number}. ${ep.name}</div>
                <div class="ep-desc">${ep.overview || 'No description available.'}</div>
                </div></a>`);
        });
    } catch(e) { grid.innerHTML = '<p style="color:red;">Error loading episodes.</p>'; }
}

async function loadTrailer(id, type) {
    try {
        const res = await fetch(`${BASE_URL}/${type}/${id}/videos?api_key=${API_KEY}`);
        const data = await res.json();
        const trailer = data.results?.find(vid => vid.type === 'Trailer' && vid.site === 'YouTube') || data.results?.find(vid => vid.site === 'YouTube');
        const container = document.getElementById('heroVideoContainer');
        if (trailer && container) {
            const muteState = isMuted ? 1 : 0;
            container.innerHTML = `<iframe id="yt-player" src="https://www.youtube.com/embed/${trailer.key}?enablejsapi=1&autoplay=1&mute=${muteState}&controls=0&disablekb=1&fs=0&modestbranding=1&playsinline=1&rel=0&iv_load_policy=3&loop=1&playlist=${trailer.key}" allow="autoplay" allowfullscreen></iframe>`;
            
            const muteBtn = document.getElementById('muteBtn');
            if(muteBtn) {
                muteBtn.style.display = 'flex';
                muteBtn.innerHTML = isMuted ? '<i class="fas fa-volume-mute"></i>' : '<i class="fas fa-volume-up"></i>';
            }

            const trailerPlayBtn = document.getElementById('trailerPlayBtn');
            if(trailerPlayBtn) {
                isTrailerPlaying = true;
                trailerPlayBtn.innerHTML = '<i class="fas fa-stop"></i>';
            }
        } else {
            const btn = document.getElementById('muteBtn');
            if(btn) btn.style.display = 'none';
            
            const trailerPlayBtn = document.getElementById('trailerPlayBtn');
            if(trailerPlayBtn) {
                trailerPlayBtn.innerHTML = '<i class="fas fa-play"></i>';
                if(typeof startHeroSlider === 'function' && !heroSlideInterval) startHeroSlider();
            }
        }
    } catch(e) { 
        console.error("Trailer err:", e); 
        const btn = document.getElementById('muteBtn');
        if(btn) btn.style.display = 'none';
        if(typeof startHeroSlider === 'function' && !heroSlideInterval) startHeroSlider(); 
    }
}

window.toggleMute = function() {
    const iframe = document.getElementById('yt-player');
    const btn = document.getElementById('muteBtn');
    if (iframe && btn) {
        if (isMuted) {
            iframe.contentWindow.postMessage('{"event":"command","func":"unMute","args":""}', '*');
            btn.innerHTML = '<i class="fas fa-volume-up"></i>';
            isMuted = false;
        } else {
            iframe.contentWindow.postMessage('{"event":"command","func":"mute","args":""}', '*');
            btn.innerHTML = '<i class="fas fa-volume-mute"></i>';
            isMuted = true;
        }
    }
}

async function initBrowse() {
    loadBrowseCategory('trending', document.querySelector('.cat-pill'));
    
    window.addEventListener('scroll', () => {
        if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 500) {
            loadMoreBrowseItems();
        }
    });
}

window.loadBrowseCategory = function(categoryId, btnElement) {
    document.querySelectorAll('.cat-pill').forEach(b => b.classList.remove('active'));
    if(btnElement) btnElement.classList.add('active');

    // Mobile එකේදී filter එකක් තේරුවම auto menu එක close වෙන්න
    const sidebar = document.getElementById('browseFilters');
    if (sidebar && sidebar.classList.contains('active')) {
        sidebar.classList.remove('active');
    }

    currentPage = 1;
    document.getElementById('browseGrid').innerHTML = ''; 
    
    // Quick Picks
    if (categoryId === 'trending') currentFetchUrl = `/trending/all/day?api_key=${API_KEY}`;
    else if (categoryId === 'top_rated') currentFetchUrl = `/movie/top_rated?api_key=${API_KEY}`;
    else if (categoryId === 'popular') currentFetchUrl = `/movie/popular?api_key=${API_KEY}`;
    
    // Platforms
    else if (categoryId === 'netflix') currentFetchUrl = `/discover/tv?api_key=${API_KEY}&with_networks=213`;
    else if (categoryId === 'disney') currentFetchUrl = `/discover/tv?api_key=${API_KEY}&with_networks=2739`;
    else if (categoryId === 'prime') currentFetchUrl = `/discover/tv?api_key=${API_KEY}&with_networks=1024`;
    else if (categoryId === 'apple') currentFetchUrl = `/discover/tv?api_key=${API_KEY}&with_networks=2552`;
    else if (categoryId === 'hbo') currentFetchUrl = `/discover/tv?api_key=${API_KEY}&with_networks=49`;
    else if (categoryId === 'hulu') currentFetchUrl = `/discover/tv?api_key=${API_KEY}&with_networks=453`;
    
    // Content Type
    else if (categoryId === 'movies') currentFetchUrl = `/discover/movie?api_key=${API_KEY}`;
    else if (categoryId === 'tv') currentFetchUrl = `/discover/tv?api_key=${API_KEY}`;
    else if (categoryId === 'anime') currentFetchUrl = `/discover/tv?api_key=${API_KEY}&with_genres=16&with_original_language=ja`;
    else if (categoryId === 'kids') currentFetchUrl = `/discover/movie?api_key=${API_KEY}&with_genres=10751`;
    else if (categoryId === 'documentary') currentFetchUrl = `/discover/movie?api_key=${API_KEY}&with_genres=99`;
    
    // Custom / Extended Genres
    else if (categoryId === 'action_adv') currentFetchUrl = `/discover/tv?api_key=${API_KEY}&with_genres=10759`;
    else if (categoryId === 'biography') currentFetchUrl = `/discover/movie?api_key=${API_KEY}&with_keywords=3108`;
    else if (categoryId === 'costume') currentFetchUrl = `/discover/movie?api_key=${API_KEY}&with_keywords=3133`;
    else if (categoryId === 'film_noir') currentFetchUrl = `/discover/movie?api_key=${API_KEY}&with_keywords=2249`;
    else if (categoryId === 'game_show') currentFetchUrl = `/discover/tv?api_key=${API_KEY}&with_genres=10764`;
    else if (categoryId === 'kungfu') currentFetchUrl = `/discover/movie?api_key=${API_KEY}&with_keywords=779`;
    else if (categoryId === 'musical') currentFetchUrl = `/discover/movie?api_key=${API_KEY}&with_keywords=4344`;
    else if (categoryId === 'mythological') currentFetchUrl = `/discover/movie?api_key=${API_KEY}&with_keywords=2035`;
    else if (categoryId === 'news') currentFetchUrl = `/discover/tv?api_key=${API_KEY}&with_genres=10763`;
    else if (categoryId === 'psychological') currentFetchUrl = `/discover/movie?api_key=${API_KEY}&with_keywords=5480`;
    else if (categoryId === 'reality') currentFetchUrl = `/discover/tv?api_key=${API_KEY}&with_genres=10768`;
    else if (categoryId === 'scifi_fantasy') currentFetchUrl = `/discover/tv?api_key=${API_KEY}&with_genres=10765`;
    else if (categoryId === 'short') currentFetchUrl = `/discover/movie?api_key=${API_KEY}&with_keywords=235552`;
    else if (categoryId === 'sitcom') currentFetchUrl = `/discover/tv?api_key=${API_KEY}&with_keywords=6752`;
    else if (categoryId === 'sport') currentFetchUrl = `/discover/movie?api_key=${API_KEY}&with_keywords=6075`;
    else if (categoryId === 'talk_show') currentFetchUrl = `/discover/tv?api_key=${API_KEY}&with_genres=10767`;
    
    // Main TMDB Genres (Action, Comedy, etc.)
    else currentFetchUrl = `/discover/movie?api_key=${API_KEY}&with_genres=${categoryId}`;

    loadMoreBrowseItems(); 
}

async function loadMoreBrowseItems() {
    if (isLoading) return;
    isLoading = true;
    const spinner = document.getElementById('loadingSpinner');
    if(spinner) spinner.style.display = 'block';

    try {
        const res = await fetch(`${BASE_URL}${currentFetchUrl}&page=${currentPage}`);
        const data = await res.json();
        const grid = document.getElementById('browseGrid');
        
        data.results.forEach(item => {
            if (item.poster_path) {
                const type = item.media_type || (currentFetchUrl.includes('/tv') ? 'tv' : 'movie');
                const mediaBadge = `<div class="media-badge">${type === 'tv' ? 'TV' : 'Movie'}</div>`;
                grid.insertAdjacentHTML('beforeend', `
                    <a href="details.html?id=${item.id}&type=${type}" class="movie-card">
                        <div class="card-img-container">${mediaBadge}<img src="${IMG_URL + item.poster_path}" loading="lazy"></div>
                        <h3 class="card-title">${item.title || item.name}</h3>
                    </a>
                `);
            }
        });
        currentPage++; 
    } catch(err) { console.error(err); } 
    finally {
        isLoading = false;
        if(spinner) spinner.style.display = 'none';
    }
}

/* ================= PLAY PAGE (EPISODES POPUP) ================= */
window.loadPlayEpisodes = async function(tmdbId, imdbId, currentSeason) {
    currentTvId = tmdbId;
    currentImdbId = imdbId;
    currentPlaySeason = Number(currentSeason);
    currentPlayEpisode = Number(new URLSearchParams(window.location.search).get('e') || 1);
    availablePlaySeasons = [];

    try {
        const showRes = await fetch(`${BASE_URL}/tv/${tmdbId}?api_key=${API_KEY}`);
        const showData = await showRes.json();
        availablePlaySeasons = (showData.seasons || []).filter(s => s.season_number > 0).map(s => s.season_number).sort((a, b) => a - b);
        document.getElementById('playTitle').innerText = showData.name || "TV Show";

        const select = document.getElementById('playSeasonSelect');
        if(select && showData.seasons) {
            showData.seasons.filter(s => s.season_number > 0).forEach(s => {
                const isSelected = (s.season_number == currentSeason) ? 'selected' : '';
                select.insertAdjacentHTML('beforeend', `<option value="${s.season_number}" ${isSelected}>${s.name}</option>`);
            });
            changePlaySeason(); 
        }
    } catch(e) { console.error(e); }
}

window.changePlaySeason = async function() {
    const sNum = document.getElementById('playSeasonSelect').value;
    currentPlaySeason = Number(sNum);
    const grid = document.getElementById('playEpisodesGrid');
    if(!grid) return;
    grid.innerHTML = '<p style="color:white;">Loading episodes...</p>';
    
    try {
        const res = await fetch(`${BASE_URL}/tv/${currentTvId}/season/${sNum}?api_key=${API_KEY}`);
        const data = await res.json();
        grid.innerHTML = '';

        const nextButton = document.getElementById('nextEpisodeBtn');
        const previousButton = document.getElementById('previousEpisodeBtn');
        const currentEpisodeNumber = Number(currentPlayEpisode || 1);
        let nextEpisodeUrl = '';
        let previousEpisodeUrl = '';
        const episodeNumbers = data.episodes.map(ep => ep.episode_number).sort((a, b) => a - b);
        const nextEpisodeInSeason = episodeNumbers.find(epNum => epNum > currentEpisodeNumber);
        const previousEpisodeNumbers = episodeNumbers.filter(epNum => epNum < currentEpisodeNumber);
        const previousEpisodeInSeason = previousEpisodeNumbers.length ? previousEpisodeNumbers[previousEpisodeNumbers.length - 1] : null;
        const detailsUrl = window.playDetailsUrl || (currentTvId ? `details.html?id=${currentTvId}&type=tv` : 'index.html');

        if (currentPlaySeason === Number(sNum) && nextEpisodeInSeason) {
            nextEpisodeUrl = `play.html?id=${currentTvId}&imdb=${currentImdbId}&type=tv&s=${sNum}&e=${nextEpisodeInSeason}&detailsUrl=${encodeURIComponent(detailsUrl)}`;
        } else if (currentPlaySeason === Number(sNum)) {
            const nextSeason = availablePlaySeasons.find(seasonNum => seasonNum > Number(sNum));
            if (nextSeason) {
                nextEpisodeUrl = `play.html?id=${currentTvId}&imdb=${currentImdbId}&type=tv&s=${nextSeason}&e=1&detailsUrl=${encodeURIComponent(detailsUrl)}`;
            }
        }

        if (currentPlaySeason === Number(sNum) && previousEpisodeInSeason) {
            previousEpisodeUrl = `play.html?id=${currentTvId}&imdb=${currentImdbId}&type=tv&s=${sNum}&e=${previousEpisodeInSeason}&detailsUrl=${encodeURIComponent(detailsUrl)}`;
        } else if (currentPlaySeason === Number(sNum)) {
            const previousSeason = [...availablePlaySeasons].reverse().find(seasonNum => seasonNum < Number(sNum));
            if (previousSeason) {
                previousEpisodeUrl = `play.html?id=${currentTvId}&imdb=${currentImdbId}&type=tv&s=${previousSeason}&e=1&detailsUrl=${encodeURIComponent(detailsUrl)}`;
            }
        }

        window.playNextEpisodeUrl = nextEpisodeUrl;
        window.playPreviousEpisodeUrl = previousEpisodeUrl;
        const isTvPlayback = Boolean(currentTvId);
        if (nextButton) {
            nextButton.style.display = (isTvPlayback && nextEpisodeUrl) ? 'flex' : 'none';
            nextButton.href = nextEpisodeUrl || '#';
        }
        if (previousButton) {
            previousButton.style.display = (isTvPlayback && previousEpisodeUrl) ? 'flex' : 'none';
            previousButton.href = previousEpisodeUrl || '#';
        }

        data.episodes.forEach(ep => {
            const img = ep.still_path ? IMG_URL + ep.still_path : 'https://via.placeholder.com/300x169?text=No+Image';
            const playUrl = `play.html?id=${currentTvId}&imdb=${currentImdbId}&type=tv&s=${sNum}&e=${ep.episode_number}&detailsUrl=${encodeURIComponent(detailsUrl)}`;
            const isCurrentEpisode = Number(sNum) === Number(currentPlaySeason) && Number(ep.episode_number) === Number(currentPlayEpisode);
            const activeClass = isCurrentEpisode ? ' is-current-episode' : '';
            const currentBadge = isCurrentEpisode ? '<span class="ep-current-badge">Now Playing</span>' : '';
            
            grid.insertAdjacentHTML('beforeend', `
                <a href="${playUrl}" class="episode-card${activeClass}" ${isCurrentEpisode ? 'aria-current="true"' : ''}>
                    <div class="ep-img-wrapper">
                        <img src="${img}" loading="lazy">
                        <div class="ep-play-icon"><i class="fas fa-play-circle"></i></div>
                    </div>
                    <div class="ep-info">
                        ${currentBadge}
                        <div class="ep-title">${ep.episode_number}. ${ep.name}</div>
                        <div class="ep-desc">${ep.overview || 'No description available.'}</div>
                    </div>
                </a>
            `);
        });
    } catch(e) { grid.innerHTML = '<p style="color:red;">Error loading episodes.</p>'; }
}