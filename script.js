const API_BASE_URL = 'https://metabook-production.up.railway.app/api';
const API_HOST = 'https://metabook-production.up.railway.app';

// Формирует корректный URL картинки
function getImageUrl(path) {
    if (!path || path === 'qwe') return 'https://images.unsplash.com/photo-1593118247619-e2d6f056869e?w=600';
    if (path.startsWith('http')) return path;
    if (path.startsWith('/')) return API_HOST + path;
    return API_HOST + '/' + path;
}

// Функция показа уведомлений
function showNotification(message, type = 'info') {
    const oldNotifications = document.querySelectorAll('.notification');
    oldNotifications.forEach(n => n.remove());
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    
    let icon = 'fa-info-circle';
    if (type === 'success') icon = 'fa-check-circle';
    if (type === 'error') icon = 'fa-exclamation-circle';
    if (type === 'warning') icon = 'fa-exclamation-triangle';
    
    notification.innerHTML = `
        <i class="fa-solid ${icon}"></i>
        <span>${message}</span>
    `;
    
    Object.assign(notification.style, {
        position: 'fixed',
        top: '80px',
        right: '20px',
        padding: '12px 20px',
        background: type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : type === 'warning' ? '#f59e0b' : '#3b82f6',
        color: 'white',
        borderRadius: '8px',
        boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
        zIndex: '10000',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        fontSize: '14px',
        fontWeight: '500',
        animation: 'slideInRight 0.3s ease',
        cursor: 'pointer'
    });
    
    document.body.appendChild(notification);
    
    notification.onclick = () => {
        notification.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    };
    
    setTimeout(() => {
        if (notification.parentElement) {
            notification.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }
    }, 4000);
}

