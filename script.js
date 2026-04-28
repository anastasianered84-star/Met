const API_BASE_URL = 'https://localhost:7255/api';
const API_HOST = 'https://localhost:7255';

// Формирует корректный URL картинки
function getImageUrl(path) {
    if (!path || path === 'qwe') return 'https://images.unsplash.com/photo-1593118247619-e2d6f056869e?w=600';
    if (path.startsWith('http')) return path;
    if (path.startsWith('/')) return API_HOST + path;
    return API_HOST + '/' + path;
}

// Функция показа уведомлений
function showNotification(message, type = 'info') {
    // Удаляем старые уведомления
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
    
    // Стили уведомления
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
    
    // Клик для закрытия
    notification.onclick = () => {
        notification.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    };
    
    // Автоматическое закрытие через 4 секунды
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
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
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

// Modal functionality
function openBookingModal(roomName, maxParticipants = 8, roomId = null, pricePerHour = 350) {
    // Проверка авторизации
    if (!isAuthenticated()) {
        showNotification('Необходимо войти в систему для бронирования', 'error');
        setTimeout(() => {
            window.location.href = 'pages/login.html';
        }, 1500);
        return;
    }
    
    const modal = document.getElementById('bookingModal');
    if (!modal) return;
    
    document.getElementById('roomName').value = roomName;
    document.getElementById('participants').max = maxParticipants;
    document.getElementById('participants').value = 1;
    modal.style.display = 'flex';
    
    // Сохраняем данные комнаты
    modal.dataset.pricePerHour = pricePerHour;
    modal.dataset.roomId = roomId;
    modal.dataset.roomName = roomName;
    modal.dataset.maxParticipants = maxParticipants;
    
    // Устанавливаем дату по умолчанию - сегодня
    const today = new Date();
    const dateInput = document.getElementById('bookingDate');
    if (dateInput) {
        dateInput.min = today.toISOString().split('T')[0];
        dateInput.valueAsDate = today;
    }
    
    // Устанавливаем время начала по умолчанию - следующий час
    const nextHour = new Date();
    nextHour.setHours(nextHour.getHours() + 1);
    nextHour.setMinutes(0);
    const timeInput = document.getElementById('startTime');
    if (timeInput) {
        timeInput.value = nextHour.toTimeString().slice(0, 5);
    }
    
    calculatePrice();
}

function closeBookingModal() {
    const modal = document.getElementById('bookingModal');
    if (modal) {
        modal.style.display = 'none';
    }
    // Сброс формы
    const form = document.getElementById('bookingForm');
    if (form) form.reset();
}

window.onclick = function(event) {
    const modal = document.getElementById('bookingModal');
    if (event.target === modal) {
        closeBookingModal();
    }
}

function calculatePrice() {
    const duration = parseInt(document.getElementById('duration')?.value || 1);
    const pricePerHour = parseFloat(document.getElementById('bookingModal')?.dataset.pricePerHour || 350);
    const total = duration * pricePerHour;
    
    let priceElement = document.getElementById('bookingPrice');
    if (!priceElement) {
        const form = document.getElementById('bookingForm');
        if (form) {
            const priceDiv = document.createElement('div');
            priceDiv.className = 'form-group';
            priceDiv.innerHTML = `
                <label>Итого к оплате</label>
                <div id="bookingPrice" style="font-size: 1.5rem; font-weight: bold; color: var(--primary);">${total}₽</div>
            `;
            const submitBtn = form.querySelector('button[type="submit"]');
            if (submitBtn) {
                form.insertBefore(priceDiv, submitBtn);
            }
        }
    } else {
        priceElement.textContent = total + '₽';
    }
}

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
                <div class="room-badge">Популярное</div>
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
                    <button class="btn btn-outline" onclick="viewRoomDetails(${room.id})">
                        <i class="fa-regular fa-eye"></i> Подробнее
                    </button>
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

// Обработчик формы бронирования
document.getElementById('bookingForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const user = getCurrentUser();
    if (!user) {
        showNotification('Необходимо войти в систему', 'error');
        setTimeout(() => {
            window.location.href = 'pages/login.html';
        }, 1500);
        return;
    }
    
    const modal = document.getElementById('bookingModal');
    const roomId = modal.dataset.roomId;
    const roomName = modal.dataset.roomName;
    
    if (!roomId) {
        showNotification('Ошибка: ID комнаты не найден', 'error');
        return;
    }
    
    const date = document.getElementById('bookingDate').value;
    const startTime = document.getElementById('startTime').value;
    const duration = parseInt(document.getElementById('duration').value);
    const participants = parseInt(document.getElementById('participants').value);
    const maxParticipants = parseInt(modal.dataset.maxParticipants);
    
    // Валидация
    if (!date) {
        showNotification('Выберите дату бронирования', 'error');
        return;
    }
    
    if (!startTime) {
        showNotification('Выберите время начала', 'error');
        return;
    }
    
    if (participants > maxParticipants) {
        showNotification(`Максимальное количество участников: ${maxParticipants}`, 'error');
        return;
    }
    
    // Формируем дату и время
    const startDateTime = new Date(`${date}T${startTime}`);
    const now = new Date();
    
    // Проверка только на прошедшее время (без ограничения в 1 час)
    if (startDateTime < now) {
        showNotification('Нельзя забронировать время в прошлом', 'error');
        return;
    }
    
    const endDateTime = new Date(startDateTime.getTime() + duration * 60 * 60 * 1000);
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    
    try {
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Бронирование...';
        submitBtn.disabled = true;
        
        const formData = new FormData();
        formData.append('roomId', roomId);
        formData.append('userId', user.userId);
        formData.append('startTime', startDateTime.toISOString());
        formData.append('endTime', endDateTime.toISOString());
        formData.append('specialRequests', `Количество участников: ${participants}`);
        
        console.log('Sending booking:', {
            roomId,
            userId: user.userId,
            startTime: startDateTime.toISOString(),
            endTime: endDateTime.toISOString()
        });
        
        const response = await fetch(`${API_BASE_URL}/Room/book`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${user.token}`
            },
            body: formData
        });
        
        const data = await response.json();
        
        console.log('Response:', data);
        
        if (response.ok && data.success) {
            showNotification(`✅ Комната "${roomName}" успешно забронирована!`, 'success');
            closeBookingModal();
        } else {
            throw new Error(data.message || 'Ошибка при бронировании');
        }
    } catch (error) {
        console.error('Booking error:', error);
        showNotification(`❌ Ошибка: ${error.message}`, 'error');
    } finally {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
});

function viewRoomDetails(roomId) {
    window.location.href = `pages/room.html?id=${roomId}`;
}

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
        button.style.color = 'var(--light)';
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
        card.style.display = shouldShow ? 'block' : 'none';
        if (shouldShow) visibleCount++;
    });
    
    showNoResultsMessage(visibleCount === 0 && searchTerm);
}

function showNoResultsMessage(show) {
    let message = document.getElementById('noResultsMessage');
    const roomsGrid = document.querySelector('.rooms-grid');
    
    if (show && roomsGrid && !message) {
        message = document.createElement('div');
        message.id = 'noResultsMessage';
        message.style.cssText = 'text-align: center; padding: 3rem; color: var(--light); grid-column: 1 / -1;';
        message.innerHTML = `
            <i class="fa-solid fa-search" style="font-size: 3rem; margin-bottom: 1rem; display: block; color: #818cf8;"></i>
            <h3>Комнаты не найдены</h3>
            <p>Попробуйте изменить параметры поиска</p>
        `;
        roomsGrid.appendChild(message);
    } else if (!show && message) {
        message.remove();
    }
}

// Инициализация
document.addEventListener('DOMContentLoaded', async function() {
    // Загружаем комнаты
    if (document.querySelector('.rooms-grid')) {
        await loadRooms();
    }
    
    // Настройка поиска
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
    
    // Пересчет цены при изменении длительности
    const durationSelect = document.getElementById('duration');
    if (durationSelect) {
        durationSelect.addEventListener('change', calculatePrice);
    }
    
    // Обновляем UI пользователя
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