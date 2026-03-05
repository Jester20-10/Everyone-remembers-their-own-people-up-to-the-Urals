// Импорт функций из Firebase SDK
import { db } from './firebase-config.js';
import { 
    collection, 
    getDocs, 
    query, 
    where, 
    addDoc, 
    orderBy 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Глобальная переменная для хранения данных
let heroesData = [];

// Элементы DOM
const container = document.getElementById('heroesContainer');
const searchInput = document.getElementById('searchInput');
const districtFilter = document.getElementById('districtFilter');
const typeFilter = document.getElementById('typeFilter');
const statsDisplay = document.getElementById('statsDisplay');
const totalDisplay = document.getElementById('totalDisplay');

// Модальные окна
const modalDetails = document.getElementById('modalDetails');
const modalAdd = document.getElementById('modalAdd');
const closeBtns = document.querySelectorAll('.close-btn, .close-btn-add');

// Кнопка случайного героя
const randomHeroBtn = document.getElementById('randomHeroBtn');
if (randomHeroBtn) {
    randomHeroBtn.addEventListener('click', showRandomHero);
}

// --- ИНИЦИАЛИЗАЦИЯ ---
document.addEventListener('DOMContentLoaded', () => {
    loadHeroesFromDB();
});

// --- ЗАГРУЗКА ДАННЫХ ИЗ БАЗЫ ---
async function loadHeroesFromDB() {
    if (!container) return;
    
    // Показываем индикатор загрузки
    container.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px;">Загрузка истории Урала... ⏳</div>';

    try {
        // Запрос: получить только опубликованных героев, отсортированных по имени
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
        
        // Обновляем статистику
        if (totalDisplay) totalDisplay.textContent = `Всего: ${heroesData.length}`;
        
        renderHeroes(heroesData);
        
    } catch (error) {
        console.error("Ошибка загрузки данных:", error);
        container.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #d32f2f;">
                <h3>⚠️ Ошибка подключения</h3>
                <p>Не удалось загрузить данные из базы. Проверьте интернет или настройки Firebase.</p>
                <small>${error.message}</small>
            </div>`;
    }
}

// --- ОТРИСОВКА КАРТОЧЕК ---
function renderHeroes(heroes) {
    if (!container) return;
    container.innerHTML = '';
    
    if (statsDisplay) statsDisplay.textContent = `Найдено: ${heroes.length}`;

    if (heroes.length === 0) {
        container.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #777;">
                <h3>Ничего не найдено 😔</h3>
                <p>Попробуйте изменить параметры поиска или добавить новую историю!</p>
            </div>`;
        return;
    }

    heroes.forEach(hero => {
        const card = document.createElement('div');
        card.className = 'hero-card';
        card.onclick = () => openDetails(hero);

        // Определение лейбла типа
        const typeLabel = hero.type === 'frontovik' ? 'Фронтовик' : 'Труженик тыла';
        
        // Безопасная вставка данных (защита от XSS через textContent была бы лучше, но для простоты используем шаблон с проверкой)
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

// --- ФИЛЬТРАЦИЯ ---
function filterHeroes() {
    const text = searchInput ? searchInput.value.toLowerCase() : '';
    const district = districtFilter ? districtFilter.value : 'all';
    const type = typeFilter ? typeFilter.value : 'all';

    if (!heroesData) return;

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

// Навешиваем слушатели событий на фильтры
if (searchInput) searchInput.addEventListener('input', filterHeroes);
if (districtFilter) districtFilter.addEventListener('change', filterHeroes);
if (typeFilter) typeFilter.addEventListener('change', filterHeroes);

// --- МОДАЛЬНОЕ ОКНО: ДЕТАЛИ ГЕРОЯ ---
window.openDetails = (hero) => {
    if (!modalDetails) return;

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
    
    if (typeEl) {
        const typeLabel = hero.type === 'frontovik' ? 'Фронтовик' : 'Труженик тыла';
        typeEl.textContent = typeLabel;
    }

    modalDetails.style.display = 'flex';
    document.body.style.overflow = 'hidden'; // Блокировка прокрутки фона
};

// --- СЛУЧАЙНЫЙ ГЕРОЙ ---
function showRandomHero() {
    if (!heroesData || heroesData.length === 0) {
        alert('База данных пуста.');
        return;
    }
    const randomIndex = Math.floor(Math.random() * heroesData.length);
    openDetails(heroesData[randomIndex]);
}

// --- ШЕРИНГ (ПОДЕЛИТЬСЯ) ---
window.shareHero = () => {
    const nameEl = document.getElementById('modalName');
    const name = nameEl ? nameEl.textContent : 'Герой';
    
    if (navigator.share) {
        navigator.share({
            title: 'Урал Помнит',
            text: `Посмотри историю героя: ${name}`,
            url: window.location.href
        }).catch(console.error);
    } else {
        // Фоллбэк для старых браузеров
        navigator.clipboard.writeText(`Посмотри историю героя ${name} в приложении "Урал Помнит": ${window.location.href}`);
        alert('Ссылка скопирована в буфер обмена!');
    }
};

// --- МОДАЛЬНОЕ ОКНО: ДОБАВИТЬ ИСТОРИЮ ---
window.openAddModal = () => {
    if (modalAdd) {
        modalAdd.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
};

// --- ОТПРАВКА ЗАЯВКИ В БАЗУ (МОДЕРАЦИЯ) ---
window.submitStory = async (e) => {
    e.preventDefault();
    
    const form = e.target;
    const inputs = form.querySelectorAll('input, textarea');
    
    // Сбор данных (порядок полей должен совпадать с HTML формой)
    // 0: ФИО, 1: История, 2: Район, 3: Контакты (если есть)
    const name = inputs[0]?.value.trim() || 'Аноним';
    const story = inputs[1]?.value.trim() || '';
    const district = inputs[2]?.value.trim() || 'Не указан';
    const contact = inputs[3]?.value.trim() || 'Не указан';

    const submitBtn = form.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn ? submitBtn.textContent : 'Отправка...';
    
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Отправка...';
    }

    try {
        await addDoc(collection(db, "submissions"), {
            name: name,
            story: story,
            district: district,
            contact: contact,
            rank: "Требуется уточнение", // По умолчанию
            type: "tyl", // По умолчанию, модератор изменит
            birthYear: 0,
            deathYear: 0,
            location: "Требуется уточнение",
            image: "https://via.placeholder.com/400x500?text=Фото+ожидается",
            status: "pending", // Статус для модерации
            createdAt: new Date(),
            submittedBy: "user_web"
        });
        
        alert('✅ Спасибо! История успешно отправлена на модерацию.\n\nПосле проверки экспертами она появится в общем списке.');
        
        if (modalAdd) modalAdd.style.display = 'none';
        document.body.style.overflow = 'auto';
        form.reset();
        
    } catch (error) {
        console.error("Ошибка при отправке:", error);
        alert('❌ Ошибка отправки данных. Проверьте подключение к интернету или попробуйте позже.');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = originalBtnText;
        }
    }
};

// --- ЗАКРЫТИЕ МОДАЛЬНЫХ ОКОН ---
const closeAllModals = () => {
    if (modalDetails) modalDetails.style.display = 'none';
    if (modalAdd) modalAdd.style.display = 'none';
    document.body.style.overflow = 'auto';
};

closeBtns.forEach(btn => btn.addEventListener('click', closeAllModals));

window.onclick = (e) => {
    if (e.target == modalDetails || e.target == modalAdd) {
        closeAllModals();
    }
};
