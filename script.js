document.addEventListener('DOMContentLoaded', () => {
    const app = document.getElementById('app');
    
    // Загрузка данных из JSON
    fetch('data.json')
        .then(response => response.json())
        .then(heroes => {
            app.innerHTML = ''; // Очистить лоадер
            
            heroes.forEach(hero => {
                const card = document.createElement('div');
                card.className = 'hero-card';
                card.onclick = () => showDetails(hero);
                
                card.innerHTML = `
                    <img src="${hero.image}" alt="${hero.name}" class="hero-img">
                    <div class="hero-name">${hero.name}</div>
                    <div class="hero-district">📍 ${hero.district}</div>
                    <div class="hero-preview">${hero.story.substring(0, 80)}...</div>
                `;
                app.appendChild(card);
            });
        })
        .catch(err => {
            app.innerHTML = '<p style="text-align:center; color:red;">Ошибка загрузки данных. Проверьте подключение.</p>';
            console.error(err);
        });
});

// Функция показа подробностей
function showDetails(hero) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'flex';
    
    modal.innerHTML = `
        <div class="modal-content">
            <span class="close-btn" onclick="this.parentElement.parentElement.remove()">&times;</span>
            <img src="${hero.image}" style="width:100%; border-radius:8px; margin-bottom:10px;">
            <h2 style="color:#8B0000">${hero.name}</h2>
            <p><strong>Район:</strong> ${hero.district}</p>
            <p><strong>Место памяти:</strong> ${hero.location}</p>
            <p>${hero.story}</p>
            <button onclick="alert('Спасибо! Ваша связь с историей важна.')">Я знаю этого героя</button>
        </div>
    `;
    
    // Закрытие по клику вне окна
    modal.onclick = (e) => {
        if (e.target === modal) modal.remove();
    };
    
    document.body.appendChild(modal);
}
