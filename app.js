import { db } from './firebase-config.js';
import { 
    collection, 
    getDocs, 
    query, 
    where, 
    addDoc, 
    orderBy 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let heroesData = [];

// --- ИНИЦИАЛИЗАЦИЯ ПРИ ЗАГРУЗКЕ СТРАНИЦЫ ---
document.addEventListener('DOMContentLoaded', () => {
    
    // 1. Загрузка героев
    loadHeroesFromDB();

    // 2. Привязка кнопок (Исправление бага с модулями)
    
    // Кнопка открытия формы добавления
    const openAddBtn = document.getElementById('openAddModalBtn');
    if (openAddBtn) {
        openAddBtn.addEventListener('click', () => {
            const modal = document.getElementById('modalAdd');
            if(modal) {
                modal.style.display = 'flex';
                document.body.style.overflow = 'hidden';
            }
        });
    }

    // Кнопка отправки формы
    const form = document.getElementById('addStoryForm');
    if (form) {
        form.addEventListener('submit', handleFormSubmit);
    }

    // Кнопка случайного героя
    const randomBtn = document.getElementById('randomHeroBtn');
    if (randomBtn) {
        randomBtn.addEventListener('click', showRandomHero);
    }

    // Кнопка "Поделиться"
    const shareBtn = document.getElementById('shareBtn');
    if (shareBtn) {
        shareBtn.addEventListener('click', shareHero);
    }

    // Кнопка "Я помню" (просто алерт)
    const rememberBtn = document.getElementById('rememberBtn');
    if (rememberBtn) {
        rememberBtn.addEventListener('click', () => alert('Спасибо! Вы сохранили память об этом герое.'));
    }

    // Закрытие модальных окон по крестику
    const closeBtns = document.querySelectorAll('.close-btn, .close-btn-add');
    closeBtns.forEach(btn => {
        btn.addEventListener('click', closeAllModals);
    });

    // Закрытие по клику вне окна
    window.onclick = (e) => {
        const modalDetails = document.getElementById('modalDetails');
        const modalAdd = document.getElementById('modalAdd');
        if (e.target == modalDetails || e.target == modalAdd) {
            closeAllModals();
        }
    };

    // Фильтры
    const searchInput = document.getElementById('searchInput');
    const districtFilter = document.getElementById('districtFilter');
    const typeFilter = document.getElementById('typeFilter');

    if (searchInput) searchInput.addEventListener('input', filterHeroes);
    if (districtFilter) districtFilter.addEventListener('change', filterHeroes);
    if (typeFilter) typeFilter.addEventListener('change', filterHeroes);
});

// --- ОСНОВНЫЕ ФУНКЦИИ ---

async function loadHeroesFromDB() {
    const container = document.getElementById('heroesContainer');
    if (!container) return;
    
    container.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px;">Загрузка истории Урала... ⏳</div>';

    try {
        const q = query(
            collection(db, "heroes"), 
            where("status", "==", "published"),
            orderBy("name", "asc") 
        );
        
        const snapshot = await getDocs(q);
        heroesData = [];
        snapshot.forEach(doc => {
            heroesData.push({ id: doc.id, ...doc.data() });
        });
        
        const totalDisplay = document.getElementById('totalDisplay');
        if (totalDisplay) totalDisplay.textContent = `Всего: ${heroesData.length}`;
        
        renderHeroes(heroesData);
        
    } catch (error) {
        console.error("Ошибка загрузки:", error);
        if(container) {
            container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #d32f2f;">
                <h3>⚠️ Ошибка подключения</h3>
                <p>Проверьте интернет или настройки Firebase.</p>
                <small>${error.message}</small>
            </div>`;
        }
    }
}

function renderHeroes(heroes) {
    const container = document.getElementById('heroesContainer');
    const statsDisplay = document.getElementById('statsDisplay');
    if (!container) return;

    container.innerHTML = '';
    if (statsDisplay) statsDisplay.textContent = `Найдено: ${heroes.length}`;

    if (heroes.length === 0) {
        container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #777;">
            <h3>Ничего не найдено 😔</h3>
            <p>Попробуйте изменить поиск или добавьте новую историю!</p>
        </div>`;
        return;
    }

    heroes.forEach(hero => {
        const card = document.createElement('div');
        card.className = 'hero-card';
        card.onclick = () => openDetails(hero);

        const typeLabel = hero.type === 'frontovik' ? 'Фронтовик' : 'Труженик тыла';
        const imgUrl = hero.image || 'https://via.placeholder.com/400x500?text=Нет+фото';
        const name = hero.name || 'Без имени';
        const district = hero.district || 'Район не указан';
        const rank = hero.rank || '';

        card.innerHTML = `
            <img src="${imgUrl}" alt="${name}" class="hero-img" loading="lazy">
            <div class="hero-info">
                <div class="hero-name">${name}</div>
                <div class="hero-district">📍 ${district}</div>
                <div class="hero-rank">${rank} ${rank ? '•' : ''} ${typeLabel}</div>
            </div>
        `;
        container.appendChild(card);
    });
}

function filterHeroes() {
    const searchInput = document.getElementById('searchInput');
    const districtFilter = document.getElementById('districtFilter');
    const typeFilter = document.getElementById('typeFilter');

    if (!searchInput || !heroesData) return;

    const text = searchInput.value.toLowerCase();
    const district = districtFilter ? districtFilter.value : 'all';
    const type = typeFilter ? typeFilter.value : 'all';

    const filtered = heroesData.filter(hero => {
        const matchText = (hero.name && hero.name.toLowerCase().includes(text)) || 
                          (hero.story && hero.story.toLowerCase().includes(text)) ||
                          (hero.rank && hero.rank.toLowerCase().includes(text));
        const matchDistrict = district === 'all' || hero.district === district;
        const matchType = type === 'all' || hero.type === type;
        return matchText && matchDistrict && matchType;
    });

    renderHeroes(filtered);
}

function openDetails(hero) {
    const modal = document.getElementById('modalDetails');
    if (!modal) return;

    const imgEl = document.getElementById('modalImg');
    const nameEl = document.getElementById('modalName');
    const rankEl = document.getElementById('modalRank');
    const districtEl = document.getElementById('modalDistrict');
    const yearsEl = document.getElementById('modalYears');
    const storyEl = document.getElementById('modalStory');
    const locationEl = document.getElementById('modalLocation');
    const typeEl = document.getElementById('modalType');

    if (imgEl) imgEl.src = hero.image || 'https://via.placeholder.com/400x500?text=Нет+фото';
    if (nameEl) nameEl.textContent = hero.name || 'Без имени';
    if (rankEl) rankEl.textContent = hero.rank || '';
    if (districtEl) districtEl.textContent = hero.district || '';
    if (yearsEl) yearsEl.textContent = `${hero.birthYear || '?'} – ${hero.deathYear || '?'}`;
    if (storyEl) storyEl.textContent = hero.story || 'История отсутствует';
    if (locationEl) locationEl.textContent = hero.location || 'Место не указано';
    if (typeEl) typeEl.textContent = hero.type === 'frontovik' ? 'Фронтовик' : 'Труженик тыла';

    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function showRandomHero() {
    if (!heroesData || heroesData.length === 0) {
        alert('База данных пуста.');
        return;
    }
    const randomIndex = Math.floor(Math.random() * heroesData.length);
    openDetails(heroesData[randomIndex]);
}

function shareHero() {
    const nameEl = document.getElementById('modalName');
    const name = nameEl ? nameEl.textContent : 'Герой';
    
    if (navigator.share) {
        navigator.share({
            title: 'Урал Помнит',
            text: `Посмотри историю героя: ${name}`,
            url: window.location.href
        }).catch(console.error);
    } else {
        navigator.clipboard.writeText(`Посмотри историю героя ${name}: ${window.location.href}`);
        alert('Ссылка скопирована!');
    }
}

// Обработчик отправки формы (теперь вызывается через eventListener)
async function handleFormSubmit(e) {
    e.preventDefault();
    
    const form = e.target;
    const inputs = form.querySelectorAll('input, textarea');
    const submitBtn = document.getElementById('submitStoryBtn');
    
    if (!inputs[0] || !inputs[1] || !inputs[2]) {
        alert('Ошибка формы. Проверьте поля.');
        return;
    }

    const name = inputs[0].value.trim();
    const story = inputs[1].value.trim();
    const district = inputs[2].value.trim();
    const contact = inputs[3] ? inputs[3].value.trim() : 'Не указан';

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Отправка...';
    }

    try {
        await addDoc(collection(db, "submissions"), {
            name, story, district, contact,
            rank: "Требуется уточнение",
            type: "tyl",
            birthYear: 0, deathYear: 0,
            location: "Требуется уточнение",
            image: "https://via.placeholder.com/400x500?text=Фото+ожидается",
            status: "pending",
            createdAt: new Date()
        });
        
        alert('✅ Спасибо! История отправлена на модерацию.');
        closeAllModals();
        form.reset();
        
    } catch (error) {
        console.error("Ошибка:", error);
        alert('❌ Ошибка отправки. Проверьте консоль или интернет.');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Отправить на проверку';
        }
    }
}

function closeAllModals() {
    const modals = [document.getElementById('modalDetails'), document.getElementById('modalAdd')];
    modals.forEach(m => { if(m) m.style.display = 'none'; });
    document.body.style.overflow = 'auto';
}
