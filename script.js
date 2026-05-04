const API_KEY = '52b5b50d2761bc6f0a61091bc7326848';
const BASE_URL = 'https://api.themoviedb.org/3';
const IMG_URL = 'https://image.tmdb.org/t/p/w500';
const BACKDROP_URL = 'https://image.tmdb.org/t/p/original';

const categories = [
    { id: 'top10', title: 'TOP 10 Today', url: `/trending/all/day?api_key=${API_KEY}`, isTop10: true },
    { id: 'trending', title: 'Trending Movies', url: `/trending/movie/week?api_key=${API_KEY}`, isTop10: false },
    { id: 'netflix', title: 'Only on Netflix', url: `/discover/tv?api_key=${API_KEY}&with_networks=213`, isTop10: false },
    { id: 'prime', title: 'Amazon Prime Originals', url: `/discover/tv?api_key=${API_KEY}&with_networks=1024`, isTop10: false },
    { id: 'action', title: 'Action & Adventure', url: `/discover/movie?api_key=${API_KEY}&with_genres=28`, isTop10: false },
    { id: 'comedy', title: 'Comedy Mix', url: `/discover/movie?api_key=${API_KEY}&with_genres=35`, isTop10: false },
    { id: 'horror', title: 'Horror & Thrillers', url: `/discover/movie?api_key=${API_KEY}&with_genres=27`, isTop10: false }
];

let isMuted = true;
let currentTvId = null;
let currentImdbId = null;
let currentPage = 1;
let currentFetchUrl = '';
let isLoading = false;

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
        });
    }
});

