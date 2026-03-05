document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('heroesContainer');
    const searchInput = document.getElementById('searchInput');
    const districtFilter = document.getElementById('districtFilter');
    const typeFilter = document.getElementById('typeFilter');
    const statsDisplay = document.getElementById('statsDisplay');
    const totalDisplay = document.getElementById('totalDisplay');
    
    // Modals
    const modalDetails = document.getElementById('modalDetails');
    const modalAdd = document.getElementById('modalAdd');
    const closeBtns = document.querySelectorAll('.close-btn, .close-btn-add');
    
    // Random Button
    document.getElementById('randomHeroBtn').addEventListener('click', showRandomHero);

    // Init
    totalDisplay.textContent = `Всего: ${heroesData.length}`;
    renderHeroes(heroesData);

    // Render Function
    function renderHeroes(heroes) {
        container.innerHTML = '';
        statsDisplay.textContent = `Найдено: ${heroes.length}`;

        if (heroes.length === 0) {
            container.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #777;">
                    <h3>Ничего не найдено 😔</h3>
                    <p>Попробуйте изменить параметры поиска</p>
                </div>`;
            return;
        }

        heroes.forEach(hero => {
            const card = document.createElement('div');
            card.className = 'hero-card';
            card.onclick = () => openDetails(hero);

            const typeLabel = hero.type === 'frontovik' ? 'Фронтовик' : 'Тыл';
            
            card.innerHTML = `
                <img src="${hero.image}" alt="${hero.name}" class="hero-img" loading="lazy">
                <div class="hero-info">
                    <div class="hero-name">${hero.name}</div>
                    <div class="hero-district">📍 ${hero.district}</div>
                    <div class="hero-rank">${hero.rank} • ${typeLabel}</div>
                </div>
            `;
            container.appendChild(card);
        });
    }

    // Filter Logic
    function filterHeroes() {
        const text = searchInput.value.toLowerCase();
        const district = districtFilter.value;
        const type = typeFilter.value;

        const filtered = heroesData.filter(hero => {
            const matchText = hero.name.toLowerCase().includes(text) || 
                              hero.story.toLowerCase().includes(text) ||
                              hero.rank.toLowerCase().includes(text);
            const matchDistrict = district === 'all' || hero.district === district;
            const matchType = type === 'all' || hero.type === type;

            return matchText && matchDistrict && matchType;
        });

        renderHeroes(filtered);
    }

    searchInput.addEventListener('input', filterHeroes);
    districtFilter.addEventListener('change', filterHeroes);
    typeFilter.addEventListener('change', filterHeroes);

    // Open Details
    window.openDetails = (hero) => {
        document.getElementById('modalImg').src = hero.image;
        document.getElementById('modalName').textContent = hero.name;
        document.getElementById('modalRank').textContent = hero.rank;
        document.getElementById('modalDistrict').textContent = hero.district;
        document.getElementById('modalYears').textContent = `${hero.birthYear} – ${hero.deathYear}`;
        document.getElementById('modalStory').textContent = hero.story;
        document.getElementById('modalLocation').textContent = hero.location;
        
        const typeLabel = hero.type === 'frontovik' ? 'Фронтовик' : 'Труженик тыла';
        document.getElementById('modalType').textContent = typeLabel;

        modalDetails.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    };

    // Random Hero
    function showRandomHero() {
        const random = heroesData[Math.floor(Math.random() * heroesData.length)];
        openDetails(random);
    }

    // Share Function
    window.shareHero = () => {
        const name = document.getElementById('modalName').textContent;
        if (navigator.share) {
            navigator.share({
                title: 'Урал Помнит',
                text: `Посмотри историю героя: ${name}`,
                url: window.location.href
            }).catch(console.error);
        } else {
            alert('Ссылка скопирована в буфер обмена!');
        }
    };

    // Add Story Modal
    window.openAddModal = () => {
        modalAdd.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    };

    window.submitStory = (e) => {
        e.preventDefault();
        alert('Спасибо! Ваша история отправлена на модерацию кураторам проекта.');
        modalAdd.style.display = 'none';
        document.body.style.overflow = 'auto';
        e.target.reset();
    };

    // Close Modals
    const closeAllModals = () => {
        modalDetails.style.display = 'none';
        modalAdd.style.display = 'none';
        document.body.style.overflow = 'auto';
    };

    closeBtns.forEach(btn => btn.addEventListener('click', closeAllModals));
    window.onclick = (e) => {
        if (e.target == modalDetails || e.target == modalAdd) closeAllModals();
    };
});