// Добавляем CSS анимации
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOutRight {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(style);

// Получение текущего пользователя
function getCurrentUser() {
    const token = localStorage.getItem('authToken');
    const userId = localStorage.getItem('userId');
    if (!token || !userId) return null;
    return { token, userId: parseInt(userId) };
}

// Проверка авторизации
function isAuthenticated() {
    return localStorage.getItem('authToken') !== null && localStorage.getItem('userId') !== null;
}

// ========== ИСПРАВЛЕННАЯ ФУНКЦИЯ ==========
// Теперь просто перенаправляет на страницу бронирования
function openBookingModal(roomName, maxParticipants = 8, roomId = null, pricePerHour = 350) {
    if (!isAuthenticated()) {
        showNotification('Необходимо войти в систему для бронирования', 'error');
        setTimeout(() => {
            window.location.href = 'pages/login.html';
        }, 1500);
        return;
    }
    
    // Просто перенаправляем на страницу бронирования с ID комнаты
    window.location.href = `pages/booking-room.html?id=${roomId}`;
}
// ========== КОНЕЦ ИСПРАВЛЕННОЙ ФУНКЦИИ ==========

// Загрузка и отображение комнат
async function loadRooms() {
    try {
        const response = await fetch(`${API_BASE_URL}/Room/list`);
        const data = await response.json();
        
        if (data.success && data.rooms) {
            displayRooms(data.rooms);
        } else {
            showNotification('Ошибка загрузки комнат', 'error');
        }
    } catch (error) {
        console.error('Error loading rooms:', error);
        showNotification('Ошибка загрузки комнат: ' + error.message, 'error');
    }
}

function displayRooms(rooms) {
    const roomsGrid = document.querySelector('.rooms-grid');
    if (!roomsGrid) return;
    
    roomsGrid.innerHTML = rooms.map(room => `
        <div class="room-card" data-room-id="${room.id}">
            <div class="room-image">
                <img src="${getImageUrl(room.base_image_url)}" alt="${room.title}">
                <div class="room-badge">${room.price_per_hour === 0 ? 'Бесплатно' : 'Популярное'}</div>
                <button class="favorite-btn" onclick="toggleFavorite(${room.id})">
                    <i class="fa-regular fa-heart"></i>
                </button>
            </div>
            <div class="room-content">
                <h3 class="room-title">${escapeHtml(room.title)}</h3>
                <p class="room-description">${escapeHtml(room.description || 'Нет описания')}</p>
                <div class="room-meta">
                    <div class="room-capacity"><i class="fa-solid fa-user"></i> до ${room.max_capacity} человек</div>
                    <div class="room-price">${room.price_per_hour}₽/час</div>
                </div>
                <div class="room-features">
                    <span class="feature-tag"><i class="fa-solid fa-wifi"></i> VR Ready</span>
                    <span class="feature-tag"><i class="fa-solid fa-microphone"></i> Голосовой чат</span>
                </div>
                <div class="room-actions">
                    <button class="btn btn-primary" onclick="openBookingModal('${escapeHtml(room.title)}', ${room.max_capacity}, ${room.id}, ${room.price_per_hour})">
                        <i class="fa-regular fa-calendar-check"></i> Забронировать
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Избранное
function toggleFavorite(roomId) {
    const button = event.currentTarget;
    const icon = button.querySelector('i');
    const isFavorite = icon.classList.contains('fa-solid');
    
    if (!isFavorite) {
        icon.classList.remove('fa-regular');
        icon.classList.add('fa-solid');
        button.style.color = '#ef4444';
        saveFavorite(roomId);
        showNotification('Добавлено в избранное', 'success');
    } else {
        icon.classList.remove('fa-solid');
        icon.classList.add('fa-regular');
        button.style.color = '';
        removeFavorite(roomId);
        showNotification('Удалено из избранного', 'info');
    }
}

function saveFavorite(roomId) {
    let favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
    if (!favorites.includes(roomId)) {
        favorites.push(roomId);
        localStorage.setItem('favorites', JSON.stringify(favorites));
    }
}

function removeFavorite(roomId) {
    let favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
    favorites = favorites.filter(id => id !== roomId);
    localStorage.setItem('favorites', JSON.stringify(favorites));
}

// Поиск
function searchRooms(searchTerm) {
    const searchLower = searchTerm.toLowerCase().trim();
    const roomCards = document.querySelectorAll('.room-card');
    let visibleCount = 0;
    
    roomCards.forEach(card => {
        const title = card.querySelector('.room-title')?.textContent.toLowerCase() || '';
        const description = card.querySelector('.room-description')?.textContent.toLowerCase() || '';
        const shouldShow = !searchTerm || title.includes(searchLower) || description.includes(searchLower);
        card.style.display = shouldShow ? 'flex' : 'none';
        if (shouldShow) visibleCount++;
    });
    
    const noResultsMsg = document.getElementById('noResultsMessage');
    if (visibleCount === 0 && searchTerm) {
        if (!noResultsMsg) {
            const msg = document.createElement('div');
            msg.id = 'noResultsMessage';
            msg.style.cssText = 'text-align: center; padding: 40px; color: rgba(255,255,255,0.5);';
            msg.innerHTML = '<i class="fa-solid fa-search" style="font-size: 48px; margin-bottom: 16px;"></i><h3>Ничего не найдено</h3><p>Попробуйте изменить параметры поиска</p>';
            document.querySelector('.rooms-grid').appendChild(msg);
        }
    } else if (noResultsMsg) {
        noResultsMsg.remove();
    }
}

// Инициализация
document.addEventListener('DOMContentLoaded', async function() {
    if (document.querySelector('.rooms-grid')) {
        await loadRooms();
    }
    
    const searchInput = document.querySelector('.search-bar input');
    const searchButton = document.querySelector('.search-bar button');
    
    if (searchInput) {
        searchInput.addEventListener('input', function(e) {
            searchRooms(e.target.value);
        });
    }
    
    if (searchButton) {
        searchButton.addEventListener('click', function() {
            const input = document.querySelector('.search-bar input');
            if (input) searchRooms(input.value);
        });
    }
    
    const user = getCurrentUser();
    const userActions = document.querySelector('.user-actions');
    
    if (user && userActions) {
        try {
            const response = await fetch(`${API_BASE_URL}/User/${user.userId}`, {
                headers: { 'Authorization': `Bearer ${user.token}` }
            });
            const data = await response.json();
            if (data.success && data.user) {
                userActions.innerHTML = `
                    <div class="user-menu" style="display: flex; gap: 10px; align-items: center;">
                        <span style="color: white;"><i class="fa-solid fa-user"></i> ${data.user.first_name} ${data.user.last_name}</span>
                        <button class="btn btn-outline" onclick="logout()">
                            <i class="fa-solid fa-sign-out-alt"></i> Выйти
                        </button>
                    </div>
                `;
            }
        } catch (error) {
            console.error('Error loading user info:', error);
        }
    }
    
    console.log('MetaBook VR Room Booking Portal initialized');
});

function logout() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('userId');
    localStorage.removeItem('userEmail');
    showNotification('Вы вышли из системы', 'info');
    setTimeout(() => {
        window.location.reload();
    }, 1000);
}