async function loadHomePage() {
    try {
        const res = await fetch(BASE_URL + categories[0].url);
        const data = await res.json();
        const movie = data.results[Math.floor(Math.random() * 10)];
        const title = movie.title || movie.name;
        const year = (movie.release_date || movie.first_air_date || '').split('-')[0];
        const type = movie.media_type === 'tv' ? 'TV Show' : 'Movie';
        
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
            heroVideoContainer.style.backgroundImage = `url(${BACKDROP_URL + movie.backdrop_path})`;
            loadTrailer(movie.id, movie.media_type || 'movie');
        }
        const playBtn = document.getElementById('heroPlayBtn');
        if(playBtn) playBtn.href = `details.html?id=${movie.id}&type=${movie.media_type || 'movie'}&play=true`;
        const infoBtn = document.getElementById('heroInfoBtn');
        if(infoBtn) {
            infoBtn.onclick = () => { window.location.href = `details.html?id=${movie.id}&type=${movie.media_type || 'movie'}`; };
        }
        const mainContent = document.getElementById('mainContent');
        if(mainContent) {
            categories.forEach(cat => {
                mainContent.insertAdjacentHTML('beforeend', `<div class="movie-row"><h2>${cat.title}</h2><div class="row-posters" id="${cat.id}"></div></div>`);
                fetchAndBuildRow(cat.id, cat.url, cat.isTop10);
            });
        }
    } catch (error) { console.error("Home page error:", error); }
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
                row.insertAdjacentHTML('beforeend', `
                    <a href="details.html?id=${item.id}&type=${type}" class="movie-card">
                    <div class="card-img-container">${topBadge}<img src="${IMG_URL + item.poster_path}" loading="lazy"></div>
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
        const res = await fetch(`${BASE_URL}/${type}/${id}?api_key=${API_KEY}&append_to_response=credits,external_ids,similar,recommendations`);
        const data = await res.json();
        document.getElementById('heroTitle').innerText = data.title || data.name;
        document.getElementById('heroDesc').innerText = data.overview;
        document.getElementById('heroMeta').innerHTML = `
            <span class="rating"><i class="fas fa-star"></i> ${data.vote_average.toFixed(1)}</span>
            <span>•</span><span>${(data.release_date || data.first_air_date || '').split('-')[0]}</span>
            <span>•</span><span>${data.genres.map(g => g.name).join(', ')}</span>`;
        document.getElementById('heroVideoContainer').style.backgroundImage = `url(${BACKDROP_URL + data.backdrop_path})`;
        loadTrailer(id, type);
        
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
        if (type === 'movie') {
            const playSection = document.getElementById('moviePlaySection');
            const playBtn = document.getElementById('finalPlayLink');
            if (currentImdbId && playSection && playBtn) {
                const playUrl = `play.html?imdb=${currentImdbId}&type=movie`;
                playBtn.href = playUrl;
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
        }
        
        const similarSection = document.getElementById('similarContent');
        if(similarSection) {
            if(data.similar?.results.length > 0) {
                similarSection.insertAdjacentHTML('beforeend', `<div class="movie-row"><h2>Similar Titles</h2><div class="row-posters" id="simRow"></div></div>`);
                buildSimpleRow('simRow', data.similar.results, type);
            } else if(data.recommendations?.results.length > 0) {
                similarSection.insertAdjacentHTML('beforeend', `<div class="movie-row"><h2>Recommended For You</h2><div class="row-posters" id="recRow"></div></div>`);
                buildSimpleRow('recRow', data.recommendations.results, type);
            }
        }
    } catch (error) { console.error(error); }
}

function buildSimpleRow(rowId, items, type) {
    const row = document.getElementById(rowId);
    if(!row) return;
    items.slice(0, 15).forEach(item => {
        if(item.poster_path) {
            row.insertAdjacentHTML('beforeend', `
                <a href="details.html?id=${item.id}&type=${type}" class="movie-card">
                <div class="card-img-container"><img src="${IMG_URL + item.poster_path}" loading="lazy"></div>
                <h3 class="card-title">${item.title || item.name}</h3></a>`);
        }
    });
}

window.changeSeason = async function() {
    const sNum = document.getElementById('seasonSelect').value;
    const grid = document.getElementById('episodesGrid');
    if(!grid) return;
    grid.innerHTML = '<p style="color:white;">Loading episodes...</p>';
    try {
        const res = await fetch(`${BASE_URL}/tv/${currentTvId}/season/${sNum}?api_key=${API_KEY}`);
        const data = await res.json();
        grid.innerHTML = '';
        data.episodes.forEach(ep => {
            const img = ep.still_path ? IMG_URL + ep.still_path : 'https://via.placeholder.com/300x169?text=No+Image';
            
            // TMDB ID එකත් ලින්ක් එකට යැව්වා
            const playUrl = currentImdbId ? `play.html?id=${currentTvId}&imdb=${currentImdbId}&type=tv&s=${sNum}&e=${ep.episode_number}` : '#';
            
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
        const trailer = data.results?.find(vid => vid.type === 'Trailer' && vid.site === 'YouTube');
        const container = document.getElementById('heroVideoContainer');
        if (trailer && container) {
            container.innerHTML = `<iframe id="yt-player" src="https://www.youtube-nocookie.com/embed/${trailer.key}?enablejsapi=1&autoplay=1&mute=1&controls=0&showinfo=0&rel=0&loop=1&playlist=${trailer.key}&playsinline=1" allow="autoplay" allowfullscreen></iframe>`;
        } else {
            const btn = document.getElementById('muteBtn');
            if(btn) btn.style.display = 'none';
        }
    } catch(e) { console.error("Trailer err:", e); }
}

window.toggleMute = function() {
    const iframe = document.getElementById('yt-player');
    const icon = document.querySelector('#muteBtn i');
    if (iframe) {
        if (isMuted) {
            iframe.contentWindow.postMessage('{"event":"command","func":"unMute","args":""}', '*');
            icon.className = 'fas fa-volume-up';
            isMuted = false;
        } else {
            iframe.contentWindow.postMessage('{"event":"command","func":"mute","args":""}', '*');
            icon.className = 'fas fa-volume-mute';
            isMuted = true;
        }
    }
}

async function initBrowse() {
    try {
        const res = await fetch(`${BASE_URL}/genre/movie/list?api_key=${API_KEY}`);
        const data = await res.json();
        const pillContainer = document.getElementById('browseCategoryPills');
        data.genres.forEach(genre => {
            const btn = document.createElement('button');
            btn.className = 'cat-pill';
            btn.innerText = genre.name;
            btn.onclick = () => loadBrowseCategory(genre.id, btn);
            pillContainer.appendChild(btn);
        });
    } catch(e) { console.error(e); }

    loadBrowseCategory('trending', document.querySelector('.cat-pill'));
    
    window.addEventListener('scroll', () => {
        if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 500) {
            loadMoreBrowseItems();
        }
    });
}

window.loadBrowseCategory = function(categoryId, btnElement) {
    document.querySelectorAll('.cat-pill').forEach(b => b.classList.remove('active'));
    btnElement.classList.add('active');

    currentPage = 1;
    document.getElementById('browseGrid').innerHTML = ''; 
    
    if (categoryId === 'trending') currentFetchUrl = `/trending/all/day?api_key=${API_KEY}`;
    else if (categoryId === 'netflix') currentFetchUrl = `/discover/tv?api_key=${API_KEY}&with_networks=213`;
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
                grid.insertAdjacentHTML('beforeend', `
                    <a href="details.html?id=${item.id}&type=${type}" class="movie-card">
                        <div class="card-img-container"><img src="${IMG_URL + item.poster_path}" loading="lazy"></div>
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

    try {
        const showRes = await fetch(`${BASE_URL}/tv/${tmdbId}?api_key=${API_KEY}`);
        const showData = await showRes.json();
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
    const grid = document.getElementById('playEpisodesGrid');
    if(!grid) return;
    grid.innerHTML = '<p style="color:white;">Loading episodes...</p>';
    
    try {
        const res = await fetch(`${BASE_URL}/tv/${currentTvId}/season/${sNum}?api_key=${API_KEY}`);
        const data = await res.json();
        grid.innerHTML = '';

        data.episodes.forEach(ep => {
            const img = ep.still_path ? IMG_URL + ep.still_path : 'https://via.placeholder.com/300x169?text=No+Image';
            const playUrl = `play.html?id=${currentTvId}&imdb=${currentImdbId}&type=tv&s=${sNum}&e=${ep.episode_number}`;
            
            grid.insertAdjacentHTML('beforeend', `
                <a href="${playUrl}" class="episode-card">
                    <div class="ep-img-wrapper">
                        <img src="${img}" loading="lazy">
                        <div class="ep-play-icon"><i class="fas fa-play-circle"></i></div>
                    </div>
                    <div class="ep-info">
                        <div class="ep-title">${ep.episode_number}. ${ep.name}</div>
                        <div class="ep-desc">${ep.overview || 'No description available.'}</div>
                    </div>
                </a>
            `);
        });
    } catch(e) { grid.innerHTML = '<p style="color:red;">Error loading episodes.</p>'; }
}