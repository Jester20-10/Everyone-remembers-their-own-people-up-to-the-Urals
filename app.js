document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('heroesContainer');
    const searchInput = document.getElementById('searchInput');
    const districtFilter = document.getElementById('districtFilter');
    const statsDisplay = document.getElementById('statsDisplay');
    const modal = document.getElementById('modal');
    const closeBtn = document.querySelector('.close-btn');

    // Функция отрисовки карточек
    function renderHeroes(heroes) {
        container.innerHTML = '';
        statsDisplay.textContent = `Найдено героев: ${heroes.length}`;

        if (heroes.length === 0) {
            container.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #777;">Ничего не найдено 😔</p>';
            return;
        }

        heroes.forEach(hero => {
            const card = document.createElement('div');
            card.className = 'hero-card';
            card.onclick = () => openModal(hero);

            card.innerHTML = `
                <img src="${hero.image}" alt="${hero.name}" class="hero-img" loading="lazy">
                <div class="hero-info">
                    <div class="hero-name">${hero.name}</div>
                    <div class="hero-district">📍 ${hero.district}</div>
                    <div class="hero-rank">${hero.rank}</div>
                </div>
            `;
            container.appendChild(card);
        });
    }

    // Функция фильтрации
    function filterHeroes() {
        const searchText = searchInput.value.toLowerCase();
        const selectedDistrict = districtFilter.value;

        const filtered = heroesData.filter(hero => {
            const matchesSearch = hero.name.toLowerCase().includes(searchText) || 
                                  hero.story.toLowerCase().includes(searchText);
            const matchesDistrict = selectedDistrict === 'all' || hero.district === selectedDistrict;

            return matchesSearch && matchesDistrict;
        });

        renderHeroes(filtered);
    }

    // Открытие модального окна
    window.openModal = (hero) => {
        document.getElementById('modalImg').src = hero.image;
        document.getElementById('modalName').textContent = hero.name;
        document.getElementById('modalRank').textContent = hero.rank;
        document.getElementById('modalDistrict').textContent = hero.district;
        document.getElementById('modalYears').textContent = `${hero.birthYear} – ${hero.deathYear}`;
        document.getElementById('modalStory').textContent = hero.story;
        document.getElementById('modalLocation').textContent = hero.location;

        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden'; // Блокируем прокрутку фона
    };

    // Закрытие модального окна
    const closeModal = () => {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    };

    closeBtn.onclick = closeModal;
    window.onclick = (event) => {
        if (event.target == modal) closeModal();
    };

    // Слушатели событий
    searchInput.addEventListener('input', filterHeroes);
    districtFilter.addEventListener('change', filterHeroes);

    // Первоначальная отрисовка
    renderHeroes(heroesData);
});
